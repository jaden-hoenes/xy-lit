import { afterEach, describe, expect, it } from 'vitest';
import type { InternalNode } from '@xy-lit/store';
import { LocalHistory, applyLayout, layout, layoutBackend } from '../src/index.js';
import { computeLayout, missingPeer } from '../src/layout/algorithms.js';
import type { LayoutInputEdge, LayoutInputNode } from '../src/layout/algorithms.js';
import { cleanup, edge, mountFlow, node, pos } from './helpers.js';

afterEach(cleanup);

const sized = { width: 100, height: 50 };
const chain = () =>
  mountFlow({
    nodes: [
      node('a', 0, 0, sized),
      node('b', 0, 0, sized),
      node('c', 0, 0, sized),
      node('d', 0, 0, sized),
    ],
    edges: [edge('ab', 'a', 'b'), edge('ac', 'a', 'c'), edge('bd', 'b', 'd'), edge('cd', 'c', 'd')],
  });

const lookup = (flow: Awaited<ReturnType<typeof chain>>): InternalNode[] => [
  ...flow.store.getState().nodeLookup.values(),
];

describe('layout algorithms (pure)', () => {
  const nodes: LayoutInputNode[] = ['a', 'b', 'c', 'd'].map((id, i) => ({
    id,
    width: 100,
    height: 50,
    x: i,
    y: i,
  }));
  const edges: LayoutInputEdge[] = [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'ac', source: 'a', target: 'c' },
    { id: 'bd', source: 'b', target: 'd' },
  ];
  const asMap = (r: [string, number, number][]) =>
    new Map(r.map(([id, x, y]) => [id, { x, y }] as const));

  it('dagre ranks top to bottom and left to right', async () => {
    const tb = asMap(await computeLayout(nodes, edges, { algorithm: 'dagre' }));
    expect(tb.get('a')!.y).toBeLessThan(tb.get('b')!.y);
    expect(tb.get('b')!.y).toBeLessThan(tb.get('d')!.y);
    expect(Math.min(...[...tb.values()].map((p) => p.x))).toBe(0);
    expect(Math.min(...[...tb.values()].map((p) => p.y))).toBe(0);
    const lr = asMap(await computeLayout(nodes, edges, { algorithm: 'dagre', direction: 'LR' }));
    expect(lr.get('a')!.x).toBeLessThan(lr.get('b')!.x);
  });

  it('elk layers the graph', async () => {
    const r = asMap(await computeLayout(nodes, edges, { algorithm: 'elk' }));
    expect(r.size).toBe(4);
    expect(r.get('a')!.x).toBeLessThan(r.get('b')!.x);
    const down = asMap(
      await computeLayout(nodes, edges, {
        algorithm: 'elk',
        elkOptions: { 'elk.direction': 'DOWN' },
      }),
    );
    expect(down.get('a')!.y).toBeLessThan(down.get('b')!.y);
  });

  it('tree puts children below (TB) or right (LR) of their parent', async () => {
    const tb = asMap(await computeLayout(nodes, edges, { algorithm: 'tree' }));
    expect(tb.get('b')!.y).toBeGreaterThan(tb.get('a')!.y);
    expect(tb.get('b')!.y).toBe(tb.get('c')!.y);
    expect(tb.get('b')!.x).not.toBe(tb.get('c')!.x);
    const lr = asMap(await computeLayout(nodes, edges, { algorithm: 'tree', direction: 'LR' }));
    expect(lr.get('b')!.x).toBeGreaterThan(lr.get('a')!.x);
    const sizedTree = asMap(
      await computeLayout(nodes, edges, { algorithm: 'tree', nodeSize: [300, 200] }),
    );
    expect(sizedTree.get('b')!.y - sizedTree.get('a')!.y).toBe(200);
  });

  it('tree copes with several roots, cycles and unknown endpoints', async () => {
    const r = asMap(
      await computeLayout(
        nodes,
        [
          { id: 'x', source: 'a', target: 'b' },
          { id: 'y', source: 'b', target: 'a' },
          { id: 'z', source: 'q', target: 'a' },
        ],
        { algorithm: 'tree' },
      ),
    );
    expect(r.size).toBe(4);
  });

  it('force separates nodes and is deterministic for the same input', async () => {
    const one = await computeLayout(nodes, edges, { algorithm: 'force', iterations: 150 });
    const two = await computeLayout(nodes, edges, { algorithm: 'force', iterations: 150 });
    expect(one).toEqual(two);
    const m = asMap(one);
    const a = m.get('a')!;
    const d = m.get('d')!;
    expect(Math.hypot(a.x - d.x, a.y - d.y)).toBeGreaterThan(100);
  });

  it('an empty graph gives an empty result; an unknown algorithm rejects', async () => {
    expect(await computeLayout([], [], { algorithm: 'dagre' })).toEqual([]);
    await expect(computeLayout(nodes, [], { algorithm: 'nope' } as never)).rejects.toThrow(
      /unknown layout algorithm/,
    );
  });

  it('a missing peer is reported with its package name and install hint', () => {
    expect(missingPeer('elk', new Error('boom')).message).toMatch(
      /"elk".*"elkjs".*npm install elkjs/,
    );
  });
});

describe('layout() through the worker', () => {
  it('lays out with dagre in a module worker', async () => {
    const flow = await chain();
    const result = await layout(lookup(flow), flow.edges, { algorithm: 'dagre' });
    expect(layoutBackend()).toBe('worker');
    expect(result.size).toBe(4);
    const a = result.get('a')!;
    const d = result.get('d')!;
    expect(d.y).toBeGreaterThan(a.y);
    // different from the input positions (all at 0, 0)
    expect(new Set([...result.values()].map((p) => `${p.x},${p.y}`)).size).toBe(4);
  });

  it('gives the same answer on the main thread', async () => {
    const flow = await chain();
    const viaWorker = await layout(lookup(flow), flow.edges, { algorithm: 'dagre' });
    const direct = await layout(
      lookup(flow),
      flow.edges,
      { algorithm: 'dagre' },
      { worker: false },
    );
    expect([...direct]).toEqual([...viaWorker]);
  });

  it('runs elk in the worker too', async () => {
    const flow = await chain();
    const result = await layout(lookup(flow), flow.edges, { algorithm: 'elk' });
    expect(result.size).toBe(4);
  });

  it('serves concurrent requests', async () => {
    const flow = await chain();
    const [x, y] = await Promise.all([
      layout(lookup(flow), flow.edges, { algorithm: 'dagre', direction: 'LR' }),
      layout(lookup(flow), flow.edges, { algorithm: 'tree' }),
    ]);
    expect(x.get('b')!.x).toBeGreaterThan(x.get('a')!.x);
    expect(y.get('b')!.y).toBeGreaterThan(y.get('a')!.y);
  });

  it('rejects an unknown algorithm with the worker error message', async () => {
    const flow = await chain();
    await expect(layout(lookup(flow), flow.edges, { algorithm: 'nope' } as never)).rejects.toThrow(
      /unknown layout algorithm/,
    );
  });

  it('only lays out root nodes, lifts edges of children to their root, skips hidden nodes', async () => {
    const flow = await mountFlow({
      nodes: [
        node('g', 0, 0, { type: 'group', width: 300, height: 200 }),
        node('k', 20, 20, { parentId: 'g', ...sized }),
        node('x', 0, 0, sized),
        node('h', 0, 0, { ...sized, hidden: true }),
      ],
      edges: [edge('kx', 'k', 'x'), edge('xh', 'x', 'h')],
    });
    const result = await layout(lookup(flow), flow.edges, { algorithm: 'dagre', direction: 'LR' });
    expect([...result.keys()].sort()).toEqual(['g', 'x']);
    // g -> x through the child's edge, so x is to the right of g
    expect(result.get('x')!.x).toBeGreaterThan(result.get('g')!.x);
    // the group keeps its measured size in the layout (300 wide)
    expect(result.get('x')!.x - result.get('g')!.x).toBeGreaterThanOrEqual(300);
  });

  it('honours origin and nodeOrigin', async () => {
    const flow = await chain();
    const result = await layout(
      lookup(flow),
      flow.edges,
      { algorithm: 'dagre' },
      { origin: { x: 1000, y: 500 }, nodeOrigin: [0.5, 0.5] },
    );
    const xs = [...result.values()].map((p) => p.x);
    // positions are anchors at the node centres: the leftmost centre is half a node right of the origin
    expect(Math.min(...xs)).toBe(1050);
  });
});

describe('applyLayout', () => {
  it('moves the nodes, keeps the top-left where it was, and is one undo step', async () => {
    const flow = await mountFlow({
      nodes: [
        node('a', 500, 300, sized),
        node('b', 500, 300, sized),
        node('c', 900, 800, sized),
        node('d', 500, 300, sized),
      ],
      edges: [
        edge('ab', 'a', 'b'),
        edge('ac', 'a', 'c'),
        edge('bd', 'b', 'd'),
        edge('cd', 'c', 'd'),
      ],
    });
    const history = new LocalHistory(flow);
    await applyLayout(flow, { algorithm: 'dagre' });
    const after = new Map(flow.nodes.map((n) => [n.id, n.position]));
    expect(Math.min(...[...after.values()].map((p) => p.x))).toBe(500);
    expect(Math.min(...[...after.values()].map((p) => p.y))).toBe(300);
    expect(after.get('d')!.y).toBeGreaterThan(after.get('a')!.y);
    expect(history.undoSize).toBe(1);
    history.undo();
    expect(pos(flow, 'c')).toEqual({ x: 900, y: 800 });
    expect(pos(flow, 'a')).toEqual({ x: 500, y: 300 });
    history.redo();
    expect(pos(flow, 'd')).toEqual(after.get('d'));
  });

  it('keepPosition: false places the layout at the origin', async () => {
    const flow = await chain();
    flow.nodes = flow.nodes.map((n) => ({ ...n, position: { x: 700, y: 700 } }));
    await applyLayout(flow, { algorithm: 'tree', keepPosition: false });
    const xs = flow.nodes.map((n) => n.position.x);
    expect(Math.min(...xs)).toBe(0);
  });

  it('animates as one gesture (start, live, end) and one history step', async () => {
    const flow = await chain();
    const history = new LocalHistory(flow);
    const phases: string[] = [];
    flow.addEventListener('nodes-change', (e) => {
      if (e.detail.meta.origin === 'layout') phases.push(e.detail.meta.phase);
    });
    await applyLayout(flow, { algorithm: 'dagre', animate: 150 });
    expect(phases[0]).toBe('start');
    expect(phases.at(-1)).toBe('end');
    expect(phases.length).toBeGreaterThan(2);
    expect(history.undoSize).toBe(1);
  });

  it('fits the view when asked', async () => {
    const flow = await chain();
    const before = flow.store.getState().transform.slice();
    await applyLayout(flow, { algorithm: 'dagre', fitView: true });
    expect(flow.store.getState().transform).not.toEqual(before);
  });

  it('works through the instance as well', async () => {
    const flow = await chain();
    await applyLayout(flow.instance, { algorithm: 'tree', worker: false });
    expect(new Set(flow.nodes.map((n) => `${n.position.x},${n.position.y}`)).size).toBe(4);
  });
});
