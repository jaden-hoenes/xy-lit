import { describe, expect, it, vi } from 'vitest';
import { getStoreOf } from '../src/instance.js';
import { ArraySource } from '../src/sources/array-source.js';
import type { FlowDataSource } from '../src/types/source.js';
import type { Edge } from '../src/types/edges.js';
import type { Node } from '../src/types/nodes.js';
import { bareNode, createFakePanZoom, createStore, edge, node, tick } from './helpers.js';

describe('setNodes / setEdges batching', () => {
  it('folds two calls in one tick into one change event', async () => {
    const { store, of } = createStore({ nodes: [node('a')] });
    const { instance } = store;
    instance.setNodes((nodes) => [...nodes, node('b')]);
    instance.setNodes((nodes) => [...nodes, node('c')]);
    expect(store.getState().nodes).toHaveLength(1);
    await tick();
    const events = of('nodes-change');
    expect(events).toHaveLength(1);
    expect(events[0]?.meta).toMatchObject({ phase: 'discrete', origin: 'api' });
    expect(events[0]?.changes.map((c) => c.type)).toEqual(['add', 'add']);
    expect(store.getState().nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('an array payload replaces, later function payloads see it', async () => {
    const { store } = createStore({ nodes: [node('a')] });
    store.instance.setNodes([node('x')]);
    store.instance.setNodes((nodes) => nodes.map((n) => ({ ...n, selected: true })));
    await tick();
    expect(store.getState().nodes).toMatchObject([{ id: 'x', selected: true }]);
  });

  it('diffs against the lookup: replace for changed objects, remove for missing ones', async () => {
    const a = node('a');
    const { store, of } = createStore({ nodes: [a, node('b')] });
    store.instance.setNodes([{ ...a, selected: true }]);
    await tick();
    expect(of('nodes-change')[0]?.changes.map((c) => c.type)).toEqual(['replace', 'remove']);
  });

  it('takes the next array verbatim (snapshot), including order', async () => {
    const { store } = createStore({ nodes: [node('a'), node('b')] });
    const [a, b] = store.getState().nodes;
    const next = [b!, { ...a!, selected: true }];
    store.instance.setNodes(next);
    await tick();
    expect(store.getState().nodes).toBe(next);
  });

  it('emits nothing when nothing changed', async () => {
    const { store, events } = createStore({ nodes: [node('a')] });
    store.instance.setNodes((nodes) => nodes);
    store.instance.setEdges((edges) => edges);
    await tick();
    expect(events.some((e) => e.type === 'nodes-change' || e.type === 'edges-change')).toBe(false);
  });

  it('setEdges batches and carries the snapshot', async () => {
    const { store, of } = createStore({
      nodes: [node('a'), node('b')],
      edges: [edge('e1', 'a', 'b')],
    });
    store.instance.setEdges((edges) => [...edges, edge('e2', 'b', 'a')]);
    store.instance.setEdges((edges) => edges.filter((e) => e.id !== 'e1'));
    await tick();
    expect(of('edges-change')).toHaveLength(1);
    expect(store.getState().edges.map((e) => e.id)).toEqual(['e2']);
  });

  it('controlled: the app receives the changes and the source stays put', async () => {
    const { store, of, prevent } = createStore({ nodes: [node('a')] });
    prevent.add('nodes-change');
    store.instance.setNodes([node('a'), node('b')]);
    await tick();
    expect(of('nodes-change')).toHaveLength(1);
    expect(store.getState().nodes).toHaveLength(1);
  });

  it('runs the middlewares', async () => {
    const { store } = createStore({ nodes: [node('a')] });
    store.addNodeChangeMiddleware((changes) => changes.filter((c) => c.type !== 'add'));
    store.instance.setNodes((nodes) => [...nodes, node('b')]);
    await tick();
    expect(store.getState().nodes).toHaveLength(1);
  });
});

describe('graph accessors', () => {
  it('has a stable identity and exposes its store', () => {
    const { store } = createStore();
    expect(store.instance).toBe(store.instance);
    expect(getStoreOf(store.instance)).toBe(store);
    expect(Object.keys(store.instance)).not.toContain('Symbol(xy-lit.store)');
    expect(() => getStoreOf({} as never)).toThrow();
  });

  it('getNodes/getEdges return shallow copies without the remote field', () => {
    const remote = { selectedBy: [] };
    const { store } = createStore({
      nodes: [node('a', 0, 0, { remote })],
      edges: [edge('e', 'a', 'a')],
    });
    const nodes = store.instance.getNodes();
    expect(nodes[0]).not.toBe(store.getState().nodes[0]);
    expect(nodes[0]).not.toHaveProperty('remote');
    expect(store.getState().nodes[0]).toHaveProperty('remote');
    expect(store.instance.getEdges()[0]).not.toBe(store.getState().edges[0]);
    expect(store.instance.toObject().nodes[0]).not.toHaveProperty('remote');
  });

  it('getNode returns the user node, getInternalNode the engine node, getEdge the edge', () => {
    const { store } = createStore({ nodes: [node('a')], edges: [edge('e', 'a', 'a')] });
    expect(store.instance.getNode('a')).toBe(store.getState().nodes[0]);
    expect(store.instance.getInternalNode('a')?.internals.positionAbsolute).toEqual({ x: 0, y: 0 });
    expect(store.instance.getEdge('e')).toBe(store.getState().edges[0]);
    expect(store.instance.getNode('nope')).toBeUndefined();
  });

  it('toObject includes the viewport', () => {
    const { store } = createStore({ nodes: [node('a')] });
    store.setViewportFromPanZoom({ x: 5, y: 6, zoom: 2 });
    expect(store.instance.toObject().viewport).toEqual({ x: 5, y: 6, zoom: 2 });
  });

  it('getHandleConnections and getNodeConnections read the connection lookup', () => {
    const { store } = createStore({
      nodes: [node('a'), node('b'), node('c')],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'a', 'c', { sourceHandle: 'h' })],
    });
    const { instance } = store;
    expect(
      instance
        .getNodeConnections({ nodeId: 'a' })
        .map((c) => c.edgeId)
        .sort(),
    ).toEqual(['e1', 'e2']);
    expect(instance.getNodeConnections({ nodeId: 'a', type: 'source' })).toHaveLength(2);
    expect(
      instance
        .getNodeConnections({ nodeId: 'a', type: 'source', handleId: 'h' })
        .map((c) => c.edgeId),
    ).toEqual(['e2']);
    expect(instance.getNodeConnections({ nodeId: 'a', type: 'target' })).toHaveLength(0);
    expect(instance.getHandleConnections({ nodeId: 'b', type: 'target' })).toHaveLength(1);
    expect(
      instance.getHandleConnections({ nodeId: 'a', type: 'source', id: 'h' })[0],
    ).toMatchObject({ edgeId: 'e2', target: 'c' });
  });

  it('getNodesBounds', () => {
    const { store } = createStore({ nodes: [node('a', 0, 0), node('b', 200, 100)] });
    expect(store.instance.getNodesBounds(['a', 'b'])).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 150,
    });
  });

  it('getIntersectingNodes / isNodeIntersecting', () => {
    const { store } = createStore({
      nodes: [node('a', 0, 0), node('b', 50, 20), node('c', 500, 500), node('d', 100, 0)],
    });
    const { instance } = store;
    expect(instance.getIntersectingNodes({ id: 'a' }).map((n) => n.id)).toEqual(['b']);
    expect(instance.getIntersectingNodes({ id: 'a' }, false).map((n) => n.id)).toEqual([]);
    expect(
      instance.getIntersectingNodes({ x: 480, y: 480, width: 100, height: 100 }).map((n) => n.id),
    ).toEqual(['c']);
    expect(instance.isNodeIntersecting({ id: 'a' }, { x: 90, y: 0, width: 50, height: 50 })).toBe(
      true,
    );
    expect(instance.isNodeIntersecting({ id: 'c' }, { x: 0, y: 0, width: 50, height: 50 })).toBe(
      false,
    );
    expect(
      instance.isNodeIntersecting({ id: 'missing' }, { x: 0, y: 0, width: 1, height: 1 }),
    ).toBe(false);
  });
});

describe('updateNode / updateEdge / updateNodeData', () => {
  it('updateNode merges (batched) and can replace', async () => {
    const { store } = createStore({ nodes: [node('a', 0, 0, { data: { n: 1 } })] });
    store.instance.updateNode('a', { selected: true });
    store.instance.updateNode('a', (n) => ({ position: { x: n.position.x + 5, y: 0 } }));
    await tick();
    expect(store.getState().nodes[0]).toMatchObject({
      selected: true,
      position: { x: 5, y: 0 },
      data: { n: 1 },
    });

    store.instance.updateNode('a', node('a', 9, 9), { replace: true });
    await tick();
    expect(store.getState().nodes[0]).toMatchObject({ position: { x: 9, y: 9 } });
    expect(store.getState().nodes[0]?.selected).toBeUndefined();
  });

  it('updateNodeData merges or replaces data (default path)', async () => {
    const { store, of } = createStore({ nodes: [node('a', 0, 0, { data: { x: 1, y: 2 } })] });
    store.instance.updateNodeData('a', { y: 3 });
    store.instance.updateNodeData('a', (n) => ({ x: (n.data.x as number) + 10 }));
    await tick();
    expect(store.getState().nodes[0]?.data).toEqual({ x: 11, y: 3 });
    expect(of('nodes-change')).toHaveLength(1);
    store.instance.updateNodeData('a', { only: true }, { replace: true });
    await tick();
    expect(store.getState().nodes[0]?.data).toEqual({ only: true });
  });

  it('updateEdge and updateEdgeData', async () => {
    const { store } = createStore({
      nodes: [node('a')],
      edges: [edge('e', 'a', 'a', { data: { w: 1 } })],
    });
    store.instance.updateEdge('e', { animated: true });
    store.instance.updateEdgeData('e', { w: 2, z: 3 });
    await tick();
    expect(store.getState().edges[0]).toMatchObject({ animated: true, data: { w: 2, z: 3 } });
  });

  describe('source fast path', () => {
    function fastSource(nodes: Node[], edges: Edge[] = []) {
      const array = new ArraySource(nodes, edges);
      const calls = { data: vi.fn(), edgeData: vi.fn(), applyNodes: vi.fn(), applyEdges: vi.fn() };
      const source: FlowDataSource = {
        get nodes() {
          return array.nodes;
        },
        get edges() {
          return array.edges;
        },
        subscribe: (l) => array.subscribe(l),
        applyNodeChanges: (changes, meta) => {
          calls.applyNodes(changes, meta);
          array.applyNodeChanges(changes, meta);
        },
        applyEdgeChanges: (changes, meta) => {
          calls.applyEdges(changes, meta);
          array.applyEdgeChanges(changes, meta);
        },
        updateNodeData: (id, patch, meta) => {
          calls.data(id, patch, meta);
          array.replaceNodes(
            array.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
          );
        },
        updateEdgeData: (id, patch, meta) => {
          calls.edgeData(id, patch, meta);
          array.replaceEdges(
            array.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...patch } } : e)),
          );
        },
      };
      return { source, calls };
    }

    it('calls source.updateNodeData with the patch instead of applyNodeChanges', () => {
      const { store, of } = createStore();
      const { source, calls } = fastSource([node('a', 0, 0, { data: { x: 1 } })]);
      store.setSource(source);
      store.instance.updateNodeData('a', { y: 2 });
      expect(calls.data).toHaveBeenCalledWith('a', { y: 2 }, { phase: 'discrete', origin: 'api' });
      expect(calls.applyNodes).not.toHaveBeenCalled();
      expect(store.getState().nodes[0]?.data).toEqual({ x: 1, y: 2 });
      const event = of('nodes-change')[0]!;
      expect(event.changes).toHaveLength(1);
      expect(event.changes[0]).toMatchObject({
        type: 'replace',
        id: 'a',
        item: { data: { x: 1, y: 2 } },
      });
    });

    it('evaluates function updates with the current node', () => {
      const { store } = createStore();
      const { source, calls } = fastSource([node('a', 0, 0, { data: { x: 1 } })]);
      store.setSource(source);
      store.instance.updateNodeData('a', (n) => ({ x: (n.data.x as number) + 1 }));
      expect(calls.data).toHaveBeenCalledWith('a', { x: 2 }, expect.anything());
    });

    it('does nothing when a listener prevents nodes-change', () => {
      const { store, prevent } = createStore();
      const { source, calls } = fastSource([node('a')]);
      store.setSource(source);
      prevent.add('nodes-change');
      store.instance.updateNodeData('a', { y: 2 });
      expect(calls.data).not.toHaveBeenCalled();
    });

    it('lets a middleware drop the change', () => {
      const { store } = createStore();
      const { source, calls } = fastSource([node('a')]);
      store.setSource(source);
      store.addNodeChangeMiddleware(() => []);
      store.instance.updateNodeData('a', { y: 2 });
      expect(calls.data).not.toHaveBeenCalled();
      expect(calls.applyNodes).not.toHaveBeenCalled();
    });

    it('falls back to applyNodeChanges when a middleware rewrote the change', () => {
      const { store } = createStore();
      const { source, calls } = fastSource([node('a', 0, 0, { data: { x: 1 } })]);
      store.setSource(source);
      store.addNodeChangeMiddleware((changes) =>
        changes.map((c) =>
          c.type === 'replace' ? { ...c, item: { ...c.item, data: { x: 'rewritten' } } } : c,
        ),
      );
      store.instance.updateNodeData('a', { y: 2 });
      expect(calls.data).not.toHaveBeenCalled();
      expect(calls.applyNodes).toHaveBeenCalledTimes(1);
      expect(store.getState().nodes[0]?.data).toEqual({ x: 'rewritten' });
    });

    it('replace: true goes through the generic path', async () => {
      const { store } = createStore();
      const { source, calls } = fastSource([node('a', 0, 0, { data: { x: 1 } })]);
      store.setSource(source);
      store.instance.updateNodeData('a', { z: 1 }, { replace: true });
      await tick();
      expect(calls.data).not.toHaveBeenCalled();
      expect(calls.applyNodes).toHaveBeenCalled();
      expect(store.getState().nodes[0]?.data).toEqual({ z: 1 });
    });

    it('ignores unknown ids', () => {
      const { store } = createStore();
      const { source, calls } = fastSource([node('a')]);
      store.setSource(source);
      store.instance.updateNodeData('nope', { y: 1 });
      store.instance.updateEdgeData('nope', { y: 1 });
      expect(calls.data).not.toHaveBeenCalled();
      expect(calls.edgeData).not.toHaveBeenCalled();
    });

    it('uses source.updateEdgeData for edges', () => {
      const { store, of } = createStore();
      const { source, calls } = fastSource([node('a')], [edge('e', 'a', 'a', { data: { w: 1 } })]);
      store.setSource(source);
      store.instance.updateEdgeData('e', { z: 2 });
      expect(calls.edgeData).toHaveBeenCalledWith(
        'e',
        { z: 2 },
        { phase: 'discrete', origin: 'api' },
      );
      expect(calls.applyEdges).not.toHaveBeenCalled();
      expect(of('edges-change')[0]?.changes[0]).toMatchObject({ type: 'replace', id: 'e' });
      expect(store.getState().edges[0]?.data).toEqual({ w: 1, z: 2 });
    });
  });
});

describe('addNodes / addEdges', () => {
  it('adds nodes with a position as they are', () => {
    const { store, of } = createStore({ nodes: [node('a')] });
    store.instance.addNodes([node('b', 300, 300)]);
    expect(store.getState().nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(of('nodes-change')[0]?.changes[0]).toMatchObject({ type: 'add' });
    expect(of('nodes-change')[0]?.meta).toMatchObject({ phase: 'discrete', origin: 'api' });
  });

  it('accepts a single node', () => {
    const { store } = createStore();
    store.instance.addNodes(node('a', 1, 2));
    expect(store.getState().nodes).toHaveLength(1);
  });

  it('places nodes without a position into free space, without overlapping each other or existing nodes', () => {
    const { store } = createStore({ nodes: [node('existing', 0, 0)] });
    store.setState({ width: 200, height: 100 }); // viewport centre = flow (100, 50)
    const { position: _p, ...bare } = node('x');
    void _p;
    store.instance.addNodes([
      { ...bare, id: 'n1' },
      { ...bare, id: 'n2' },
      { ...bare, id: 'n3' },
    ]);
    const nodes = store.getState().nodes;
    expect(nodes).toHaveLength(4);
    const rects = nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, w: 100, h: 50 }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('uses width/height, initialWidth/initialHeight or the default size for placement', () => {
    const { store } = createStore();
    const { position: _p, ...bare } = node('x');
    void _p;
    store.instance.addNodes([
      { ...bare, id: 'big', width: 1000, height: 1000, measured: undefined },
    ]);
    store.instance.addNodes([
      {
        ...bare,
        id: 'next',
        width: undefined,
        height: undefined,
        initialWidth: 80,
        initialHeight: 20,
      },
    ]);
    const [big, next] = store.getState().nodes;
    // the second one is placed beside the 1000x1000 node, not on top of it
    expect(
      next!.position.x >= big!.position.x + 1000 ||
        next!.position.y >= big!.position.y + 1000 ||
        next!.position.x + 80 <= big!.position.x ||
        next!.position.y + 20 <= big!.position.y,
    ).toBe(true);
  });

  it('converts child placement to parent-relative positions', () => {
    const { store } = createStore({
      nodes: [
        node('p', 1000, 1000, { width: 400, height: 400, measured: { width: 400, height: 400 } }),
      ],
    });
    store.setState({ width: 0, height: 0 });
    const { position: _p, ...bare } = node('c');
    void _p;
    store.instance.addNodes(
      { ...bare, id: 'c', parentId: 'p' },
      { placement: { around: { x: 1100, y: 1100 } } },
    );
    const child = store.getState().nodes.find((n) => n.id === 'c')!;
    // centred on (1100, 1100) in flow space = top-left (1050, 1075) = (50, 75) inside the parent
    expect(child.position).toEqual({ x: 50, y: 75 });
  });

  it('keeps call order with a queued setNodes', async () => {
    const { store } = createStore({ nodes: [node('a')] });
    store.instance.setNodes((nodes) => [...nodes, node('queued', 500, 500)]);
    store.instance.addNodes(node('added', 700, 700));
    await tick();
    expect(store.getState().nodes.map((n) => n.id)).toEqual(['a', 'queued', 'added']);
  });

  it('addEdges triggers add changes', () => {
    const { store, of } = createStore({ nodes: [node('a'), node('b')] });
    store.instance.addEdges([edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]);
    expect(store.getState().edges.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(of('edges-change')[0]?.meta).toMatchObject({ phase: 'discrete', origin: 'api' });
    store.instance.addEdges(edge('e3', 'a', 'a'));
    expect(store.getState().edges).toHaveLength(3);
  });
});

describe('deleteElements', () => {
  const graph = () =>
    createStore({
      nodes: [node('a'), node('b'), node('c'), node('child', 0, 0, { parentId: 'a' })],
      edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('free', 'c', 'c')],
    });

  it('removes nodes with their connected edges and children, in React event order', async () => {
    const { store, events } = graph();
    const result = await store.instance.deleteElements({ nodes: [{ id: 'a' }] });
    expect(result.deletedNodes.map((n) => n.id)).toEqual(['a', 'child']);
    expect(result.deletedEdges.map((e) => e.id)).toEqual(['ab']);
    expect(store.getState().nodes.map((n) => n.id)).toEqual(['b', 'c']);
    expect(store.getState().edges.map((e) => e.id)).toEqual(['bc', 'free']);
    expect(
      events
        .filter((e) =>
          ['edges-delete', 'edges-change', 'nodes-delete', 'nodes-change', 'delete'].includes(
            e.type,
          ),
        )
        .map((e) => e.type),
    ).toEqual(['edges-delete', 'edges-change', 'nodes-delete', 'nodes-change', 'delete']);
  });

  it('uses origin delete and one shared gesture id for both triggers', async () => {
    const { store, of } = graph();
    await store.instance.deleteElements({ nodes: [{ id: 'a' }] });
    const nodesMeta = of('nodes-change')[0]!.meta;
    const edgesMeta = of('edges-change')[0]!.meta;
    expect(nodesMeta).toMatchObject({ phase: 'discrete', origin: 'delete' });
    expect(nodesMeta.gestureId).toBeDefined();
    expect(nodesMeta.gestureId).toBe(edgesMeta.gestureId);
  });

  it('deletes only edges', async () => {
    const { store, events } = graph();
    const result = await store.instance.deleteElements({ edges: [{ id: 'free' }] });
    expect(result.deletedNodes).toEqual([]);
    expect(result.deletedEdges.map((e) => e.id)).toEqual(['free']);
    expect(events.some((e) => e.type === 'nodes-delete')).toBe(false);
    expect(events.some((e) => e.type === 'nodes-change')).toBe(false);
    expect(events.some((e) => e.type === 'delete')).toBe(true);
  });

  it('respects deletable: false', async () => {
    const { store } = createStore({
      nodes: [node('a', 0, 0, { deletable: false }), node('b')],
      edges: [edge('e', 'a', 'b', { deletable: false })],
    });
    const result = await store.instance.deleteElements({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ id: 'e' }],
    });
    expect(result.deletedNodes.map((n) => n.id)).toEqual(['b']);
    expect(result.deletedEdges).toEqual([]);
  });

  it('onBeforeDelete returning false cancels everything', async () => {
    const { store, events } = graph();
    const onBeforeDelete = vi.fn(() => Promise.resolve(false));
    store.setOptions({ onBeforeDelete });
    const result = await store.instance.deleteElements({ nodes: [{ id: 'a' }] });
    expect(onBeforeDelete).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ deletedNodes: [], deletedEdges: [] });
    expect(store.getState().nodes).toHaveLength(4);
    expect(events.some((e) => e.type === 'delete')).toBe(false);
  });

  it('onBeforeDelete returning a subset deletes only that', async () => {
    const { store } = graph();
    store.setOptions({
      onBeforeDelete: ({ nodes, edges }) =>
        Promise.resolve({
          nodes: nodes.filter((n) => n.id === 'a'),
          edges: edges.filter(() => false),
        }),
    });
    const result = await store.instance.deleteElements({ nodes: [{ id: 'a' }] });
    expect(result.deletedNodes.map((n) => n.id)).toEqual(['a']);
    expect(result.deletedEdges).toEqual([]);
    expect(store.getState().nodes.map((n) => n.id)).toEqual(['b', 'c', 'child']);
    expect(store.getState().edges.map((e) => e.id)).toEqual(['ab', 'bc', 'free']);
  });

  it('does nothing when nothing matches', async () => {
    const { store, events } = graph();
    const result = await store.instance.deleteElements({ nodes: [{ id: 'zzz' }] });
    expect(result).toEqual({ deletedNodes: [], deletedEdges: [] });
    expect(events.filter((e) => e.type !== 'nodes-initialized')).toHaveLength(0);
  });

  it('wraps both triggers in source.transact', async () => {
    const { store, events } = graph();
    const order: string[] = [];
    const array = store.source as ArraySource;
    const source: FlowDataSource = {
      get nodes() {
        return array.nodes;
      },
      get edges() {
        return array.edges;
      },
      subscribe: (l) => array.subscribe(l),
      applyNodeChanges: (c, m) => {
        order.push('nodes');
        array.applyNodeChanges(c, m);
      },
      applyEdgeChanges: (c, m) => {
        order.push('edges');
        array.applyEdgeChanges(c, m);
      },
      transact: (fn, origin) => {
        order.push(`begin:${String(origin)}`);
        fn();
        order.push('end');
      },
    };
    store.setSource(source);
    events.length = 0;
    await store.instance.deleteElements({ nodes: [{ id: 'a' }] });
    expect(order).toEqual(['begin:delete', 'edges', 'nodes', 'end']);
  });

  it('flushes queued setNodes first', async () => {
    const { store } = graph();
    store.instance.setNodes((nodes) => [...nodes, node('late')]);
    const result = await store.instance.deleteElements({ nodes: [{ id: 'late' }] });
    expect(result.deletedNodes.map((n) => n.id)).toEqual(['late']);
  });
});

describe('viewport helpers', () => {
  it('return false without a pan/zoom engine', async () => {
    const { store } = createStore();
    const { instance } = store;
    expect(instance.viewportInitialized).toBe(false);
    expect(await instance.zoomIn()).toBe(false);
    expect(await instance.zoomOut()).toBe(false);
    expect(await instance.zoomTo(1)).toBe(false);
    expect(await instance.setViewport({ x: 1 })).toBe(false);
    expect(await instance.fitBounds({ x: 0, y: 0, width: 1, height: 1 })).toBe(false);
    expect(await instance.setCenter(0, 0)).toBe(false);
  });

  it('delegate to the engine', async () => {
    const { store } = createStore();
    const { panZoom, fn, viewports } = createFakePanZoom();
    store.setState({ panZoom, width: 400, height: 300, transform: [10, 20, 2] });
    const { instance } = store;
    expect(instance.viewportInitialized).toBe(true);
    await instance.zoomIn({ duration: 5 });
    expect(fn.scaleBy).toHaveBeenLastCalledWith(1.2, { duration: 5 });
    await instance.zoomOut();
    expect(fn.scaleBy).toHaveBeenLastCalledWith(1 / 1.2, undefined);
    await instance.zoomTo(1.5);
    expect(fn.scaleTo).toHaveBeenLastCalledWith(1.5, undefined);
    expect(instance.getZoom()).toBe(2);
    expect(instance.getViewport()).toEqual({ x: 10, y: 20, zoom: 2 });

    expect(await instance.setViewport({ x: 99 })).toBe(true);
    expect(viewports.at(-1)).toEqual({ x: 99, y: 20, zoom: 2 });

    expect(await instance.fitBounds({ x: 0, y: 0, width: 200, height: 100 })).toBe(true);
    expect(viewports.at(-1)!.zoom).toBeGreaterThan(0);
    expect(await instance.setCenter(0, 0, { zoom: 1 })).toBe(true);
    expect(viewports.at(-1)).toEqual({ x: 200, y: 150, zoom: 1 });
  });

  it('fitView forwards to the store', async () => {
    const { store } = createStore({ nodes: [node('a')] });
    const { panZoom, viewports } = createFakePanZoom();
    store.setState({ panZoom, width: 400, height: 300 });
    expect(await store.instance.fitView()).toBe(true);
    expect(viewports).toHaveLength(1);
  });

  it('screenToFlowPosition and flowToScreenPosition use the dom node rect', () => {
    const { store } = createStore();
    const { instance } = store;
    expect(instance.screenToFlowPosition({ x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
    expect(instance.flowToScreenPosition({ x: 5, y: 5 })).toEqual({ x: 5, y: 5 });

    const domNode = {
      getBoundingClientRect: () => ({ x: 100, y: 50 }),
    } as unknown as HTMLDivElement;
    store.setState({ domNode, transform: [20, 10, 2] });
    expect(instance.screenToFlowPosition({ x: 160, y: 90 })).toEqual({ x: 20, y: 15 });
    expect(instance.flowToScreenPosition({ x: 20, y: 15 })).toEqual({ x: 160, y: 90 });

    expect(
      instance.screenToFlowPosition({ x: 161, y: 91 }, { snapToGrid: true, snapGrid: [10, 10] }),
    ).toEqual({ x: 20, y: 20 });
    store.setOptions({ snapToGrid: true, snapGrid: [10, 10] });
    expect(instance.screenToFlowPosition({ x: 161, y: 91 })).toEqual({ x: 20, y: 20 });
    expect(instance.screenToFlowPosition({ x: 161, y: 91 }, { snapToGrid: false })).toEqual({
      x: 20.5,
      y: 15.5,
    });
  });
});

describe('updateNodeInternals', () => {
  it('forwards to requestNodeMeasure when set, no-ops otherwise', () => {
    const { store } = createStore({ nodes: [bareNode('a')] });
    expect(() => store.instance.updateNodeInternals('a')).not.toThrow();
    const request = vi.fn();
    store.requestNodeMeasure = request;
    store.instance.updateNodeInternals('a');
    store.instance.updateNodeInternals(['a', 'b']);
    expect(request).toHaveBeenNthCalledWith(1, ['a']);
    expect(request).toHaveBeenNthCalledWith(2, ['a', 'b']);
  });
});
