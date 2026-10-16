import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArraySource, applyNodeChanges, applyEdgeChanges } from '@xy-lit/store';
import type { FlowHistory } from '@xy-lit/store';
import { LocalHistory } from '../src/index.js';
import {
  cleanup,
  dragNode,
  edge,
  frames,
  mountFlow,
  node,
  nodeEl,
  pos,
  waitFor,
} from './helpers.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const flowWith = async () =>
  mountFlow({
    nodes: [node('a', 0, 0), node('b', 300, 0), node('c', 0, 200)],
    edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')],
  });

describe('LocalHistory', () => {
  it('registers as store.history', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    expect(flow.store.history).toBe(history);
    expect(history.active).toBe(true);
    expect(history.canUndo()).toBe(false);
    history.dispose();
    expect(flow.store.history).toBeNull();
  });

  it('attaches when the flow is connected later', async () => {
    const flow = document.createElement('xy-flow');
    flow.style.cssText = 'display:block;width:400px;height:300px';
    flow.nodes = [node('a', 0, 0)];
    const history = new LocalHistory(flow);
    document.body.append(flow);
    await flow.updateComplete;
    await waitFor(() => flow.hasStore && flow.store.history === history);
    flow.remove();
    history.dispose();
  });

  it('records a drag as one step and undoes and redoes it', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    const changes: string[] = [];
    flow.addEventListener('nodes-change', (e) => {
      for (const c of e.detail.changes) changes.push(`${e.detail.meta.origin}:${c.type}`);
    });
    await dragNode(flow, 'a', 100, 50, 8);
    const moved = pos(flow, 'a')!;
    expect(moved.x).toBeGreaterThan(60);
    expect(history.undoSize).toBe(1);

    history.undo();
    expect(pos(flow, 'a')).toEqual({ x: 0, y: 0 });
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
    // the undo went through the pipeline with origin 'undo'
    expect(changes).toContain('undo:position');

    history.redo();
    expect(pos(flow, 'a')).toEqual(moved);
    expect(history.canRedo()).toBe(false);
    expect(history.undoSize).toBe(1);
  });

  it('does not record a drag that ends where it started', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    await dragNode(flow, 'a', 0, 0, 3);
    expect(history.undoSize).toBe(0);
  });

  it('records one deleteElements call (nodes and edges) as one step', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    await flow.deleteElements({ nodes: [{ id: 'b' }] });
    expect(flow.nodes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(flow.edges).toHaveLength(0);
    expect(history.undoSize).toBe(1);

    history.undo();
    expect(flow.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(flow.edges.map((e) => e.id)).toEqual(['ab', 'bc']);
    expect(history.canUndo()).toBe(false);

    history.redo();
    expect(flow.nodes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(flow.edges).toHaveLength(0);
  });

  it('restores removed nodes at their original index', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    await flow.deleteElements({ nodes: [{ id: 'a' }, { id: 'c' }] });
    expect(flow.nodes.map((n) => n.id)).toEqual(['b']);
    history.undo();
    expect(flow.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('a new action clears the redo stack', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    flow.addNodes([node('d', 500, 500)]);
    flow.addNodes([node('e', 600, 600)]);
    expect(history.undoSize).toBe(2);
    history.undo();
    expect(history.canRedo()).toBe(true);
    flow.addNodes([node('f', 700, 700)]);
    expect(history.canRedo()).toBe(false);
    expect(flow.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd', 'f']);
    history.undo();
    history.undo();
    expect(flow.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('records node data updates as replace steps and ignores selection-only replaces', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    flow.updateNodeData('a', { label: 'changed' });
    await frames(1);
    expect(flow.store.getState().nodeLookup.get('a')?.data.label).toBe('changed');
    expect(history.undoSize).toBe(1);

    flow.updateNode('b', { selected: true });
    await frames(1);
    expect(history.undoSize).toBe(1);

    history.undo();
    expect(flow.store.getState().nodeLookup.get('a')?.data.label).toBe('a');
    history.redo();
    expect(flow.store.getState().nodeLookup.get('a')?.data.label).toBe('changed');
  });

  it('ignores selection and measurement changes', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    flow.store.addSelectedNodes(['a']);
    flow.store.addSelectedNodes(['b']);
    flow.store.resetSelectedElements();
    await frames(2);
    expect(history.undoSize).toBe(0);
  });

  it('restores the selection with the step', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    flow.store.addSelectedNodes(['b']);
    await flow.deleteElements({ nodes: [{ id: 'b' }] });
    history.undo();
    expect(flow.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual(['b']);
    history.redo();
    expect(flow.nodes.filter((n) => n.selected)).toHaveLength(0);
  });

  it('keeps at most maxSteps steps', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow, { maxSteps: 2 });
    for (const id of ['d', 'e', 'f']) flow.addNodes([node(id, 900, 900)]);
    expect(history.undoSize).toBe(2);
  });

  it('notifies subscribers when the stacks change', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    const listener = vi.fn();
    const off = history.subscribe(listener);
    flow.addNodes([node('d', 500, 500)]);
    expect(listener).toHaveBeenCalledTimes(1);
    history.undo();
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    history.redo();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('batch() makes several operations one step; withoutRecording() records none', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    history.batch(() => {
      flow.addNodes([node('d', 500, 500)]);
      flow.addNodes([node('e', 600, 600)]);
    });
    expect(history.undoSize).toBe(1);
    history.withoutRecording(() => flow.addNodes([node('f', 700, 700)]));
    expect(history.undoSize).toBe(1);
    history.undo();
    expect(flow.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c', 'f']);
  });

  it('still records in controlled mode, where the app applies the changes', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    const seen: string[] = [];
    flow.addEventListener('nodes-change', (e) => {
      e.preventDefault();
      seen.push(e.detail.meta.origin);
      flow.nodes = applyNodeChanges(e.detail.changes, flow.nodes);
    });
    flow.addEventListener('edges-change', (e) => {
      e.preventDefault();
      flow.edges = applyEdgeChanges(e.detail.changes, flow.edges);
    });
    await flow.deleteElements({ nodes: [{ id: 'a' }] });
    expect(flow.nodes.map((n) => n.id)).toEqual(['b', 'c']);
    expect(history.undoSize).toBe(1);
    history.undo();
    expect(flow.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(flow.edges.map((e) => e.id)).toEqual(['ab', 'bc']);
    expect(seen).toContain('undo');
  });

  it('records resizes (size and position) as one step per gesture', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    const { store } = flow;
    const gestureId = 'resize-1';
    const before = store.getState().nodeLookup.get('a')!;
    const w = before.measured.width ?? 100;
    const h = before.measured.height ?? 40;
    store.triggerNodeChanges(
      [
        {
          id: 'a',
          type: 'dimensions',
          dimensions: { width: w + 20, height: h + 10 },
          setAttributes: true,
          resizing: true,
        },
        { id: 'a', type: 'position', position: { x: -20, y: 0 } },
      ],
      { phase: 'start', origin: 'resize', gestureId },
    );
    store.triggerNodeChanges(
      [
        {
          id: 'a',
          type: 'dimensions',
          dimensions: { width: w + 60, height: h + 30 },
          setAttributes: true,
          resizing: true,
        },
        { id: 'a', type: 'position', position: { x: -60, y: 0 } },
      ],
      { phase: 'live', origin: 'resize', gestureId },
    );
    expect(history.undoSize).toBe(0);
    store.triggerNodeChanges(
      [
        {
          id: 'a',
          type: 'dimensions',
          dimensions: { width: w + 60, height: h + 30 },
          setAttributes: true,
          resizing: false,
        },
      ],
      { phase: 'end', origin: 'resize', gestureId },
    );
    expect(history.undoSize).toBe(1);
    expect(flow.nodes[0]?.width).toBe(w + 60);

    history.undo();
    expect(flow.nodes[0]?.width).toBe(w);
    expect(flow.nodes[0]?.height).toBe(h);
    expect(pos(flow, 'a')).toEqual({ x: 0, y: 0 });
    history.redo();
    expect(flow.nodes[0]?.width).toBe(w + 60);
    expect(pos(flow, 'a')).toEqual({ x: -60, y: 0 });
  });

  it('does not record changes of origin remote or its own undo', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    flow.store.triggerNodeChanges([{ type: 'add', item: node('r', 5, 5) }], {
      phase: 'discrete',
      origin: 'remote',
    });
    expect(history.undoSize).toBe(0);
    expect(flow.nodes).toHaveLength(4);
  });

  it('is inert while the data source has its own history (the source wins)', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    flow.addNodes([node('d', 500, 500)]);
    expect(history.undoSize).toBe(1);

    const calls: string[] = [];
    const sourceHistory: FlowHistory = {
      undo: () => calls.push('undo'),
      redo: () => calls.push('redo'),
      canUndo: () => true,
      canRedo: () => false,
      subscribe: () => () => {},
    };
    class HistorySource extends ArraySource {
      readonly history = sourceHistory;
    }
    flow.source = new HistorySource([node('x', 0, 0)], []);
    await frames(2);
    expect(flow.store.history).toBe(sourceHistory);
    expect(history.active).toBe(false);
    expect(history.canUndo()).toBe(false);
    // the stacks were dropped: they described the previous document
    flow.addNodes([node('y', 100, 100)]);
    expect(history.undoSize).toBe(0);
    history.undo();
    expect(flow.nodes.map((n) => n.id)).toEqual(['x', 'y']);

    // when the source goes away the local history is not resurrected by accident
    flow.source = null;
    history.dispose();
    expect(flow.store.history).toBeNull();
  });

  it('drops its stacks when the flow gets a new source', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    flow.addNodes([node('d', 500, 500)]);
    expect(history.undoSize).toBe(1);
    flow.source = new ArraySource([node('x')], []);
    await frames(2);
    expect(history.undoSize).toBe(0);
  });

  it('works through the undo and redo keys of the flow', async () => {
    const flow = await flowWith();
    const history = new LocalHistory(flow);
    flow.addNodes([node('d', 500, 500)]);
    nodeEl(flow, 'a').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true }),
    );
    const press = (init: KeyboardEventInit) =>
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
    press({ key: 'z', code: 'KeyZ', ctrlKey: true, metaKey: false });
    press({ key: 'z', code: 'KeyZ', metaKey: true, ctrlKey: false });
    expect(history.undoSize + history.redoSize).toBe(1);
    expect(flow.nodes).toHaveLength(3);
    press({ key: 'y', code: 'KeyY', ctrlKey: true });
    press({ key: 'y', code: 'KeyY', metaKey: true });
    expect(flow.nodes).toHaveLength(4);
  });
});
