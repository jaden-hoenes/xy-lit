import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { Edge, Node } from '@xy-lit/store';
import { HEAL, SERVER } from '../src/origins.js';
import { applyRepairs, healDoc, orderAndRepair, validateDoc } from '../src/repair.js';
import type { RepairIssue } from '../src/repair.js';
import { getMaps, toYEdge, toYNode } from '../src/schema.js';
import { keyBetween } from '../src/order.js';

const node = (id: string, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  ...extra,
});
const edge = (id: string, source: string, target: string, extra: Partial<Edge> = {}): Edge => ({
  id,
  source,
  target,
  ...extra,
});

function run(nodes: Node[], edges: Edge[] = [], orders: Record<string, string> = {}) {
  const nm = new Map(nodes.map((n) => [n.id, n]));
  const em = new Map(edges.map((e) => [e.id, e]));
  return orderAndRepair(nm, em, (id, kind) => orders[`${kind}:${id}`] ?? orders[id] ?? 'a0');
}

describe('orderAndRepair', () => {
  it('1. sorts nodes by (order, id)', () => {
    const r = run([node('c'), node('a'), node('b')], [], { a: 'a2', b: 'a1', c: 'a1' });
    expect(r.nodeIds).toEqual(['b', 'c', 'a']);
    expect(r.issues).toEqual([]);
  });

  it('2. renders an orphan as a root', () => {
    const r = run([node('a', { parentId: 'gone', position: { x: 5, y: 5 } }), node('b')]);
    expect(r.issues).toEqual([{ kind: 'orphan-parent', nodeId: 'a', parentId: 'gone' }]);
    expect(r.nodePatches.get('a')).toEqual({ parentId: undefined });
    expect(r.nodeIds).toEqual(['a', 'b']);
  });

  it('2. an orphan with extent parent also loses the extent', () => {
    const r = run([node('a', { parentId: 'gone', extent: 'parent' })]);
    expect(r.nodePatches.get('a')).toEqual({ parentId: undefined, extent: undefined });
  });

  it('3. breaks a parent cycle at the smallest id', () => {
    const r = run([
      node('c', { parentId: 'b' }),
      node('b', { parentId: 'a' }),
      node('a', { parentId: 'c' }),
      node('d', { parentId: 'a' }),
    ]);
    expect(r.issues).toEqual([{ kind: 'parent-cycle', nodeIds: ['a', 'b', 'c'], brokenAt: 'a' }]);
    expect(r.nodePatches.get('a')).toEqual({ parentId: undefined });
    // a is the root, b its first child (with c below it), then d
    expect(r.nodeIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('3. a node that is its own parent is a cycle of one', () => {
    const r = run([node('x', { parentId: 'x' })]);
    expect(r.issues).toEqual([{ kind: 'parent-cycle', nodeIds: ['x'], brokenAt: 'x' }]);
    expect(r.nodeIds).toEqual(['x']);
  });

  it('4. puts parents before children, depth first', () => {
    const r = run(
      [
        node('kid', { parentId: 'p' }),
        node('other'),
        node('p'),
        node('grand', { parentId: 'kid' }),
      ],
      [],
      { kid: 'a0', other: 'a1', p: 'a2', grand: 'a3' },
    );
    expect(r.nodeIds).toEqual(['other', 'p', 'kid', 'grand']);
  });

  it('5. drops dangling edges', () => {
    const r = run(
      [node('a'), node('b')],
      [edge('e1', 'a', 'b'), edge('e2', 'a', 'zz'), edge('e3', 'q', 'b')],
    );
    expect(r.edgeIds).toEqual(['e1']);
    expect(r.issues).toEqual([
      { kind: 'dangling-edge', edgeId: 'e2', missing: 'target' },
      { kind: 'dangling-edge', edgeId: 'e3', missing: 'source' },
    ]);
  });

  it('6. keeps the smallest id of duplicate edges', () => {
    const r = run(
      [node('a'), node('b')],
      [
        edge('e3', 'a', 'b', { sourceHandle: null }),
        edge('e1', 'a', 'b'),
        edge('e2', 'a', 'b', { sourceHandle: 'x' }),
        edge('e4', 'a', 'b', { targetHandle: undefined }),
      ],
    );
    expect(r.edgeIds.sort()).toEqual(['e1', 'e2']);
    expect(r.issues).toEqual([{ kind: 'duplicate-edge', keep: 'e1', drop: ['e3', 'e4'] }]);
  });

  it('7. orders edges by (order, id)', () => {
    const r = run(
      [node('a'), node('b')],
      [
        edge('x', 'a', 'b', { sourceHandle: '1' }),
        edge('y', 'a', 'b', { sourceHandle: '2' }),
        edge('z', 'b', 'a'),
      ],
      { 'edge:x': 'a2', 'edge:y': 'a1', 'edge:z': 'a1' },
    );
    expect(r.edgeIds).toEqual(['y', 'z', 'x']);
  });

  it('is deterministic for shuffled input', () => {
    // xorshift so the test does not depend on Math.random
    let seed = 12345;
    const rand = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 2 ** 32;
    };
    const shuffle = <T>(xs: T[]): T[] => {
      const out = [...xs];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    };
    const nodes = [
      node('a', { parentId: 'c' }),
      node('b', { parentId: 'a' }),
      node('c', { parentId: 'b' }),
      node('d', { parentId: 'nope' }),
      node('e', { parentId: 'd' }),
      node('f'),
      node('g', { parentId: 'g' }),
    ];
    const edges = [
      edge('e1', 'a', 'b'),
      edge('e2', 'a', 'b'),
      edge('e3', 'a', 'x'),
      edge('e4', 'f', 'e'),
      edge('e5', 'f', 'e'),
    ];
    const orders = { a: 'a1', b: 'a1', c: 'a0', d: 'a3', e: 'a2', f: 'a2', g: 'a0' };
    const expected = run(nodes, edges, orders);
    for (let i = 0; i < 20; i++) {
      const got = run(shuffle(nodes), shuffle(edges), orders);
      expect(got.nodeIds).toEqual(expected.nodeIds);
      expect(got.edgeIds).toEqual(expected.edgeIds);
      expect(got.issues).toEqual(expected.issues);
      expect(got.nodePatches).toEqual(expected.nodePatches);
    }
  });
});

function docWith(nodes: Node[], edges: Edge[]): Y.Doc {
  const doc = new Y.Doc();
  const maps = getMaps(doc);
  let last: string | null = null;
  doc.transact(() => {
    for (const n of nodes) {
      last = keyBetween(last, null);
      maps.nodes.set(n.id, toYNode(n, last));
    }
    for (const e of edges) {
      last = keyBetween(last, null);
      maps.edges.set(e.id, toYEdge(e, last));
    }
  });
  return doc;
}

describe('validateDoc / healDoc', () => {
  const nodes = [
    node('a'),
    node('b', { parentId: 'a', extent: 'parent' }),
    node('c', { parentId: 'gone', extent: 'parent' }),
  ];
  const edges = [edge('e1', 'a', 'b'), edge('e2', 'a', 'b'), edge('e3', 'a', 'missing')];

  it('reports the issues of a document', () => {
    const issues = validateDoc(docWith(nodes, edges));
    expect(issues.map((i) => i.kind).sort()).toEqual([
      'dangling-edge',
      'duplicate-edge',
      'orphan-parent',
    ]);
  });

  it('heals with the HEAL origin by default and then validates clean', () => {
    const doc = docWith(nodes, edges);
    const origins: unknown[] = [];
    doc.on('afterTransaction', (tx: Y.Transaction) => origins.push(tx.origin));
    const fixed = healDoc(doc);
    expect(fixed).toHaveLength(3);
    expect(origins).toEqual([HEAL]);
    expect(validateDoc(doc)).toEqual([]);
    const maps = getMaps(doc);
    expect([...maps.edges.keys()]).toEqual(['e1']);
    expect(maps.nodes.get('c')!.has('parentId')).toBe(false);
    expect(maps.nodes.get('c')!.has('extent')).toBe(false);
    expect(maps.nodes.get('b')!.get('parentId')).toBe('a');
  });

  it('writes nothing for a healthy document and honours a custom origin', () => {
    const doc = docWith([node('a'), node('b')], [edge('e', 'a', 'b')]);
    let updates = 0;
    doc.on('update', () => updates++);
    expect(healDoc(doc)).toEqual([]);
    expect(updates).toBe(0);
    const broken = docWith(nodes, edges);
    const origins: unknown[] = [];
    broken.on('afterTransaction', (tx: Y.Transaction) => origins.push(tx.origin));
    healDoc(broken, SERVER);
    expect(origins).toEqual([SERVER]);
  });

  it('heals a parent cycle', () => {
    const doc = docWith([node('a', { parentId: 'b' }), node('b', { parentId: 'a' })], []);
    expect(healDoc(doc)).toEqual([{ kind: 'parent-cycle', nodeIds: ['a', 'b'], brokenAt: 'a' }]);
    expect(getMaps(doc).nodes.get('a')!.has('parentId')).toBe(false);
    expect(getMaps(doc).nodes.get('b')!.get('parentId')).toBe('a');
  });

  it('converges: two replicas healing the same problem agree', () => {
    const a = docWith(nodes, edges);
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    healDoc(a);
    healDoc(b);
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(JSON.stringify(a.toJSON())).toBe(JSON.stringify(b.toJSON()));
    expect(validateDoc(a)).toEqual([]);
  });

  it('applyRepairs skips what is already gone', () => {
    const doc = docWith(nodes, edges);
    const issues: RepairIssue[] = [{ kind: 'dangling-edge', edgeId: 'nope', missing: 'source' }];
    doc.transact(() => {
      expect(applyRepairs(getMaps(doc), issues)).toEqual([]);
    });
  });
});
