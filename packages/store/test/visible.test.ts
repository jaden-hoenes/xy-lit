import { describe, expect, it, vi } from 'vitest';
import { ConnectionMode, Position } from '../src/engine.js';
import { assignParallelOffsets } from '../src/edges/parallel.js';
import type { ArraySource } from '../src/sources/array-source.js';
import type { Node } from '../src/types/nodes.js';
import { createStore, edge, node } from './helpers.js';

/** A measured node with one source handle on the right and one target handle on the left. */
const hn = (id: string, x = 0, y = 0, extra: Partial<Node> = {}): Node =>
  node(id, x, y, {
    handles: [
      { type: 'source', position: Position.Right, x: 100, y: 25, id: 's' },
      { type: 'target', position: Position.Left, x: 0, y: 25, id: 't' },
    ],
    ...extra,
  });
const e = (id: string, source: string, target: string, extra = {}) =>
  edge(id, source, target, { sourceHandle: 's', targetHandle: 't', ...extra });

describe('getVisibleNodes', () => {
  it('excludes hidden nodes and keeps lookup order', () => {
    const { store } = createStore({ nodes: [hn('a'), hn('b', 0, 0, { hidden: true }), hn('c')] });
    expect(store.getVisibleNodes().map((n) => n.id)).toEqual(['a', 'c']);
  });

  it('is memoised on the lookup version', () => {
    const { store } = createStore({ nodes: [hn('a'), hn('b')] });
    const first = store.getVisibleNodes();
    expect(store.getVisibleNodes()).toBe(first);
    store.setState({ width: 123 });
    expect(store.getVisibleNodes()).toBe(first);
    store.addSelectedNodes(['a']);
    expect(store.getVisibleNodes()).not.toBe(first);
  });

  it('culls nodes outside the viewport, keeps endpoints of visible edges', () => {
    const { store } = createStore({
      nodes: [
        hn('in', 0, 0),
        hn('far', 5000, 5000),
        hn('crossing', 5000, 0),
        hn('also-far', -5000, 0),
      ],
      edges: [e('e1', 'in', 'crossing')],
      onlyRenderVisibleElements: true,
    });
    store.setState({ width: 400, height: 300 });
    const ids = store.getVisibleNodes().map((n) => n.id);
    expect(ids).toEqual(['in', 'crossing']);
    expect([...store.getLayoutedEdges().keys()]).toEqual(['e1']);
  });

  it('culling follows the viewport', () => {
    const { store } = createStore({
      nodes: [hn('a', 0, 0), hn('b', 1000, 0)],
      onlyRenderVisibleElements: true,
    });
    store.setState({ width: 400, height: 300 });
    expect(store.getVisibleNodes().map((n) => n.id)).toEqual(['a']);
    const first = store.getVisibleNodes();
    expect(store.getVisibleNodes()).toBe(first);
    store.setViewportFromPanZoom({ x: -900, y: 0, zoom: 1 });
    expect(store.getVisibleNodes().map((n) => n.id)).toEqual(['b']);
  });

  it('does not depend on the viewport without culling', () => {
    const { store } = createStore({ nodes: [hn('a', 0, 0), hn('b', 1000, 0)] });
    store.setState({ width: 400, height: 300 });
    const first = store.getVisibleNodes();
    store.setViewportFromPanZoom({ x: -900, y: 0, zoom: 1 });
    expect(store.getVisibleNodes()).toBe(first);
    expect(first).toHaveLength(2);
  });
});

describe('getLayoutedEdges', () => {
  it('lays out edges with positions, z-index and the user edge', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b')],
    });
    const layouted = store.getLayoutedEdges().get('e1')!;
    expect(layouted).toMatchObject({
      id: 'e1',
      sourceX: 101, // handle at x=100 with the default width of 1, right side
      sourceY: 25.5,
      targetX: 300,
      targetY: 25.5,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      resolvedOffset: 0,
    });
    expect(layouted.edge).toBe(store.getState().edges[0]);
    expect(layouted.sourceNode).toBe(store.getState().nodeLookup.get('a'));
    expect(typeof layouted.zIndex).toBe('number');
  });

  it('merges defaultEdgeOptions under the edge', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b', { animated: false }), e('e2', 'a', 'b')],
      defaultEdgeOptions: { animated: true, type: 'step' },
    });
    const edges = store.getLayoutedEdges();
    expect(edges.get('e1')).toMatchObject({ animated: false, type: 'step' });
    expect(edges.get('e2')).toMatchObject({ animated: true, type: 'step' });
  });

  it('skips edges with missing or hidden endpoints', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0, { hidden: true }), hn('c', 600, 0)],
      edges: [e('e1', 'a', 'b'), e('e2', 'a', 'zzz'), e('e3', 'a', 'c')],
    });
    expect([...store.getLayoutedEdges().keys()]).toEqual(['e3']);
  });

  it('skips hidden edges, also through defaultEdgeOptions, and an edge can opt back in', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0), hn('c', 600, 0)],
      edges: [e('e1', 'a', 'b', { hidden: true }), e('e2', 'a', 'c'), e('e3', 'b', 'c')],
    });
    expect([...store.getLayoutedEdges().keys()]).toEqual(['e2', 'e3']);

    const withDefault = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b'), e('e2', 'a', 'b', { hidden: false })],
      defaultEdgeOptions: { hidden: true },
    });
    expect([...withDefault.store.getLayoutedEdges().keys()]).toEqual(['e2']);
  });

  it('skips and reports edges whose handle is missing (error 008), once', () => {
    const { store, of } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b', { sourceHandle: 'nope' })],
    });
    expect(store.getLayoutedEdges().size).toBe(0);
    expect(of('flow-error').map((x) => x.code)).toEqual(['008']);
    store.addSelectedNodes(['a']); // relayout with the same edges
    store.getLayoutedEdges();
    expect(of('flow-error')).toHaveLength(1);
  });

  it('skips edges to unmeasured nodes silently', () => {
    const { store, of } = createStore({
      nodes: [
        hn('a'),
        hn('b', 300, 0, { measured: undefined, width: undefined, height: undefined }),
      ],
      edges: [e('e1', 'a', 'b')],
    });
    expect(store.getLayoutedEdges().size).toBe(0);
    expect(of('flow-error')).toHaveLength(0);
  });

  it('is memoised: same map until edges, lookup or layout options change', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b')],
    });
    const first = store.getLayoutedEdges();
    expect(store.getLayoutedEdges()).toBe(first);
    store.setState({ width: 10 });
    expect(store.getLayoutedEdges()).toBe(first);
    store.setOptions({ connectionMode: ConnectionMode.Loose });
    expect(store.getLayoutedEdges()).not.toBe(first);
  });

  it('reuses layouted objects while nothing they depend on changed', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0), hn('c', 600, 0)],
      edges: [e('e1', 'a', 'b'), e('e2', 'b', 'c')],
    });
    const first = store.getLayoutedEdges();
    // selecting 'c' creates a new user node object for c only (and bumps lookupVersion)
    store.addSelectedNodes(['c']);
    const second = store.getLayoutedEdges();
    expect(second).not.toBe(first);
    expect(second.get('e1')).toBe(first.get('e1'));
    expect(second.get('e2')).not.toBe(first.get('e2'));
    expect(second.get('e2')?.targetNode.selected).toBe(true);
  });

  it('recomputes an edge when its endpoint node moves', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b')],
    });
    const first = store.getLayoutedEdges().get('e1')!;
    store.triggerNodeChanges([{ id: 'b', type: 'position', position: { x: 400, y: 100 } }], {
      phase: 'discrete',
      origin: 'keyboard',
    });
    const second = store.getLayoutedEdges().get('e1')!;
    expect(second).not.toBe(first);
    expect(second).toMatchObject({ targetX: 400, targetY: 125.5 });
  });

  it('recomputes when the edge object changes', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b')],
    });
    const first = store.getLayoutedEdges().get('e1')!;
    (store.source as ArraySource).replaceEdges([{ ...store.getState().edges[0]!, animated: true }]);
    const second = store.getLayoutedEdges().get('e1')!;
    expect(second).not.toBe(first);
    expect(second.animated).toBe(true);
  });

  it('reuse is invalidated when an endpoint positionAbsolute object is replaced in place', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b')],
    });
    const first = store.getLayoutedEdges().get('e1')!;
    // what updateAbsolutePositions does for a child whose parent moved: assign a new object
    store.getState().nodeLookup.get('b')!.internals.positionAbsolute = { x: 500, y: 0 };
    store.setState({ lookupVersion: store.getState().lookupVersion + 1 });
    const second = store.getLayoutedEdges().get('e1')!;
    expect(second).not.toBe(first);
    expect(second.targetX).toBe(500);
  });

  it('reuse is invalidated when an endpoint handleBounds object is replaced in place', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b')],
    });
    const first = store.getLayoutedEdges().get('e1')!;
    const internal = store.getState().nodeLookup.get('a')!;
    const bounds = internal.internals.handleBounds!;
    internal.internals.handleBounds = {
      source: bounds.source!.map((h) => ({ ...h, x: 90 })),
      target: bounds.target,
    };
    store.setState({ lookupVersion: store.getState().lookupVersion + 1 });
    const second = store.getLayoutedEdges().get('e1')!;
    expect(second).not.toBe(first);
    expect(second.sourceX).toBe(91);
  });

  it('reuse stays valid when positionAbsolute objects are untouched', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b')],
    });
    const first = store.getLayoutedEdges().get('e1')!;
    store.setState({ lookupVersion: store.getState().lookupVersion + 1 });
    expect(store.getLayoutedEdges().get('e1')).toBe(first);
  });

  it('elevates selected edges when elevateEdgesOnSelect is on', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b', { selected: true }), e('e2', 'a', 'b')],
      elevateEdgesOnSelect: true,
    });
    const edges = store.getLayoutedEdges();
    expect(edges.get('e1')!.zIndex).toBeGreaterThan(edges.get('e2')!.zIndex);
  });

  it('applies parallel offsets only when parallelEdges is spread', () => {
    const edges = [e('e1', 'a', 'b'), e('e2', 'a', 'b'), e('e3', 'a', 'b')];
    const off = createStore({ nodes: [hn('a'), hn('b', 300, 0)], edges });
    expect([...off.store.getLayoutedEdges().values()].map((l) => l.resolvedOffset)).toEqual([
      0, 0, 0,
    ]);
    const spread = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges,
      parallelEdges: 'spread',
      parallelEdgeGap: 10,
    });
    expect([...spread.store.getLayoutedEdges().values()].map((l) => l.resolvedOffset)).toEqual([
      -10, 0, 10,
    ]);
  });

  it('an explicit offset wins over spreading and a new sibling re-lays out the group', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b'), e('e2', 'a', 'b', { offset: 99 })],
      parallelEdges: 'spread',
      parallelEdgeGap: 10,
    });
    let layouted = store.getLayoutedEdges();
    expect(layouted.get('e2')?.resolvedOffset).toBe(99);
    expect(layouted.get('e1')?.resolvedOffset).toBe(-5);
    const e2 = layouted.get('e2');
    (store.source as ArraySource).replaceEdges([...store.getState().edges, e('e3', 'a', 'b')]);
    layouted = store.getLayoutedEdges();
    expect(layouted.get('e2')).toBe(e2); // explicit offset: untouched, reused
    expect(layouted.get('e1')?.resolvedOffset).toBe(-10); // group of three now
    expect(layouted.get('e3')?.resolvedOffset).toBe(10);
  });

  it('invalidates parallel reuse when the gap changes', () => {
    const { store } = createStore({
      nodes: [hn('a'), hn('b', 300, 0)],
      edges: [e('e1', 'a', 'b'), e('e2', 'a', 'b')],
      parallelEdges: 'spread',
      parallelEdgeGap: 10,
    });
    const first = store.getLayoutedEdges().get('e1')!;
    store.setOptions({ parallelEdgeGap: 20 });
    const second = store.getLayoutedEdges().get('e1')!;
    expect(second).not.toBe(first);
    expect(second.resolvedOffset).toBe(-10);
  });
});

describe('assignParallelOffsets', () => {
  const ends = (id: string, source: string, target: string, sh?: string, th?: string) => ({
    id,
    source,
    target,
    sourceHandle: sh,
    targetHandle: th,
  });

  it('gives a single edge offset 0', () => {
    expect(assignParallelOffsets([ends('a', 'x', 'y')], 12).get('a')).toBe(0);
  });

  it('spreads k = 2 symmetrically', () => {
    const offsets = assignParallelOffsets([ends('b', 'x', 'y'), ends('a', 'x', 'y')], 12);
    expect(offsets.get('a')).toBe(-6);
    expect(offsets.get('b')).toBe(6);
  });

  it('spreads k = 3 around the middle edge, sorted by id', () => {
    const offsets = assignParallelOffsets(
      [ends('c', 'x', 'y'), ends('a', 'x', 'y'), ends('b', 'x', 'y')],
      12,
    );
    expect(offsets.get('a')).toBe(-12);
    expect(offsets.get('b')).toBe(0);
    expect(offsets.get('c')).toBe(12);
  });

  it('groups opposite directions together and mirrors the sign', () => {
    // x:→y:  and y:→x: are the same pair; "x:" < "y:" so the x→y edge has dir 1, the y→x edge dir -1
    const offsets = assignParallelOffsets([ends('a', 'x', 'y'), ends('b', 'y', 'x')], 10);
    expect(offsets.get('a')).toBe(-5);
    expect(offsets.get('b')).toBe(-5); // (1 - 0.5) * 10 * -1
  });

  it('separates different handle pairs and nodes', () => {
    const offsets = assignParallelOffsets(
      [ends('a', 'x', 'y', 's1', 't'), ends('b', 'x', 'y', 's2', 't'), ends('c', 'x', 'z')],
      10,
    );
    expect([offsets.get('a'), offsets.get('b'), offsets.get('c')]).toEqual([0, 0, 0]);
  });

  it('treats null and undefined handles alike', () => {
    const offsets = assignParallelOffsets(
      [{ id: 'a', source: 'x', target: 'y', sourceHandle: null }, ends('b', 'x', 'y')],
      10,
    );
    expect(offsets.get('a')).toBe(-5);
    expect(offsets.get('b')).toBe(5);
  });
});

describe('layout errors', () => {
  it('does not throw for an empty flow', () => {
    const { store } = createStore();
    expect(store.getLayoutedEdges().size).toBe(0);
    expect(store.getVisibleNodes()).toEqual([]);
    expect(vi.isMockFunction(console.warn)).toBe(false);
  });
});
