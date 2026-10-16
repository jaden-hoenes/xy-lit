import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { ChangeMeta, Edge, Node } from '@xy-lit/store';
import { healDoc, validateDoc } from '../src/repair.js';
import { YjsFlowSource } from '../src/yjs-flow-source.js';

/**
 * Convergence fuzzing (spec/11 §Tests, spec/13): 2-4 replicas apply random operations through the
 * real `YjsFlowSource` mapping, exchange updates in random order with drops, duplicates and
 * partitions, then fully sync. Replicas must agree, and the materialised view must always satisfy
 * the structural invariants.
 */

const NODE_IDS = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5'] as const;
const EDGE_IDS = ['e0', 'e1', 'e2', 'e3', 'e4'] as const;
const RICH = { note: ['body'] };
const META: ChangeMeta = { phase: 'discrete', origin: 'api' };

type NodeId = (typeof NODE_IDS)[number];
type EdgeId = (typeof EDGE_IDS)[number];
type Op =
  | { k: 'add'; r: number; id: NodeId; x: number; y: number; parent: NodeId | null; note: boolean }
  | { k: 'move'; r: number; id: NodeId; x: number; y: number }
  | { k: 'delete'; r: number; id: NodeId }
  | { k: 'reparent'; r: number; id: NodeId; parent: NodeId | null }
  | { k: 'connect'; r: number; id: EdgeId; source: NodeId; target: NodeId; handle: boolean }
  | { k: 'unconnect'; r: number; id: EdgeId }
  | { k: 'data'; r: number; id: NodeId; key: 'a' | 'b'; value: number | null }
  | { k: 'text'; r: number; id: NodeId; at: number; del: number; ins: string }
  | { k: 'undo'; r: number }
  | { k: 'redo'; r: number }
  | { k: 'deliver'; r: number; i: number }
  | { k: 'dup'; r: number; i: number }
  | { k: 'drop'; r: number; i: number }
  | { k: 'partition'; r: number; on: boolean }
  | { k: 'sync'; r: number; with: number };

const nodeId = fc.constantFrom(...NODE_IDS);
const edgeId = fc.constantFrom(...EDGE_IDS);
const replica = fc.nat(3);
const coord = fc.integer({ min: -50, max: 50 });
const op: fc.Arbitrary<Op> = fc.oneof(
  {
    weight: 14,
    arbitrary: fc.record({
      k: fc.constant('add' as const),
      r: replica,
      id: nodeId,
      x: coord,
      y: coord,
      parent: fc.option(nodeId, { nil: null, freq: 4 }),
      note: fc.boolean(),
    }),
  },
  {
    weight: 5,
    arbitrary: fc.record({
      k: fc.constant('move' as const),
      r: replica,
      id: nodeId,
      x: coord,
      y: coord,
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({ k: fc.constant('delete' as const), r: replica, id: nodeId }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      k: fc.constant('reparent' as const),
      r: replica,
      id: nodeId,
      parent: fc.option(nodeId, { nil: null }),
    }),
  },
  {
    weight: 9,
    arbitrary: fc.record({
      k: fc.constant('connect' as const),
      r: replica,
      id: edgeId,
      source: nodeId,
      target: nodeId,
      handle: fc.boolean(),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ k: fc.constant('unconnect' as const), r: replica, id: edgeId }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      k: fc.constant('data' as const),
      r: replica,
      id: nodeId,
      key: fc.constantFrom('a' as const, 'b' as const),
      value: fc.option(fc.integer({ min: 0, max: 9 }), { nil: null }),
    }),
  },
  {
    weight: 5,
    arbitrary: fc.record({
      k: fc.constant('text' as const),
      r: replica,
      id: nodeId,
      at: fc.nat(12),
      del: fc.nat(4),
      ins: fc.string({ maxLength: 4 }),
    }),
  },
  { weight: 3, arbitrary: fc.record({ k: fc.constant('undo' as const), r: replica }) },
  { weight: 1, arbitrary: fc.record({ k: fc.constant('redo' as const), r: replica }) },
  {
    weight: 10,
    arbitrary: fc.record({ k: fc.constant('deliver' as const), r: replica, i: fc.nat(20) }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ k: fc.constant('dup' as const), r: replica, i: fc.nat(20) }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ k: fc.constant('drop' as const), r: replica, i: fc.nat(20) }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ k: fc.constant('partition' as const), r: replica, on: fc.boolean() }),
  },
  {
    weight: 3,
    arbitrary: fc.record({ k: fc.constant('sync' as const), r: replica, with: replica }),
  },
);
const scenario = fc.record({
  replicas: fc.integer({ min: 2, max: 4 }),
  ops: fc.array(op, { minLength: 8, maxLength: 70 }),
});

type Replica = { doc: Y.Doc; source: YjsFlowSource; inbox: Uint8Array[]; isolated: boolean };

function makeReplicas(count: number): Replica[] {
  const replicas: Replica[] = [];
  for (let i = 0; i < count; i++) {
    const doc = new Y.Doc();
    doc.clientID = i + 1; // deterministic tie-breaks make failures reproducible
    const source = new YjsFlowSource(doc, {
      heal: false,
      richText: RICH,
      undo: { captureTimeout: 0 },
    });
    const self: Replica = { doc, source, inbox: [], isolated: false };
    replicas.push(self);
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'net') return;
      for (const other of replicas) {
        if (other === self) continue;
        // a partition silently loses what crosses it (the final sync recovers it)
        if (other.isolated !== self.isolated) continue;
        other.inbox.push(update);
      }
    });
  }
  return replicas;
}

/** Sort object keys deeply so two structurally equal values compare equal. */
const canon = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => [k, canon(v)]),
    );
  }
  return value;
};

function textOf(node: Node | undefined): string {
  const body = node?.data?.body;
  return typeof body === 'string' ? body : '';
}

function apply(replicas: Replica[], o: Op): void {
  const r = replicas[o.r % replicas.length]!;
  const s = r.source;
  const node = (id: string): Node | undefined => s.nodes.find((n) => n.id === id);
  switch (o.k) {
    case 'add': {
      if (node(o.id)) return;
      const item: Node = {
        id: o.id,
        type: o.note ? 'note' : 'default',
        position: { x: o.x, y: o.y },
        data: o.note ? { body: 'x', a: 1 } : { a: 1 },
        ...(o.parent && o.parent !== o.id ? { parentId: o.parent } : {}),
      };
      s.applyNodeChanges([{ type: 'add', item }], META);
      break;
    }
    case 'move':
      if (node(o.id)) {
        s.applyNodeChanges([{ type: 'position', id: o.id, position: { x: o.x, y: o.y } }], META);
      }
      break;
    case 'delete':
      if (node(o.id)) s.applyNodeChanges([{ type: 'remove', id: o.id }], META);
      break;
    case 'reparent': {
      const n = node(o.id);
      if (!n) return;
      const next: Node = { ...n };
      if (o.parent && o.parent !== o.id) next.parentId = o.parent;
      else delete next.parentId;
      s.applyNodeChanges([{ type: 'replace', id: o.id, item: next }], META);
      break;
    }
    case 'connect': {
      if (s.edges.some((e) => e.id === o.id)) return;
      const item: Edge = {
        id: o.id,
        source: o.source,
        target: o.target,
        ...(o.handle ? { sourceHandle: 'h' } : {}),
      };
      s.applyEdgeChanges([{ type: 'add', item }], META);
      break;
    }
    case 'unconnect':
      if (s.edges.some((e) => e.id === o.id))
        s.applyEdgeChanges([{ type: 'remove', id: o.id }], META);
      break;
    case 'data':
      if (node(o.id)) s.updateNodeData(o.id, { [o.key]: o.value ?? undefined }, META);
      break;
    case 'text': {
      const n = node(o.id);
      if (!n || n.type !== 'note') return;
      const cur = textOf(n);
      const at = Math.min(o.at, cur.length);
      s.updateNodeData(o.id, { body: cur.slice(0, at) + o.ins + cur.slice(at + o.del) }, META);
      break;
    }
    case 'undo':
      s.history?.undo();
      break;
    case 'redo':
      s.history?.redo();
      break;
    case 'deliver': {
      if (!r.inbox.length) return;
      const [update] = r.inbox.splice(o.i % r.inbox.length, 1);
      Y.applyUpdate(r.doc, update!, 'net');
      break;
    }
    case 'dup':
      if (r.inbox.length) Y.applyUpdate(r.doc, r.inbox[o.i % r.inbox.length]!, 'net');
      break;
    case 'drop':
      if (r.inbox.length) r.inbox.splice(o.i % r.inbox.length, 1);
      break;
    case 'partition':
      r.isolated = o.on;
      break;
    case 'sync': {
      // a direct exchange between two replicas that can reach each other
      const other = replicas[o.with % replicas.length]!;
      if (other === r || other.isolated !== r.isolated) return;
      Y.applyUpdate(other.doc, Y.encodeStateAsUpdate(r.doc, Y.encodeStateVector(other.doc)), 'net');
      Y.applyUpdate(r.doc, Y.encodeStateAsUpdate(other.doc, Y.encodeStateVector(r.doc)), 'net');
      break;
    }
  }
}

/** Structural invariants of a replica's materialised view. */
function checkView(source: YjsFlowSource): void {
  const nodes = source.nodes;
  const edges = source.edges;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  expect(byId.size).toBe(nodes.length);
  const position = new Map(nodes.map((n, i) => [n.id, i]));
  for (const n of nodes) {
    if (n.parentId) {
      // no orphans, and parents come before children
      expect(byId.has(n.parentId)).toBe(true);
      expect(position.get(n.parentId)!).toBeLessThan(position.get(n.id)!);
    }
    // no cycles
    let at: Node | undefined = n;
    for (let hops = 0; at?.parentId; hops++) {
      expect(hops).toBeLessThanOrEqual(nodes.length);
      at = byId.get(at.parentId);
    }
  }
  const seen = new Set<string>();
  for (const e of edges) {
    expect(byId.has(e.source) && byId.has(e.target)).toBe(true);
    const key = JSON.stringify([
      e.source,
      e.sourceHandle ?? null,
      e.target,
      e.targetHandle ?? null,
    ]);
    expect(seen.has(key)).toBe(false);
    seen.add(key);
  }
}

function fullSync(replicas: Replica[]): void {
  for (let round = 0; round < 2; round++) {
    for (const a of replicas) {
      for (const b of replicas) {
        if (a !== b)
          Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc, Y.encodeStateVector(b.doc)), 'net');
      }
    }
  }
}

const runs = Number(process.env.FUZZ_RUNS ?? 2000);
const stats = { nodes: 0, edges: 0, issues: 0, withIssues: 0 };

describe('collab convergence fuzzing', () => {
  it(`converges and keeps the invariants (${runs} runs)`, () => {
    fc.assert(
      fc.property(scenario, ({ replicas: count, ops }) => {
        const replicas = makeReplicas(count);
        try {
          for (const o of ops) {
            apply(replicas, o);
            // every step: the acting replica's view satisfies the invariants
            checkView(replicas[o.r % replicas.length]!.source);
          }
          fullSync(replicas);

          const [first, ...rest] = replicas;
          const reference = canon(first!.doc.toJSON());
          for (const other of rest) {
            expect(Y.encodeStateVector(other.doc)).toEqual(Y.encodeStateVector(first!.doc));
            expect(canon(other.doc.toJSON())).toEqual(reference);
            // identical materialisation and identical orderAndRepair output on every replica
            expect(other.source.nodes.map((n) => n.id)).toEqual(
              first!.source.nodes.map((n) => n.id),
            );
            expect(other.source.edges.map((e) => e.id)).toEqual(
              first!.source.edges.map((e) => e.id),
            );
            expect(other.source.issues).toEqual(first!.source.issues);
            expect(validateDoc(other.doc)).toEqual(validateDoc(first!.doc));
            expect(canon(other.source.toObject())).toEqual(canon(first!.source.toObject()));
          }
          for (const r of replicas) checkView(r.source);
          stats.nodes += first!.source.nodes.length;
          stats.edges += first!.source.edges.length;
          stats.issues += first!.source.issues.length;
          if (first!.source.issues.length) stats.withIssues++;

          // healing one replica and syncing leaves every replica clean and equal
          healDoc(first!.doc);
          fullSync(replicas);
          const healed = canon(first!.doc.toJSON());
          for (const r of replicas) {
            expect(validateDoc(r.doc)).toEqual([]);
            expect(r.source.issues).toEqual([]);
            expect(canon(r.doc.toJSON())).toEqual(healed);
            checkView(r.source);
          }
        } finally {
          for (const r of replicas) r.source.destroy();
        }
      }),
      { numRuns: runs },
    );
    if (process.env.FUZZ_STATS) console.log('fuzz stats', stats);
  });
});
