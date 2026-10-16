import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArraySource } from '../src/sources/array-source.js';
import type { FlowDataSource, FlowHistory } from '../src/types/source.js';
import type { NodeChange } from '../src/types/changes.js';
import { FlowStore } from '../src/flow-store.js';
import type { NodeDragItem } from '../src/engine.js';
import { bareNode, createFakePanZoom, createStore, edge, node, tick } from './helpers.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('construction and notification', () => {
  it('adopts the initial nodes and edges into lookups', () => {
    const { store } = createStore({
      nodes: [node('a'), node('b', 200)],
      edges: [edge('e', 'a', 'b')],
    });
    const s = store.getState();
    expect(s.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(s.nodeLookup.get('b')?.internals.positionAbsolute).toEqual({ x: 200, y: 0 });
    expect(s.edgeLookup.get('e')).toBeDefined();
    expect(s.connectionLookup.size).toBeGreaterThan(0);
    expect(s.nodesInitialized).toBe(true);
  });

  it('applies defaults and options', () => {
    const { store } = createStore({ minZoom: 0.1, edgesReconnectable: undefined });
    const s = store.getState();
    expect(s.minZoom).toBe(0.1);
    expect(s.maxZoom).toBe(2);
    expect(s.edgesReconnectable).toBe(false);
    expect(s.elevateEdgesOnSelect).toBe(false);
    expect(s.selectionMode).toBe('full');
    expect(s.flowId).toBe('1');
    expect(s.snapGrid).toEqual([15, 15]);
  });

  it('merges setState synchronously and notifies once per microtask', async () => {
    const { store } = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.flush();
    listener.mockClear();

    store.setState({ width: 10 });
    store.setState({ height: 20 });
    store.setState({ width: 30 });
    expect(store.getState()).toMatchObject({ width: 30, height: 20 });
    expect(listener).not.toHaveBeenCalled();
    await tick();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('flush() runs the pending notification immediately, once', async () => {
    const { store } = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.flush();
    listener.mockClear();
    store.setState({ width: 1 });
    store.flush();
    expect(listener).toHaveBeenCalledTimes(1);
    await tick();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps going when a listener throws and reports XYL00', () => {
    const { store, of } = createStore();
    store.subscribe(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    store.subscribe(ok);
    store.setState({ width: 1 });
    store.flush();
    expect(ok).toHaveBeenCalled();
    expect(of('flow-error').some((e) => e.code === 'XYL00')).toBe(true);
  });

  it('unsubscribes', () => {
    const { store } = createStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.setState({ width: 1 });
    store.flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it('computes the initial transform when fitView and a size are given', () => {
    const { store } = createStore({
      nodes: [node('a', 0, 0), node('b', 100, 100, { width: 100, height: 100 })],
      fitView: true,
      width: 400,
      height: 400,
      maxZoom: 4,
    });
    const [x, y, zoom] = store.getState().transform;
    expect(zoom).toBeGreaterThan(1);
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    expect(store.getState().fitViewQueued).toBe(true);
  });
});

describe('change pipeline', () => {
  it('uncontrolled: applies changes to the source and syncs the state before returning', () => {
    const { store, of } = createStore({ nodes: [node('a'), node('b')] });
    store.triggerNodeChanges([{ id: 'a', type: 'select', selected: true }], {
      phase: 'discrete',
      origin: 'select',
    });
    expect(store.getState().nodes[0]?.selected).toBe(true);
    expect(store.source.nodes[0]?.selected).toBe(true);
    expect(store.getState().nodes[1]).toBe(store.source.nodes[1]);
    const events = of('nodes-change');
    expect(events).toHaveLength(1);
    expect(events[0]?.meta).toMatchObject({ phase: 'discrete', origin: 'select' });
  });

  it('emits nodes-change and edges-change as cancelable', () => {
    const { store, events } = createStore({ nodes: [node('a')], edges: [edge('e', 'a', 'a')] });
    store.triggerNodeChanges([{ id: 'a', type: 'select', selected: true }], {
      phase: 'discrete',
      origin: 'select',
    });
    store.triggerEdgeChanges([{ id: 'e', type: 'select', selected: true }], {
      phase: 'discrete',
      origin: 'select',
    });
    expect(events.filter((e) => e.cancelable).map((e) => e.type)).toEqual([
      'nodes-change',
      'edges-change',
    ]);
  });

  it('controlled: a prevented nodes-change leaves the source untouched', () => {
    const { store, prevent } = createStore({ nodes: [node('a')], edges: [edge('e', 'a', 'a')] });
    prevent.add('nodes-change');
    prevent.add('edges-change');
    const before = store.source.nodes;
    store.triggerNodeChanges([{ id: 'a', type: 'select', selected: true }], {
      phase: 'discrete',
      origin: 'select',
    });
    store.triggerEdgeChanges([{ id: 'e', type: 'select', selected: true }], {
      phase: 'discrete',
      origin: 'select',
    });
    expect(store.source.nodes).toBe(before);
    expect(store.getState().nodes[0]?.selected).toBeUndefined();
    expect(store.getState().edges[0]?.selected).toBeUndefined();

    // the app then owns state and assigns the nodes itself
    (store.source as ArraySource).replaceNodes([{ ...node('a'), selected: true }]);
    expect(store.getState().nodes[0]?.selected).toBe(true);
  });

  it('ignores empty batches', () => {
    const { store, events } = createStore({ nodes: [node('a')] });
    store.triggerNodeChanges([], { phase: 'discrete', origin: 'api' });
    store.triggerEdgeChanges([], { phase: 'discrete', origin: 'api' });
    expect(
      events.filter((e) => e.type === 'nodes-change' || e.type === 'edges-change'),
    ).toHaveLength(0);
  });

  it('runs middlewares in registration order, each seeing the previous output', () => {
    const { store, of } = createStore({ nodes: [node('a'), node('b')] });
    const order: string[] = [];
    store.addNodeChangeMiddleware((changes) => {
      order.push('first');
      return changes.filter((c) => !(c.type === 'select' && c.id === 'b'));
    });
    store.addNodeChangeMiddleware((changes) => {
      order.push(`second:${changes.length}`);
      return changes;
    });
    store.triggerNodeChanges(
      [
        { id: 'a', type: 'select', selected: true },
        { id: 'b', type: 'select', selected: true },
      ],
      { phase: 'discrete', origin: 'select' },
    );
    expect(order).toEqual(['first', 'second:1']);
    expect(of('nodes-change')[0]?.changes).toHaveLength(1);
    expect(store.getState().nodes.map((n) => n.selected)).toEqual([true, undefined]);
  });

  it('drops the batch (no event, no apply) when a middleware returns an empty array', () => {
    const { store, events } = createStore({ nodes: [node('a')] });
    const second = vi.fn((c: NodeChange[]) => c);
    store.addNodeChangeMiddleware(() => []);
    store.addNodeChangeMiddleware(second);
    store.triggerNodeChanges([{ id: 'a', type: 'select', selected: true }], {
      phase: 'discrete',
      origin: 'select',
    });
    expect(second).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'nodes-change')).toBe(false);
    expect(store.getState().nodes[0]?.selected).toBeUndefined();
  });

  it('unregisters middlewares', () => {
    const { store } = createStore({ nodes: [node('a')] });
    const mw = vi.fn((c: NodeChange[]) => c);
    const off = store.addNodeChangeMiddleware(mw);
    off();
    store.triggerNodeChanges([{ id: 'a', type: 'select', selected: true }], {
      phase: 'discrete',
      origin: 'select',
    });
    expect(mw).not.toHaveBeenCalled();
  });

  it('edge middlewares work like node middlewares', () => {
    const { store, of } = createStore({ nodes: [node('a')], edges: [edge('e', 'a', 'a')] });
    store.addEdgeChangeMiddleware((changes) => changes.filter((c) => c.type !== 'remove'));
    store.triggerEdgeChanges([{ id: 'e', type: 'remove' }], {
      phase: 'discrete',
      origin: 'delete',
    });
    expect(of('edges-change')).toHaveLength(0);
    expect(store.getState().edges).toHaveLength(1);
  });

  it('drops the api snapshot when a middleware rewrites the batch', () => {
    const { store } = createStore({ nodes: [node('a')] });
    store.addNodeChangeMiddleware((changes) => changes.filter((c) => c.type !== 'remove'));
    const snapshot = [node('a'), node('b')];
    store.triggerNodeChanges(
      [
        { type: 'add', item: node('b') },
        { id: 'a', type: 'remove' },
      ],
      { phase: 'discrete', origin: 'api', snapshotNodes: snapshot },
    );
    // the remove was filtered: 'a' stays, 'b' is added from the changes, not from the snapshot
    expect(store.getState().nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(store.getState().nodes).not.toBe(snapshot);
  });

  it('takes the api snapshot verbatim when nothing rewrote the batch', () => {
    const { store } = createStore({ nodes: [node('a')] });
    const snapshot = [node('b'), node('a')];
    store.triggerNodeChanges([{ type: 'add', item: snapshot[0]! }], {
      phase: 'discrete',
      origin: 'api',
      snapshotNodes: snapshot,
    });
    expect(store.getState().nodes).toBe(snapshot);
  });

  it('logs changes when debug is on', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { store } = createStore({ nodes: [node('a')], debug: true });
    store.triggerNodeChanges([{ id: 'a', type: 'select', selected: true }], {
      phase: 'discrete',
      origin: 'select',
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('phases', () => {
  const drag = (store: FlowStore, id: string, x: number): Map<string, NodeDragItem> => {
    const internal = store.getState().nodeLookup.get(id)!;
    return new Map([
      [
        id,
        {
          ...internal,
          id,
          position: { x, y: 0 },
          distance: { x: 0, y: 0 },
          measured: { width: 100, height: 50 },
          internals: { positionAbsolute: { x, y: 0 } },
        } as NodeDragItem,
      ],
    ]);
  };

  it('infers start, live, end and then discrete', () => {
    const { store, of } = createStore({ nodes: [node('a')] });
    const base = drag(store, 'a', 10);
    store.updateNodePositions(base, true);
    store.updateNodePositions(drag(store, 'a', 20), true);
    store.updateNodePositions(drag(store, 'a', 30), true);
    store.updateNodePositions(drag(store, 'a', 30), false);
    store.updateNodePositions(drag(store, 'a', 40), false);

    const metas = of('nodes-change').map((e) => e.meta);
    expect(metas.map((m) => m.phase)).toEqual(['start', 'live', 'live', 'end', 'discrete']);
    expect(metas.slice(0, 4).map((m) => m.origin)).toEqual(['drag', 'drag', 'drag', 'drag']);
    expect(metas[4]?.origin).toBe('keyboard');
    const ids = new Set(metas.slice(0, 4).map((m) => m.gestureId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toMatch(/^[0-9a-z-]{10}$/);
    expect(metas[4]?.gestureId).toBeUndefined();
    expect(store.getState().activeGesture).toBeNull();
  });

  it('sends position changes with the dragging flag, applied through the source', () => {
    const { store, of } = createStore({ nodes: [node('a')] });
    store.updateNodePositions(drag(store, 'a', 10), true);
    expect(of('nodes-change')[0]?.changes).toEqual([
      { id: 'a', type: 'position', position: { x: 10, y: 0 }, dragging: true },
    ]);
    expect(store.getState().nodes[0]).toMatchObject({ position: { x: 10, y: 0 }, dragging: true });
    store.updateNodePositions(drag(store, 'a', 10), false);
    expect(store.getState().nodes[0]?.dragging).toBe(false);
  });

  it('uses new gesture ids for each drag', () => {
    const { store, of } = createStore({ nodes: [node('a')] });
    store.updateNodePositions(drag(store, 'a', 1), true);
    store.updateNodePositions(drag(store, 'a', 1), false);
    store.updateNodePositions(drag(store, 'a', 2), true);
    const [first, , second] = of('nodes-change').map((e) => e.meta.gestureId);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
  });

  it('lets an explicit phase and origin win', () => {
    const { store, of } = createStore({ nodes: [node('a')] });
    store.updateNodePositions(drag(store, 'a', 5), false, { phase: 'discrete', origin: 'layout' });
    expect(of('nodes-change')[0]?.meta).toMatchObject({ phase: 'discrete', origin: 'layout' });
    expect(store.getState().activeGesture).toBeNull();
  });

  it('clamps child positions to >= 0 and expands the parent when expandParent is set', () => {
    const { store, of } = createStore({
      nodes: [
        node('p', 0, 0, { width: 100, height: 100 }),
        node('c', 10, 10, { parentId: 'p', expandParent: true, width: 20, height: 20 }),
      ],
    });
    const internal = store.getState().nodeLookup.get('c')!;
    const items = new Map([
      [
        'c',
        {
          id: 'c',
          position: { x: -5, y: 150 },
          distance: { x: 0, y: 0 },
          measured: { width: 20, height: 20 },
          internals: { positionAbsolute: { x: -5, y: 150 } },
          expandParent: true,
          parentId: 'p',
          ...{ extent: internal.extent },
        } as NodeDragItem,
      ],
    ]);
    store.updateNodePositions(items, true);
    const changes = of('nodes-change')[0]!.changes;
    expect(changes[0]).toMatchObject({ id: 'c', type: 'position', position: { x: 0, y: 150 } });
    expect(changes.some((c) => c.type === 'dimensions' && c.id === 'p')).toBe(true);
  });
});

describe('structureRevision', () => {
  it('bumps only when id sets change', () => {
    const { store } = createStore({ nodes: [node('a'), node('b')], edges: [edge('e', 'a', 'b')] });
    const rev = () => store.getState().structureRevision;
    const start = rev();

    // same ids, new objects: no bump
    (store.source as ArraySource).replaceNodes(
      store.getState().nodes.map((n) => ({ ...n, selected: true })),
    );
    expect(rev()).toBe(start);

    // reorder: no bump
    (store.source as ArraySource).replaceNodes([...store.getState().nodes].reverse());
    expect(rev()).toBe(start);

    // add: bump
    (store.source as ArraySource).replaceNodes([...store.getState().nodes, node('c')]);
    expect(rev()).toBe(start + 1);

    // remove: bump
    (store.source as ArraySource).replaceNodes(store.getState().nodes.filter((n) => n.id !== 'c'));
    expect(rev()).toBe(start + 2);

    // edges: same ids no bump, add bumps
    (store.source as ArraySource).replaceEdges(
      store.getState().edges.map((e) => ({ ...e, animated: true })),
    );
    expect(rev()).toBe(start + 2);
    (store.source as ArraySource).replaceEdges([...store.getState().edges, edge('e2', 'b', 'a')]);
    expect(rev()).toBe(start + 3);
  });

  it('does not bump for position, selection or measurement changes', () => {
    const { store } = createStore({ nodes: [node('a')] });
    const start = store.getState().structureRevision;
    store.triggerNodeChanges([{ id: 'a', type: 'position', position: { x: 5, y: 5 } }], {
      phase: 'discrete',
      origin: 'keyboard',
    });
    store.triggerNodeChanges([{ id: 'a', type: 'select', selected: true }], {
      phase: 'discrete',
      origin: 'select',
    });
    store.triggerNodeChanges(
      [{ id: 'a', type: 'dimensions', dimensions: { width: 5, height: 5 } }],
      { phase: 'discrete', origin: 'measure' },
    );
    expect(store.getState().structureRevision).toBe(start);
  });

  it('bumps lookupVersion on every adoption', () => {
    const { store } = createStore({ nodes: [node('a')] });
    const before = store.getState().lookupVersion;
    store.triggerNodeChanges([{ id: 'a', type: 'select', selected: true }], {
      phase: 'discrete',
      origin: 'select',
    });
    expect(store.getState().lookupVersion).toBe(before + 1);
  });
});

describe('sources', () => {
  const makeSource = (
    nodes = [node('x')],
    edges = [],
  ): FlowDataSource & {
    set(n: typeof nodes): void;
    attach: ReturnType<typeof vi.fn>;
    detach: ReturnType<typeof vi.fn>;
    structureVersion: number;
    history?: FlowHistory;
  } => {
    const listeners = new Set<() => void>();
    const source = {
      nodes,
      edges,
      structureVersion: 0,
      attach: vi.fn(),
      detach: vi.fn(),
      subscribe(l: () => void) {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      applyNodeChanges: vi.fn(),
      applyEdgeChanges: vi.fn(),
      set(n: typeof nodes) {
        source.nodes = n;
        listeners.forEach((l) => l());
      },
    };
    return source as never;
  };

  it('setSource detaches the old source, attaches the new one, syncs and bumps the revision', () => {
    const { store } = createStore({ nodes: [node('a')] });
    const old = store.source;
    const detach = vi.spyOn(old as ArraySource, 'subscribe');
    void detach;
    const next = makeSource();
    const before = store.getState().structureRevision;
    store.setSource(next);
    expect(store.source).toBe(next);
    expect(next.attach).toHaveBeenCalledWith(store);
    expect(store.getState().nodes.map((n) => n.id)).toEqual(['x']);
    expect(store.getState().structureRevision).toBeGreaterThan(before);

    store.setSource(null);
    expect(next.detach).toHaveBeenCalled();
    expect(store.source).toBeInstanceOf(ArraySource);
    expect(store.getState().nodes).toEqual([]);
  });

  it('follows source notifications and structureVersion', () => {
    const { store } = createStore();
    const src = makeSource();
    store.setSource(src);
    const rev = store.getState().structureRevision;
    src.set([node('x'), node('y')]);
    expect(store.getState().nodes).toHaveLength(2);
    const afterIds = store.getState().structureRevision;
    expect(afterIds).toBe(rev + 1);

    src.structureVersion = 1;
    src.set(src.nodes); // same array: only structureVersion differs
    expect(store.getState().structureRevision).toBe(afterIds + 1);
  });

  it('stops listening to the old source', () => {
    const { store } = createStore();
    const src = makeSource();
    store.setSource(src);
    store.setSource(null);
    src.set([node('z')]);
    expect(store.getState().nodes).toEqual([]);
  });

  it('exposes the source history, else the registered one', () => {
    const { store } = createStore();
    expect(store.history).toBeNull();
    const local: FlowHistory = {
      undo() {},
      redo() {},
      canUndo: () => true,
      canRedo: () => false,
      subscribe: () => () => undefined,
    };
    store.setHistory(local);
    expect(store.history).toBe(local);
    const src = makeSource();
    const remote: FlowHistory = { ...local, canUndo: () => false };
    src.history = remote;
    store.setSource(src);
    expect(store.history).toBe(remote);
    store.setSource(null);
    expect(store.history).toBe(local);
    store.setHistory(null);
    expect(store.history).toBeNull();
  });
});

describe('nodes-initialized', () => {
  it('fires once per false to true flip', async () => {
    const { store, of } = createStore();
    (store.source as ArraySource).replaceNodes([node('a'), node('b')]);
    await tick();
    expect(of('nodes-initialized')).toHaveLength(1);
    expect(of('nodes-initialized')[0]?.nodes).toHaveLength(2);

    // still initialised: no new event
    (store.source as ArraySource).replaceNodes(store.getState().nodes.map((n) => ({ ...n })));
    await tick();
    expect(of('nodes-initialized')).toHaveLength(1);

    // a new unmeasured node flips it to false, measuring flips it back
    (store.source as ArraySource).replaceNodes([...store.getState().nodes, bareNode('c')]);
    await tick();
    expect(store.getState().nodesInitialized).toBe(false);
    expect(of('nodes-initialized')).toHaveLength(1);
    store.triggerNodeChanges(
      [{ id: 'c', type: 'dimensions', dimensions: { width: 10, height: 10 } }],
      {
        phase: 'discrete',
        origin: 'measure',
      },
    );
    await tick();
    expect(store.getState().nodesInitialized).toBe(true);
    expect(of('nodes-initialized')).toHaveLength(2);
  });

  it('does not fire for an empty flow', async () => {
    const { store, of } = createStore();
    (store.source as ArraySource).replaceNodes([]);
    await tick();
    expect(of('nodes-initialized')).toHaveLength(0);
  });

  it('fires only after the measured flip, not while nodes are unmeasured', async () => {
    const { store, of } = createStore({ nodes: [bareNode('a')] });
    await tick();
    expect(of('nodes-initialized')).toHaveLength(0);
    store.triggerNodeChanges(
      [{ id: 'a', type: 'dimensions', dimensions: { width: 10, height: 10 } }],
      {
        phase: 'discrete',
        origin: 'measure',
      },
    );
    await tick();
    expect(of('nodes-initialized')).toHaveLength(1);
  });
});

describe('selection', () => {
  it('emits selection-change only when the selected set changes', async () => {
    const { store, of } = createStore({
      nodes: [node('a'), node('b')],
      edges: [edge('e', 'a', 'b')],
    });
    await tick();
    expect(of('selection-change')).toHaveLength(0);

    store.addSelectedNodes(['a']);
    await tick();
    expect(of('selection-change')).toHaveLength(1);
    expect(of('selection-change')[0]?.nodes.map((n) => n.id)).toEqual(['a']);

    // moving the node does not change the selection
    store.triggerNodeChanges([{ id: 'a', type: 'position', position: { x: 1, y: 1 } }], {
      phase: 'discrete',
      origin: 'keyboard',
    });
    await tick();
    expect(of('selection-change')).toHaveLength(1);

    store.addSelectedEdges(['e']);
    await tick();
    const events = of('selection-change');
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ nodes: [], edges: [{ id: 'e' }] });

    store.resetSelectedElements();
    await tick();
    expect(of('selection-change')).toHaveLength(3);
    expect(of('selection-change')[2]).toMatchObject({ nodes: [], edges: [] });
  });

  it('coalesces several selection changes in one tick into one event', async () => {
    const { store, of } = createStore({ nodes: [node('a'), node('b')] });
    store.addSelectedNodes(['a']);
    store.addSelectedNodes(['b']);
    await tick();
    expect(of('selection-change')).toHaveLength(1);
    expect(of('selection-change')[0]?.nodes.map((n) => n.id)).toEqual(['b']);
  });

  it('reports preselected elements once and notifies handlers', async () => {
    const { store, of } = createStore({ nodes: [node('a', 0, 0, { selected: true })] });
    const handler = vi.fn();
    const key = Symbol('h');
    store.selectionChangeHandlers.set(key, handler);
    await tick();
    expect(of('selection-change')).toHaveLength(1);
    store.addSelectedNodes(['a']); // no change
    await tick();
    expect(of('selection-change')).toHaveLength(1);
    store.unselectNodesAndEdges();
    await tick();
    expect(handler).toHaveBeenCalledWith({ nodes: [], edges: [] });
  });

  it('addSelectedNodes selects exactly those nodes and mutates the internal nodes', () => {
    const { store } = createStore({
      nodes: [node('a', 0, 0, { selected: true }), node('b'), node('c')],
      edges: [edge('e', 'a', 'b', { selected: true })],
    });
    store.addSelectedNodes(['b']);
    expect(store.getState().nodes.map((n) => !!n.selected)).toEqual([false, true, false]);
    expect(store.getState().edges[0]?.selected).toBe(false);
    expect(store.getState().nodeLookup.get('a')?.selected).toBe(false);
    expect(store.getState().nodeLookup.get('b')?.selected).toBe(true);
  });

  it('keeps the previous selection with multiSelectionActive', () => {
    const { store } = createStore({ nodes: [node('a', 0, 0, { selected: true }), node('b')] });
    store.setState({ multiSelectionActive: true });
    store.addSelectedNodes(['b']);
    expect(store.getState().nodes.map((n) => !!n.selected)).toEqual([true, true]);
  });

  it('unselectNodesAndEdges unselects the given or all elements', () => {
    const { store } = createStore({
      nodes: [node('a', 0, 0, { selected: true }), node('b', 0, 0, { selected: true })],
      edges: [edge('e', 'a', 'b', { selected: true })],
    });
    store.unselectNodesAndEdges({ nodes: [store.getState().nodes[0]!], edges: [] });
    expect(store.getState().nodes.map((n) => !!n.selected)).toEqual([false, true]);
    expect(store.getState().edges[0]?.selected).toBe(true);
    store.unselectNodesAndEdges();
    expect(store.getState().nodes.map((n) => !!n.selected)).toEqual([false, false]);
    expect(store.getState().edges[0]?.selected).toBe(false);
  });

  it('resetSelectedElements is a no-op when elements are not selectable', () => {
    const { store, events } = createStore({
      nodes: [node('a', 0, 0, { selected: true })],
      elementsSelectable: false,
    });
    store.resetSelectedElements();
    expect(events.some((e) => e.type === 'nodes-change')).toBe(false);
    expect(store.getState().nodes[0]?.selected).toBe(true);
  });

  it('selection actions share one gesture id and use origin select', () => {
    const { store, of } = createStore({
      nodes: [node('a'), node('b', 0, 0, { selected: true })],
      edges: [edge('e', 'a', 'b', { selected: true })],
    });
    store.addSelectedNodes(['a']);
    const metas = [...of('nodes-change'), ...of('edges-change')].map((e) => e.meta);
    expect(metas.length).toBe(2);
    expect(metas.every((m) => m.phase === 'discrete' && m.origin === 'select')).toBe(true);
    expect(new Set(metas.map((m) => m.gestureId)).size).toBe(1);
  });

  it('handleNodeSelection selects, and unselects on request or with multi-selection', () => {
    const { store } = createStore({ nodes: [node('a'), node('b')] });
    store.setState({ nodesSelectionActive: true });
    store.handleNodeSelection('a');
    expect(store.getState().nodes[0]?.selected).toBe(true);
    expect(store.getState().nodesSelectionActive).toBe(false);

    store.handleNodeSelection('a'); // already selected: stays
    expect(store.getState().nodes[0]?.selected).toBe(true);

    store.handleNodeSelection('a', true);
    expect(store.getState().nodes[0]?.selected).toBe(false);

    store.handleNodeSelection('a');
    store.setState({ multiSelectionActive: true });
    store.handleNodeSelection('a');
    expect(store.getState().nodes[0]?.selected).toBe(false);
  });

  it('handleNodeSelection reports error 012 for unknown nodes', () => {
    const { store, of } = createStore();
    store.handleNodeSelection('nope');
    expect(of('flow-error')[0]?.code).toBe('012');
  });

  it('handleEdgeSelection respects selectable and multi-selection', () => {
    const { store, of } = createStore({
      nodes: [node('a'), node('b')],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'a', 'b', { selectable: false })],
    });
    store.handleEdgeSelection('e2');
    expect(store.getState().edges[1]?.selected).toBeUndefined();
    store.handleEdgeSelection('e1');
    expect(store.getState().edges[0]?.selected).toBe(true);
    store.setState({ multiSelectionActive: true });
    store.handleEdgeSelection('e1');
    expect(store.getState().edges[0]?.selected).toBe(false);
    store.handleEdgeSelection('missing');
    expect(of('flow-error')[0]?.code).toBe('016');
  });
});

describe('moveSelectedNodes', () => {
  it('moves selected draggable nodes by 5px, 20px with factor 4', () => {
    const { store, of } = createStore({
      nodes: [
        node('a', 0, 0, { selected: true }),
        node('b', 50, 50),
        node('c', 10, 10, { selected: true, draggable: false }),
      ],
    });
    store.moveSelectedNodes({ x: 1, y: 0 }, 1);
    expect(store.getState().nodes[0]?.position).toEqual({ x: 5, y: 0 });
    expect(store.getState().nodes[1]?.position).toEqual({ x: 50, y: 50 });
    expect(store.getState().nodes[2]?.position).toEqual({ x: 10, y: 10 });
    store.moveSelectedNodes({ x: 0, y: -1 }, 4);
    expect(store.getState().nodes[0]?.position).toEqual({ x: 5, y: -20 });
    expect(of('nodes-change')[0]?.meta).toMatchObject({ phase: 'discrete', origin: 'keyboard' });
  });

  it('uses the snap grid as velocity when snapToGrid is on', () => {
    const { store } = createStore({
      nodes: [node('a', 0, 0, { selected: true })],
      snapToGrid: true,
      snapGrid: [20, 10],
    });
    store.moveSelectedNodes({ x: 1, y: 1 }, 1);
    expect(store.getState().nodes[0]?.position).toEqual({ x: 20, y: 10 });
  });

  it('respects nodesDraggable=false', () => {
    const { store, events } = createStore({
      nodes: [node('a', 0, 0, { selected: true })],
      nodesDraggable: false,
    });
    store.moveSelectedNodes({ x: 1, y: 0 }, 1);
    expect(events.some((e) => e.type === 'nodes-change')).toBe(false);
  });
});

describe('connection', () => {
  it('updateConnection and cancelConnection', () => {
    const { store } = createStore();
    store.updateConnection({ inProgress: true } as never);
    expect(store.getState().connection.inProgress).toBe(true);
    store.cancelConnection();
    expect(store.getState().connection.inProgress).toBe(false);
  });
});

describe('setOptions', () => {
  it('tells the pan/zoom engine about zoom limits and extents', () => {
    const { store } = createStore();
    const { panZoom, fn } = createFakePanZoom();
    store.setState({ panZoom });
    store.setOptions({ minZoom: 0.2 });
    expect(fn.setScaleExtent).toHaveBeenLastCalledWith([0.2, 2]);
    store.setOptions({ maxZoom: 8 });
    expect(fn.setScaleExtent).toHaveBeenLastCalledWith([0.2, 8]);
    expect(store.getState()).toMatchObject({ minZoom: 0.2, maxZoom: 8 });
    const calls = fn.setScaleExtent.mock.calls.length;
    store.setOptions({ minZoom: 0.2, maxZoom: 8 });
    expect(fn.setScaleExtent.mock.calls.length).toBe(calls);

    const extent: [[number, number], [number, number]] = [
      [0, 0],
      [100, 100],
    ];
    store.setOptions({ translateExtent: extent });
    expect(fn.setTranslateExtent).toHaveBeenCalledWith(extent);
    store.setOptions({
      translateExtent: [
        [0, 0],
        [100, 100],
      ],
    });
    expect(fn.setTranslateExtent).toHaveBeenCalledTimes(1);
  });

  it('snapGrid switches snapToGrid on unless snapToGrid is given', () => {
    const { store } = createStore();
    store.setOptions({ snapGrid: [10, 10] });
    expect(store.getState()).toMatchObject({ snapGrid: [10, 10], snapToGrid: true });
    store.setOptions({ snapGrid: [20, 20], snapToGrid: false });
    expect(store.getState()).toMatchObject({ snapGrid: [20, 20], snapToGrid: false });
  });

  it('merges ariaLabelConfig with the defaults', () => {
    const { store } = createStore();
    store.setOptions({ ariaLabelConfig: { 'controls.zoomIn.ariaLabel': 'Plus' } });
    const cfg = store.getState().ariaLabelConfig;
    expect(cfg['controls.zoomIn.ariaLabel']).toBe('Plus');
    expect(cfg['controls.zoomOut.ariaLabel']).toBe('Zoom Out');
  });

  it('re-adopts nodes when nodeOrigin, elevateNodesOnSelect or zIndexMode change', () => {
    const { store } = createStore({ nodes: [node('a', 100, 100)] });
    const v = store.getState().lookupVersion;
    store.setOptions({ nodeOrigin: [0.5, 0.5] });
    expect(store.getState().lookupVersion).toBe(v + 1);
    // origin is [0.5,0.5] and size 100x50 => absolute position moves by (-50,-25)
    expect(store.getState().nodeLookup.get('a')?.internals.positionAbsolute).toEqual({
      x: 50,
      y: 75,
    });
    store.setOptions({ nodeOrigin: [0.5, 0.5] });
    expect(store.getState().lookupVersion).toBe(v + 1);
    store.setOptions({ elevateNodesOnSelect: false });
    expect(store.getState().lookupVersion).toBe(v + 2);
    store.setOptions({ zIndexMode: 'manual' });
    expect(store.getState().lookupVersion).toBe(v + 3);
  });

  it('nodeExtent re-adopts and clamps existing nodes', () => {
    const { store } = createStore({ nodes: [node('a', 500, 500)] });
    store.setOptions({
      nodeExtent: [
        [0, 0],
        [200, 200],
      ],
    });
    expect(store.getState().nodeLookup.get('a')?.internals.positionAbsolute).toEqual({
      x: 100,
      y: 150,
    });
  });

  it('ignores undefined except for clearable options', () => {
    const isValid = () => true;
    const { store } = createStore({ isValidConnection: isValid, minZoom: 0.3 });
    store.setOptions({ minZoom: undefined, isValidConnection: undefined });
    expect(store.getState().minZoom).toBe(0.3);
    expect(store.getState().isValidConnection).toBeUndefined();
  });

  it('applies plain options and skips unchanged values', () => {
    const { store } = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.flush();
    listener.mockClear();
    store.setOptions({ nodesDraggable: true, connectionRadius: 20 });
    store.flush();
    expect(listener).not.toHaveBeenCalled();
    store.setOptions({ nodesDraggable: false, parallelEdges: 'spread', flowId: 'x' });
    expect(store.getState()).toMatchObject({
      nodesDraggable: false,
      parallelEdges: 'spread',
      flowId: 'x',
    });
  });

  it('assigns nodes and edges to an ArraySource', () => {
    const { store } = createStore();
    const nodes = [node('a')];
    store.setOptions({ nodes, edges: [edge('e', 'a', 'a')] });
    expect(store.getState().nodes).toBe(nodes);
    expect(store.getState().edges).toHaveLength(1);
  });
});

describe('viewport actions', () => {
  it('setViewportFromPanZoom mirrors the transform', () => {
    const { store } = createStore();
    store.setViewportFromPanZoom({ x: 1, y: 2, zoom: 3 });
    expect(store.getState().transform).toEqual([1, 2, 3]);
  });

  it('setCenter needs a pan/zoom engine and defaults to maxZoom', async () => {
    const { store } = createStore({ maxZoom: 4 });
    expect(await store.setCenter(10, 10)).toBe(false);
    const { panZoom, viewports } = createFakePanZoom();
    store.setState({ panZoom, width: 200, height: 100 });
    expect(await store.setCenter(10, 20)).toBe(true);
    expect(viewports[0]).toEqual({ x: 100 - 40, y: 50 - 80, zoom: 4 });
    await store.setCenter(10, 20, { zoom: 1 });
    expect(viewports[1]).toEqual({ x: 90, y: 30, zoom: 1 });
  });

  it('setMinZoom, setMaxZoom, setTranslateExtent update the engine and state', () => {
    const { store } = createStore();
    const { panZoom, fn } = createFakePanZoom();
    store.setState({ panZoom });
    store.setMinZoom(0.1);
    store.setMaxZoom(5);
    store.setTranslateExtent([
      [0, 0],
      [1, 1],
    ]);
    expect(fn.setScaleExtent).toHaveBeenNthCalledWith(1, [0.1, 2]);
    expect(fn.setScaleExtent).toHaveBeenNthCalledWith(2, [0.1, 5]);
    expect(store.getState()).toMatchObject({
      minZoom: 0.1,
      maxZoom: 5,
      translateExtent: [
        [0, 0],
        [1, 1],
      ],
    });
  });

  it('panBy delegates to the engine', async () => {
    const { store } = createStore();
    const { panZoom, fn } = createFakePanZoom();
    fn.setViewportConstrained.mockResolvedValue({ k: 1, x: 5, y: 5 } as never);
    store.setState({ panZoom, width: 100, height: 100 });
    expect(await store.panBy({ x: 5, y: 5 })).toBe(true);
    expect(fn.setViewportConstrained).toHaveBeenCalled();
  });
});

describe('fitView', () => {
  const ready = (store: FlowStore) => {
    const fake = createFakePanZoom();
    store.setState({ panZoom: fake.panZoom, width: 800, height: 600 });
    return fake;
  };

  it('queues until nodes are measured, then fits and resolves true', async () => {
    const { store } = createStore({ nodes: [bareNode('a'), bareNode('b', 300, 200)] });
    const fake = ready(store);
    let resolved: boolean | undefined;
    const promise = store.fitView({ padding: 0.2 }).then((r) => (resolved = r));
    expect(store.getState().fitViewQueued).toBe(true);
    await tick();
    expect(resolved).toBeUndefined();
    expect(fake.fn.setViewport).not.toHaveBeenCalled();

    store.triggerNodeChanges(
      [
        { id: 'a', type: 'dimensions', dimensions: { width: 100, height: 50 } },
        { id: 'b', type: 'dimensions', dimensions: { width: 100, height: 50 } },
      ],
      { phase: 'discrete', origin: 'measure' },
    );
    await promise;
    expect(resolved).toBe(true);
    expect(fake.fn.setViewport).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({
      fitViewQueued: false,
      fitViewResolver: null,
      fitViewOptions: undefined,
    });
  });

  it('resolves immediately when already initialised', async () => {
    const { store } = createStore({ nodes: [node('a'), node('b', 300, 200)] });
    const fake = ready(store);
    expect(await store.fitView()).toBe(true);
    expect(fake.viewports).toHaveLength(1);
    const v = fake.viewports[0]!;
    expect(v.zoom).toBeGreaterThan(0.5);
  });

  it('shares one promise between repeated calls', async () => {
    const { store } = createStore({ nodes: [bareNode('a')] });
    ready(store);
    const p1 = store.fitView();
    const p2 = store.fitView();
    expect(p1).toBe(p2);
    store.triggerNodeChanges(
      [{ id: 'a', type: 'dimensions', dimensions: { width: 10, height: 10 } }],
      { phase: 'discrete', origin: 'measure' },
    );
    expect(await p1).toBe(true);
  });

  it('stays queued without a pan/zoom engine and fits when resolveFitView is called after it appears', async () => {
    const { store } = createStore({ nodes: [node('a')] });
    const promise = store.fitView();
    await tick();
    expect(store.getState().fitViewQueued).toBe(true);
    const fake = ready(store);
    await store.resolveFitView();
    expect(await promise).toBe(true);
    expect(fake.viewports).toHaveLength(1);
  });

  it('waits for a non-zero container size', async () => {
    const { store } = createStore({ nodes: [node('a')] });
    const fake = createFakePanZoom();
    store.setState({ panZoom: fake.panZoom });
    const promise = store.fitView();
    await store.resolveFitView();
    expect(fake.viewports).toHaveLength(0);
    store.setState({ width: 100, height: 100 });
    await store.resolveFitView();
    expect(await promise).toBe(true);
  });

  it('the initial fitView option is resolved once nodes are initialised', async () => {
    const { store } = createStore({ nodes: [node('a')], fitView: true });
    const fake = ready(store);
    expect(store.getState().fitViewQueued).toBe(true);
    await store.resolveFitView();
    expect(fake.viewports).toHaveLength(1);
    expect(store.getState().fitViewQueued).toBe(false);
  });

  it('timeout fallback: fits the measured nodes when others never get measured', async () => {
    vi.useFakeTimers();
    const { store } = createStore({
      nodes: [node('a'), bareNode('b', 400, 0)],
    });
    const fake = ready(store);
    expect(store.getState().nodesInitialized).toBe(false);
    const promise = store.fitView({ timeout: 100 });
    await vi.advanceTimersByTimeAsync(99);
    expect(fake.viewports).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2);
    expect(await promise).toBe(true);
    expect(fake.viewports).toHaveLength(1);
    expect(store.getState().fitViewQueued).toBe(false);
  });

  it('timeout fallback: uses 400ms by default', async () => {
    vi.useFakeTimers();
    const { store } = createStore({ nodes: [node('a'), bareNode('b')] });
    const fake = ready(store);
    void store.fitView();
    await vi.advanceTimersByTimeAsync(399);
    expect(fake.viewports).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2);
    expect(fake.viewports).toHaveLength(1);
  });

  it('timeout fallback: resolves false when nothing was measured', async () => {
    vi.useFakeTimers();
    const { store } = createStore({ nodes: [bareNode('a')] });
    const fake = ready(store);
    const promise = store.fitView({ timeout: 50 });
    await vi.advanceTimersByTimeAsync(60);
    expect(await promise).toBe(false);
    expect(fake.viewports).toHaveLength(0);
    expect(store.getState().fitViewQueued).toBe(false);
  });

  it('timeout that fires before the engine exists still fits once it appears', async () => {
    vi.useFakeTimers();
    const { store } = createStore({ nodes: [node('a'), bareNode('b')] });
    const promise = store.fitView({ timeout: 50 });
    await vi.advanceTimersByTimeAsync(60);
    expect(store.getState().fitViewQueued).toBe(true);
    const fake = ready(store);
    await store.resolveFitView();
    expect(await promise).toBe(true);
    expect(fake.viewports).toHaveLength(1);
  });

  it('does not run the timer fallback after a normal resolution', async () => {
    vi.useFakeTimers();
    const { store } = createStore({ nodes: [node('a')] });
    const fake = ready(store);
    await store.fitView();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fake.viewports).toHaveLength(1);
  });

  it('fitting an empty flow resolves true without moving the viewport', async () => {
    const { store } = createStore();
    const fake = ready(store);
    expect(await store.fitView()).toBe(true);
    expect(fake.viewports).toHaveLength(0);
  });

  it('reset() clears runtime state and settles a pending fitView with false', async () => {
    const { store } = createStore({ nodes: [bareNode('a')] });
    ready(store);
    const promise = store.fitView();
    store.reset();
    expect(await promise).toBe(false);
    expect(store.getState()).toMatchObject({
      panZoom: null,
      width: 0,
      transform: [0, 0, 1],
      fitViewQueued: false,
    });
    expect(store.getState().nodes).toHaveLength(1);
  });
});

describe('host, events and errors', () => {
  it('emit returns true without a host', () => {
    const store = new FlowStore();
    expect(store.emit('pane-click', { event: {} as MouseEvent }, true)).toBe(true);
  });

  it('reportError emits a cancelable flow-error and warns in dev unless prevented', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store, events, prevent } = createStore();
    store.reportError('008', 'missing handle');
    expect(events.at(-1)).toMatchObject({
      type: 'flow-error',
      cancelable: true,
      detail: { code: '008', message: 'missing handle' },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('[XY Lit]');
    prevent.add('flow-error');
    store.reportError('008', 'again');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('setHost(null) detaches', () => {
    const { store, events } = createStore();
    store.setHost(null);
    store.reportError('x', 'y');
    expect(events).toHaveLength(0);
  });
});

describe('updateNodeInternals', () => {
  it('does nothing when the engine reports no update', () => {
    const { store, events } = createStore({ nodes: [node('a')] });
    const v = store.getState().lookupVersion;
    store.updateNodeInternals(new Map());
    expect(store.getState().lookupVersion).toBe(v);
    expect(events.some((e) => e.type === 'nodes-change')).toBe(false);
  });
});
