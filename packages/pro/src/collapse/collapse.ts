import { createId } from '@xy-lit/store';
import type { FlowStore, Node, NodeChange } from '@xy-lit/store';
import { storeOf } from '../common.js';
import type { FlowLike } from '../common.js';

/** Adjacency of the graph, built once per operation. */
interface Graph {
  out: Map<string, string[]>;
  roots: string[];
}

function buildGraph(store: FlowStore): Graph {
  const { nodes, edges } = store.getState();
  const out = new Map<string, string[]>();
  const indegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (e.source === e.target || !indegree.has(e.source) || !indegree.has(e.target)) continue;
    const list = out.get(e.source);
    if (list) list.push(e.target);
    else out.set(e.source, [e.target]);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }
  return { out, roots: nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id) };
}

/** Nodes reachable from `from` through outgoing edges, never entering `blocked`. */
function reach(graph: Graph, from: string[], blocked?: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...from];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === blocked || seen.has(id)) continue;
    seen.add(id);
    for (const next of graph.out.get(id) ?? []) stack.push(next);
  }
  return seen;
}

function descendantsIn(graph: Graph, nodeId: string): Set<string> {
  const below = reach(graph, graph.out.get(nodeId) ?? [], nodeId);
  below.delete(nodeId);
  if (!below.size) return below;
  // anything another root reaches without passing through the node stays visible
  const others = reach(
    graph,
    graph.roots.filter((r) => r !== nodeId),
    nodeId,
  );
  for (const id of others) below.delete(id);
  return below;
}

/**
 * The nodes that collapsing `nodeId` hides: everything reachable through its outgoing edges
 * (followed iteratively, so cycles are fine) that is not also reachable from another root
 * without passing through `nodeId`.
 *
 * @returns Node ids (not including `nodeId`).
 */
export function getCollapsibleDescendants(flow: FlowLike, nodeId: string): Set<string> {
  return descendantsIn(buildGraph(storeOf(flow)), nodeId);
}

/** Whether a node is collapsed (`data.collapsed === true`). */
export function isCollapsed(flow: FlowLike, nodeId: string): boolean {
  return storeOf(flow).getState().nodeLookup.get(nodeId)?.data.collapsed === true;
}

function replaceChange(node: Node, patch: { collapsed?: boolean; hidden?: boolean }): NodeChange {
  const item: Node = { ...node };
  if (patch.hidden !== undefined) item.hidden = patch.hidden;
  if (patch.collapsed !== undefined) item.data = { ...node.data, collapsed: patch.collapsed };
  return { id: node.id, type: 'replace', item };
}

function send(store: FlowStore, changes: NodeChange[]): void {
  store.triggerNodeChanges(changes, { phase: 'discrete', origin: 'api', gestureId: createId() });
}

/**
 * Collapse or expand the subtree below a node. The state lives in `node.data.collapsed`; the
 * descendants (see {@link getCollapsibleDescendants}) get `hidden: true` when collapsing, and
 * `hidden: false` when expanding unless they are also under another collapsed node. Their edges
 * disappear with them (the engine hides edges of hidden nodes). One change batch, so one
 * history step.
 *
 * @param flow - The `<xy-flow>` or its instance.
 * @param nodeId - The node to toggle.
 * @param collapsed - Force a state instead of toggling.
 * @returns The new state (false when the node does not exist).
 */
export function toggleCollapsed(flow: FlowLike, nodeId: string, collapsed?: boolean): boolean {
  const store = storeOf(flow);
  const { nodeLookup } = store.getState();
  const node = nodeLookup.get(nodeId);
  if (!node) return false;
  const next = collapsed ?? node.data.collapsed !== true;
  const graph = buildGraph(store);
  const below = descendantsIn(graph, nodeId);

  let hide = below;
  if (!next) {
    // keep what another collapsed node still hides
    const stillHidden = new Set<string>();
    for (const other of nodeLookup.values()) {
      if (other.id === nodeId || other.data.collapsed !== true) continue;
      for (const id of descendantsIn(graph, other.id)) stillHidden.add(id);
    }
    hide = new Set([...below].filter((id) => !stillHidden.has(id)));
  }

  const changes: NodeChange[] = [replaceChange(node.internals.userNode, { collapsed: next })];
  for (const id of hide) {
    const target = nodeLookup.get(id);
    if (!target || (target.hidden === true) === next) continue;
    changes.push(replaceChange(target.internals.userNode, { hidden: next }));
  }
  send(store, changes);
  return next;
}

/**
 * Collapse every node that has outgoing edges, so only the roots stay visible.
 *
 * @returns The ids of the nodes that were collapsed.
 */
export function collapseAll(flow: FlowLike): string[] {
  const store = storeOf(flow);
  const { nodeLookup } = store.getState();
  const graph = buildGraph(store);
  const parents = [...graph.out.keys()];
  const hide = new Set<string>();
  for (const id of parents) for (const d of descendantsIn(graph, id)) hide.add(d);
  const changes: NodeChange[] = [];
  const done: string[] = [];
  for (const node of nodeLookup.values()) {
    const patch: { collapsed?: boolean; hidden?: boolean } = {};
    if (graph.out.has(node.id) && node.data.collapsed !== true) patch.collapsed = true;
    if (hide.has(node.id) && node.hidden !== true) patch.hidden = true;
    if (patch.collapsed !== undefined || patch.hidden !== undefined) {
      changes.push(replaceChange(node.internals.userNode, patch));
    }
    if (patch.collapsed) done.push(node.id);
  }
  send(store, changes);
  return done;
}

/**
 * Expand every collapsed node and show what they hid.
 *
 * @returns The ids of the nodes that were expanded.
 */
export function expandAll(flow: FlowLike): string[] {
  const store = storeOf(flow);
  const { nodeLookup } = store.getState();
  const graph = buildGraph(store);
  const collapsed = [...nodeLookup.values()].filter((n) => n.data.collapsed === true);
  const show = new Set<string>();
  for (const c of collapsed) for (const d of descendantsIn(graph, c.id)) show.add(d);
  const changes: NodeChange[] = [];
  for (const node of nodeLookup.values()) {
    const patch: { collapsed?: boolean; hidden?: boolean } = {};
    if (node.data.collapsed === true) patch.collapsed = false;
    if (show.has(node.id) && node.hidden === true) patch.hidden = false;
    if (patch.collapsed !== undefined || patch.hidden !== undefined) {
      changes.push(replaceChange(node.internals.userNode, patch));
    }
  }
  send(store, changes);
  return collapsed.map((n) => n.id);
}
