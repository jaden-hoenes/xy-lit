import type * as Y from 'yjs';
import type { Edge, Node, RemoteNodeMeta, XYPosition } from '@xy-lit/store';
import type { LocalOverlay } from './overlay.js';
import { orderAndRepair } from './repair.js';
import type { RepairIssue } from './repair.js';
import { fromYEdge, fromYNode, getOrder } from './schema.js';
import type { DocMaps } from './schema.js';

/** What remote presence says about one node (see `remote-state.ts`). */
export type RemoteNodeView = {
  /** Selection, drag, resize and "added" decorations. */
  meta: RemoteNodeMeta;
  /** Position of a remote drag or resize in progress. */
  position?: XYPosition;
  /** Size of a remote resize in progress. */
  size?: { width: number; height: number };
};

/** Looks up the remote presence of a node. */
export interface RemoteLookup {
  get(id: string): RemoteNodeView | undefined;
}

/** Keys of an edge map whose change can alter which edges are shown. */
const EDGE_STRUCTURE_KEYS = ['order', 'source', 'target', 'sourceHandle', 'targetHandle'];
/** Keys of a node map whose change can alter node order or nesting. */
const NODE_STRUCTURE_KEYS = ['order', 'parentId'];

/** Result of {@link Materializer.flush}. */
export type FlushResult = {
  /** The `nodes` or `edges` array was replaced. */
  changed: boolean;
  /** The set of rendered node or edge ids changed. */
  structureChanged: boolean;
};

/**
 * Turns the document plus the local overlay and remote presence into the arrays the flow reads
 * (spec/11 §Yjs → arrays). Untouched elements keep their object identity; the arrays themselves
 * are replaced only when an element object or the order changed.
 */
export class Materializer<N extends Node = Node, E extends Edge = Edge> {
  nodes: N[] = [];
  edges: E[] = [];
  /** Issues found by the last {@link orderAndRepair} run. */
  issues: readonly RepairIssue[] = [];

  /** Nodes as read from the document (durable fields only), by id. */
  readonly docNodes = new Map<string, Node>();
  /** Edges as read from the document, by id. */
  readonly docEdges = new Map<string, Edge>();
  readonly nodeOrders = new Map<string, string>();
  readonly edgeOrders = new Map<string, string>();
  readonly nodeCache = new Map<string, N>();
  readonly edgeCache = new Map<string, E>();
  orderedNodeIds: string[] = [];
  orderedEdgeIds: string[] = [];
  /** The largest `order` of any node / edge (for appends). */
  maxNodeOrder: string | null = null;
  maxEdgeOrder: string | null = null;

  #docDirtyNodes: Set<string> | 'all' = 'all';
  #docDirtyEdges: Set<string> | 'all' = 'all';
  #viewDirtyNodes = new Set<string>();
  #viewDirtyEdges = new Set<string>();
  #structureDirty = true;
  #patches = new Map<string, Partial<Node>>();
  #nodeIdSet = new Set<string>();
  #edgeIdSet = new Set<string>();

  /**
   * @param maps - The document's maps.
   * @param overlay - Local-only state.
   * @param remote - Remote presence lookup (optional).
   */
  constructor(
    private readonly maps: DocMaps,
    private readonly overlay: LocalOverlay,
    private readonly remote?: () => RemoteLookup | undefined,
  ) {}

  // dirty tracking ------------------------------------------------------------------------------

  /** Everything must be rebuilt. */
  markAll(): void {
    this.#docDirtyNodes = 'all';
    this.#docDirtyEdges = 'all';
    this.#structureDirty = true;
  }

  /** A node's overlay or remote presence changed. */
  markNodeView(id: string): void {
    this.#viewDirtyNodes.add(id);
  }

  /** An edge's overlay changed. */
  markEdgeView(id: string): void {
    this.#viewDirtyEdges.add(id);
  }

  /** The node order or nesting may have changed. */
  markStructure(): void {
    this.#structureDirty = true;
  }

  /** Whether {@link flush} has work to do. */
  get dirty(): boolean {
    return (
      this.#structureDirty ||
      this.#docDirtyNodes === 'all' ||
      this.#docDirtyEdges === 'all' ||
      this.#docDirtyNodes.size > 0 ||
      this.#docDirtyEdges.size > 0 ||
      this.#viewDirtyNodes.size > 0 ||
      this.#viewDirtyEdges.size > 0
    );
  }

  /** Feed the events of a `nodesY.observeDeep` / `edgesY.observeDeep` callback. */
  handleEvents(
    kind: 'nodes' | 'edges',
    events: readonly Y.YEvent<Y.AbstractType<unknown>>[],
  ): void {
    const root = kind === 'nodes' ? this.maps.nodes : this.maps.edges;
    const structureKeys = kind === 'nodes' ? NODE_STRUCTURE_KEYS : EDGE_STRUCTURE_KEYS;
    for (const event of events) {
      if (event.target === root) {
        for (const key of event.changes.keys.keys()) this.#docDirty(kind, key);
        this.#structureDirty = true;
        continue;
      }
      let id: unknown;
      let depth: number;
      try {
        const path = event.path;
        id = path[0];
        depth = path.length;
      } catch {
        this.markAll();
        continue;
      }
      if (typeof id !== 'string') {
        this.markAll();
        continue;
      }
      this.#docDirty(kind, id);
      if (depth === 1 && structureKeys.some((k) => event.changes.keys.has(k))) {
        this.#structureDirty = true;
      }
    }
  }

  #docDirty(kind: 'nodes' | 'edges', id: string): void {
    const set = kind === 'nodes' ? this.#docDirtyNodes : this.#docDirtyEdges;
    if (set !== 'all') set.add(id);
  }

  // rebuild -------------------------------------------------------------------------------------

  /**
   * Bring `nodes` and `edges` up to date with everything marked dirty since the last flush.
   *
   * @returns What changed (the caller notifies listeners).
   */
  flush(): FlushResult {
    const result: FlushResult = { changed: false, structureChanged: false };
    if (!this.dirty) return result;

    this.#readDoc();

    let nodesChanged = false;
    let edgesChanged = false;

    if (this.#structureDirty) {
      this.#structureDirty = false;
      const repaired = orderAndRepair(
        this.docNodes,
        this.docEdges,
        (id, kind) => (kind === 'node' ? this.nodeOrders : this.edgeOrders).get(id) ?? '',
      );
      this.issues = repaired.issues;
      // nodes whose patch appeared, vanished or changed need a new object
      for (const id of new Set([...this.#patches.keys(), ...repaired.nodePatches.keys()])) {
        const a = this.#patches.get(id);
        const b = repaired.nodePatches.get(id);
        if (!a !== !b || (a && b && Object.keys(a).join() !== Object.keys(b).join())) {
          this.#viewDirtyNodes.add(id);
        }
      }
      this.#patches = repaired.nodePatches;

      const sameNodes =
        repaired.nodeIds.length === this.orderedNodeIds.length &&
        repaired.nodeIds.every((id, i) => id === this.orderedNodeIds[i]);
      const sameEdges =
        repaired.edgeIds.length === this.orderedEdgeIds.length &&
        repaired.edgeIds.every((id, i) => id === this.orderedEdgeIds[i]);
      if (!sameNodes) nodesChanged = true;
      if (!sameEdges) edgesChanged = true;
      this.orderedNodeIds = repaired.nodeIds;
      this.orderedEdgeIds = repaired.edgeIds;

      // forget what is gone
      const nodeIdSet = new Set(repaired.nodeIds);
      const edgeIdSet = new Set(repaired.edgeIds);
      for (const id of this.nodeCache.keys()) if (!nodeIdSet.has(id)) this.nodeCache.delete(id);
      for (const id of this.edgeCache.keys()) if (!edgeIdSet.has(id)) this.edgeCache.delete(id);
      result.structureChanged =
        nodeIdSet.size !== this.#nodeIdSet.size ||
        edgeIdSet.size !== this.#edgeIdSet.size ||
        repaired.nodeIds.some((id) => !this.#nodeIdSet.has(id)) ||
        repaired.edgeIds.some((id) => !this.#edgeIdSet.has(id));
      this.#nodeIdSet = nodeIdSet;
      this.#edgeIdSet = edgeIdSet;
      this.overlay.prune(
        (id) => this.docNodes.has(id),
        (id) => this.docEdges.has(id),
      );
      // every rendered element without a cache entry needs building
      for (const id of repaired.nodeIds) if (!this.nodeCache.has(id)) this.#viewDirtyNodes.add(id);
      for (const id of repaired.edgeIds) if (!this.edgeCache.has(id)) this.#viewDirtyEdges.add(id);
    }

    const remote = this.remote?.();
    for (const id of this.#viewDirtyNodes) {
      if (!this.#nodeIdSet.has(id)) continue;
      this.nodeCache.set(id, this.#buildNode(id, remote));
      nodesChanged = true;
    }
    for (const id of this.#viewDirtyEdges) {
      if (!this.#edgeIdSet.has(id)) continue;
      this.edgeCache.set(id, this.#buildEdge(id));
      edgesChanged = true;
    }
    this.#viewDirtyNodes.clear();
    this.#viewDirtyEdges.clear();

    if (nodesChanged) {
      this.nodes = this.orderedNodeIds.map((id) => this.nodeCache.get(id)!);
      result.changed = true;
    }
    if (edgesChanged) {
      this.edges = this.orderedEdgeIds.map((id) => this.edgeCache.get(id)!);
      result.changed = true;
    }
    return result;
  }

  /** Re-read dirty elements from the document into the plain caches. */
  #readDoc(): void {
    const { nodes, edges } = this.maps;
    const readNodes = this.#docDirtyNodes;
    const readEdges = this.#docDirtyEdges;
    this.#docDirtyNodes = new Set();
    this.#docDirtyEdges = new Set();

    if (readNodes === 'all') {
      this.docNodes.clear();
      this.nodeOrders.clear();
      nodes.forEach((y, id) => {
        this.docNodes.set(id, fromYNode(y));
        this.nodeOrders.set(id, getOrder(y));
        this.#viewDirtyNodes.add(id);
      });
    } else {
      for (const id of readNodes) {
        const y = nodes.get(id);
        if (y) {
          this.docNodes.set(id, fromYNode(y));
          this.nodeOrders.set(id, getOrder(y));
          this.#viewDirtyNodes.add(id);
        } else {
          this.docNodes.delete(id);
          this.nodeOrders.delete(id);
        }
      }
    }
    if (readEdges === 'all') {
      this.docEdges.clear();
      this.edgeOrders.clear();
      edges.forEach((y, id) => {
        this.docEdges.set(id, fromYEdge(y));
        this.edgeOrders.set(id, getOrder(y));
        this.#viewDirtyEdges.add(id);
      });
    } else {
      for (const id of readEdges) {
        const y = edges.get(id);
        if (y) {
          this.docEdges.set(id, fromYEdge(y));
          this.edgeOrders.set(id, getOrder(y));
          this.#viewDirtyEdges.add(id);
        } else {
          this.docEdges.delete(id);
          this.edgeOrders.delete(id);
        }
      }
    }
    if (readNodes === 'all' || readEdges === 'all' || readNodes.size || readEdges.size) {
      this.maxNodeOrder = maxOf(this.nodeOrders);
      this.maxEdgeOrder = maxOf(this.edgeOrders);
    }
  }

  #buildNode(id: string, remote: RemoteLookup | undefined): N {
    const base = this.docNodes.get(id)!;
    const out: Record<string, unknown> = { ...base };
    const patch = this.#patches.get(id);
    if (patch) {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete out[k];
        else out[k] = v;
      }
    }
    const ov = this.overlay.getNode(id);
    const view = remote?.get(id);
    if (ov) {
      if (ov.selected !== undefined) out.selected = ov.selected;
      if (ov.dragging !== undefined) out.dragging = ov.dragging;
      if (ov.resizing !== undefined) out.resizing = ov.resizing;
      if (ov.measured) out.measured = { ...ov.measured };
    }
    const livePosition = ov?.livePosition ?? view?.position;
    if (livePosition) out.position = { x: livePosition.x, y: livePosition.y };
    const liveSize = ov?.liveSize ?? view?.size;
    if (liveSize) {
      out.width = liveSize.width;
      out.height = liveSize.height;
    }
    if (view && hasMeta(view.meta)) out.remote = view.meta;
    return out as unknown as N;
  }

  #buildEdge(id: string): E {
    const base = this.docEdges.get(id)!;
    const ov = this.overlay.getEdge(id);
    return (ov?.selected !== undefined ? { ...base, selected: ov.selected } : { ...base }) as E;
  }

  /** The plain, durable nodes and edges (no overlay, no remote), repaired and ordered. */
  toObject(): { nodes: N[]; edges: E[] } {
    const nodes = this.orderedNodeIds.map((id) => {
      const out: Record<string, unknown> = { ...this.docNodes.get(id) };
      for (const [k, v] of Object.entries(this.#patches.get(id) ?? {})) {
        if (v === undefined) delete out[k];
        else out[k] = v;
      }
      return out as unknown as N;
    });
    const edges = this.orderedEdgeIds.map((id) => ({ ...this.docEdges.get(id)! }) as unknown as E);
    return { nodes, edges };
  }
}

function maxOf(orders: ReadonlyMap<string, string>): string | null {
  let max: string | null = null;
  for (const o of orders.values()) if (o && (max === null || o > max)) max = o;
  return max;
}

function hasMeta(meta: RemoteNodeMeta): boolean {
  return !!(meta.selectedBy?.length || meta.draggingBy || meta.resizingBy || meta.addedBy);
}
