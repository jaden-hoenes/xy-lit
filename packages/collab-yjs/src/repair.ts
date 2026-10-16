import type * as Y from 'yjs';
import type { Edge, Node } from '@xy-lit/store';
import { HEAL } from './origins.js';
import { compareOrder } from './order.js';
import { fromYEdge, fromYNode, getMaps, getOrder } from './schema.js';
import type { DocKeys } from './schema.js';

/** A structural problem found in the document (spec/11 §Repair). */
export type RepairIssue =
  | { kind: 'dangling-edge'; edgeId: string; missing: 'source' | 'target' }
  | { kind: 'orphan-parent'; nodeId: string; parentId: string }
  | { kind: 'parent-cycle'; nodeIds: string[]; brokenAt: string }
  | { kind: 'duplicate-edge'; keep: string; drop: string[] };

/** Result of {@link orderAndRepair}. */
export type RepairResult = {
  /** Node ids, parents before children. */
  nodeIds: string[];
  /** Ids of the edges that are rendered, in order. */
  edgeIds: string[];
  /** Per-node overrides for the materialised objects (not written to the document). */
  nodePatches: Map<string, Partial<Node>>;
  issues: RepairIssue[];
};

/** Fields cleared on a node whose parent is broken: `parentId`, and an `extent: 'parent'` that needs one. */
export function brokenParentPatch(node: Pick<Node, 'extent'>): Partial<Node> {
  return node.extent === 'parent'
    ? { parentId: undefined, extent: undefined }
    : { parentId: undefined };
}

const edgeKey = (e: Edge): string =>
  JSON.stringify([e.source, e.sourceHandle ?? null, e.target, e.targetHandle ?? null]);

/**
 * Deterministic ordering and repair. Every client computes the same result from the same document.
 *
 * 1. Node order: `(order, id)`.
 * 2. Orphan parent (not present): render as a root.
 * 3. Parent cycles: break at the smallest id of each cycle.
 * 4. Parents before children: depth-first from the roots, in the order of step 1.
 * 5. Dangling edges (missing endpoint node) are dropped.
 * 6. Duplicate edges (same source, handles and target): keep the smallest id.
 * 7. Edge order: `(order, id)`.
 *
 * @param nodes - Plain nodes by id (as read from the document).
 * @param edges - Plain edges by id.
 * @param order - Fractional index of a node or an edge.
 */
export function orderAndRepair(
  nodes: ReadonlyMap<string, Node>,
  edges: ReadonlyMap<string, Edge>,
  order: (id: string, kind: 'node' | 'edge') => string,
): RepairResult {
  const issues: RepairIssue[] = [];
  const nodePatches = new Map<string, Partial<Node>>();

  // 1. node order
  const sorted = [...nodes.keys()].sort((a, b) =>
    compareOrder(order(a, 'node'), a, order(b, 'node'), b),
  );

  // 2. orphans: parent chains that leave the document become roots
  const parentOf = new Map<string, string>();
  for (const id of sorted) {
    const node = nodes.get(id)!;
    const parentId = node.parentId;
    if (parentId === undefined || parentId === null || parentId === '') continue;
    if (!nodes.has(parentId)) {
      issues.push({ kind: 'orphan-parent', nodeId: id, parentId });
      nodePatches.set(id, brokenParentPatch(node));
    } else {
      parentOf.set(id, parentId);
    }
  }
  // a node that is its own parent is a cycle of one
  // 3. cycles: every node has at most one parent, so cycles are disjoint and well defined
  const state = new Map<string, 0 | 1 | 2>(); // 1 = on the current path, 2 = done
  for (const start of [...nodes.keys()].sort()) {
    if (state.get(start)) continue;
    const path: string[] = [];
    let current: string | undefined = start;
    while (current !== undefined && !state.get(current)) {
      state.set(current, 1);
      path.push(current);
      current = parentOf.get(current);
    }
    if (current !== undefined && state.get(current) === 1) {
      const cycle = path.slice(path.indexOf(current));
      const brokenAt = cycle.reduce((min, id) => (id < min ? id : min));
      parentOf.delete(brokenAt);
      nodePatches.set(brokenAt, brokenParentPatch(nodes.get(brokenAt)!));
      issues.push({ kind: 'parent-cycle', nodeIds: [...cycle].sort(), brokenAt });
    }
    for (const id of path) state.set(id, 2);
  }

  // 4. parents before children (depth-first pre-order from the roots)
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const id of sorted) {
    const parent = parentOf.get(id);
    if (parent === undefined) roots.push(id);
    else {
      const list = children.get(parent);
      if (list) list.push(id);
      else children.set(parent, [id]);
    }
  }
  const nodeIds: string[] = [];
  const stack: string[] = [];
  for (const root of roots) {
    stack.push(root);
    while (stack.length) {
      const id = stack.pop()!;
      nodeIds.push(id);
      const kids = children.get(id);
      if (kids) for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]!);
    }
  }

  // 5 + 6. dangling and duplicate edges
  const edgeSorted = [...edges.keys()].sort((a, b) =>
    compareOrder(order(a, 'edge'), a, order(b, 'edge'), b),
  );
  const kept = new Set<string>();
  const byKey = new Map<string, string[]>();
  for (const id of [...edges.keys()].sort()) {
    const edge = edges.get(id)!;
    const missing = !nodes.has(edge.source) ? 'source' : !nodes.has(edge.target) ? 'target' : null;
    if (missing) {
      issues.push({ kind: 'dangling-edge', edgeId: id, missing });
      continue;
    }
    const key = edgeKey(edge);
    const same = byKey.get(key);
    if (same) same.push(id);
    else byKey.set(key, [id]);
  }
  for (const ids of byKey.values()) {
    // ids were visited in ascending order: the first one is the smallest
    kept.add(ids[0]!);
    if (ids.length > 1) issues.push({ kind: 'duplicate-edge', keep: ids[0]!, drop: ids.slice(1) });
  }
  // 7. edge order
  const edgeIds = edgeSorted.filter((id) => kept.has(id));

  return { nodeIds, edgeIds, nodePatches, issues };
}

/** Read the plain nodes/edges and the `order` function of a document. */
function readDoc(doc: Y.Doc, keys?: Partial<DocKeys>) {
  const maps = getMaps(doc, keys);
  const nodes = new Map<string, Node>();
  const edges = new Map<string, Edge>();
  const orders = { node: new Map<string, string>(), edge: new Map<string, string>() };
  maps.nodes.forEach((y, id) => {
    nodes.set(id, fromYNode(y));
    orders.node.set(id, getOrder(y));
  });
  maps.edges.forEach((y, id) => {
    edges.set(id, fromYEdge(y));
    orders.edge.set(id, getOrder(y));
  });
  return {
    maps,
    nodes,
    edges,
    order: (id: string, kind: 'node' | 'edge') => orders[kind].get(id) ?? '',
  };
}

/**
 * Validate a document: the issues {@link orderAndRepair} finds.
 *
 * @param doc - The document.
 * @param keys - Top-level map names (defaults `nodes`, `edges`, `meta`).
 */
export function validateDoc(doc: Y.Doc, keys?: Partial<DocKeys>): RepairIssue[] {
  const { nodes, edges, order } = readDoc(doc, keys);
  return orderAndRepair(nodes, edges, order).issues;
}

/**
 * Write the fixes for `issues` into the document: delete dangling and duplicate edges, clear
 * broken `parentId`s (and an `extent: 'parent'` that went with them). Must run inside a transaction.
 *
 * @returns The issues that were fixed, each with the number of user elements it removed.
 */
export function applyRepairs(
  maps: Pick<ReturnType<typeof getMaps>, 'nodes' | 'edges'>,
  issues: readonly RepairIssue[],
): { issue: RepairIssue; removed: number }[] {
  const done: { issue: RepairIssue; removed: number }[] = [];
  for (const issue of issues) {
    switch (issue.kind) {
      case 'dangling-edge':
        if (maps.edges.has(issue.edgeId)) {
          maps.edges.delete(issue.edgeId);
          done.push({ issue, removed: 1 });
        }
        break;
      case 'duplicate-edge': {
        let removed = 0;
        for (const id of issue.drop) {
          if (maps.edges.has(id)) {
            maps.edges.delete(id);
            removed++;
          }
        }
        if (removed) done.push({ issue, removed });
        break;
      }
      case 'orphan-parent': {
        const y = maps.nodes.get(issue.nodeId);
        if (y?.has('parentId')) {
          y.delete('parentId');
          if (y.get('extent') === 'parent') y.delete('extent');
          done.push({ issue, removed: 0 });
        }
        break;
      }
      case 'parent-cycle': {
        const y = maps.nodes.get(issue.brokenAt);
        if (y?.has('parentId')) {
          y.delete('parentId');
          if (y.get('extent') === 'parent') y.delete('extent');
          done.push({ issue, removed: 0 });
        }
        break;
      }
    }
  }
  return done;
}

/**
 * Validate and heal a document: apply {@link applyRepairs} in one transaction.
 *
 * @param doc - The document.
 * @param origin - Transaction origin (default {@link HEAL}; the server passes `'server'`).
 * @param keys - Top-level map names.
 * @returns The issues that were fixed (empty when the document was fine; nothing is written then).
 */
export function healDoc(
  doc: Y.Doc,
  origin: unknown = HEAL,
  keys?: Partial<DocKeys>,
): RepairIssue[] {
  const { maps, nodes, edges, order } = readDoc(doc, keys);
  const { issues } = orderAndRepair(nodes, edges, order);
  if (!issues.length) return [];
  const fixed: RepairIssue[] = [];
  doc.transact(() => {
    for (const f of applyRepairs(maps, issues)) fixed.push(f.issue);
  }, origin);
  return fixed;
}
