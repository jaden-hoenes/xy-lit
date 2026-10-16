import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import type {
  ChangeMeta,
  Edge,
  EdgeChange,
  FlowDataSource,
  FlowStore,
  Node,
  NodeChange,
  RemoteUser,
  Viewport,
} from '@xy-lit/store';
import { PresenceChannel } from './awareness.js';
import type { PresenceState } from './awareness.js';
import { Materializer } from './materialize.js';
import { runMigrations } from './migrations.js';
import type { Migration } from './migrations.js';
import { initialOrders, keyBetween } from './order.js';
import { HEAL, LOCAL, MIGRATION } from './origins.js';
import { LocalOverlay } from './overlay.js';
import { RemoteState } from './remote-state.js';
import { applyRepairs } from './repair.js';
import type { RepairIssue } from './repair.js';
import {
  EDGE_LOCAL_KEYS,
  NODE_LOCAL_KEYS,
  ORDER_KEY,
  SCHEMA_VERSION,
  SchemaError,
  cloneJson,
  getMaps,
  jsonEqual,
  resolveKeys,
  toYEdge,
  toYNode,
} from './schema.js';
import type { DocKeys, DocMaps } from './schema.js';
import { YjsHistory } from './undo.js';

/** Options of {@link YjsFlowSource} (spec/11 §Public API). */
export type YjsFlowSourceOptions = {
  /** Awareness of the provider; presence is disabled without it (and without `user`). */
  awareness?: Awareness;
  /** Who the local user is (shown to others). */
  user?: { id: string; name: string; color: string; avatar?: string };
  /** `'awareness'` (default): live drags travel through awareness, one document write on drop. */
  livePositions?: 'awareness' | 'document';
  /** Undo/redo of local edits. `false` disables; default `{ captureTimeout: 400 }`. */
  undo?: false | { captureTimeout?: number };
  /** Repair dangling edges and broken parents in the document (default true). */
  heal?: boolean;
  /** Ignore moves and resizes of nodes a remote user is dragging (default true). */
  softLocks?: boolean;
  /** Node type to the `data` keys stored as `Y.Text`. */
  richText?: Record<string, string[]>;
  /** Schema migrations. */
  migrations?: Migration[];
  /** Run migrations and healing only after this resolves (pass the provider's sync promise). */
  synced?: Promise<unknown>;
  /** Ignore all document writes (overlay and presence still work). */
  readOnly?: boolean;
  /** Names of the top-level maps. */
  keys?: { nodes?: string; edges?: string; meta?: string };
};

/** How long a client waits before healing, and between checks when it is not the healer. */
const HEAL_DELAY = 500;
const HEAL_RECHECK = 2000;

type Ctx = {
  /** Writes performed inside the one `LOCAL` transaction. */
  ops: (() => void)[];
  /** Node ids in the order they will have after this batch (grows with every add). */
  nodeIds?: string[];
  edgeIds?: string[];
  nodeOrders: Map<string, string>;
  edgeOrders: Map<string, string>;
  removedNodes: Set<string>;
  removedEdges: Set<string>;
  addedNodes: Set<string>;
  addedEdges: Set<string>;
  children?: Map<string, string[]>;
};

type Size = { width: number; height: number };

/** Replace the contents of a `Y.Text` with `next` using one delete and one insert. */
export function applyTextDiff(text: Y.Text, next: string): void {
  const current = text.toJSON();
  if (current === next) return;
  let start = 0;
  const max = Math.min(current.length, next.length);
  while (start < max && current.charCodeAt(start) === next.charCodeAt(start)) start++;
  // never split a surrogate pair
  if (start > 0 && isHigh(current.charCodeAt(start - 1))) start--;
  let endCur = current.length;
  let endNext = next.length;
  while (
    endCur > start &&
    endNext > start &&
    current.charCodeAt(endCur - 1) === next.charCodeAt(endNext - 1)
  ) {
    endCur--;
    endNext--;
  }
  if (endCur < current.length && isLow(current.charCodeAt(endCur))) {
    endCur++;
    endNext++;
  }
  if (endCur > start) text.delete(start, endCur - start);
  if (endNext > start) text.insert(start, next.slice(start, endNext));
}
const isHigh = (c: number): boolean => c >= 0xd800 && c <= 0xdbff;
const isLow = (c: number): boolean => c >= 0xdc00 && c <= 0xdfff;

/**
 * A `FlowDataSource` backed by a Yjs document. The flow does not know about Yjs:
 * `flow.source = new YjsFlowSource(doc, { awareness, user })`. The transport is the app's choice.
 *
 * The document holds the durable fields; selection, drag state and measurements live in a local
 * overlay, and live drags travel through awareness until the drop (spec/11).
 */
export class YjsFlowSource<N extends Node = Node, E extends Edge = Edge> implements FlowDataSource<
  N,
  E
> {
  /** The shared document the source reads and writes. */
  readonly doc: Y.Doc;
  /** Bumped when the set of rendered nodes or edges changed. */
  structureVersion = 0;
  /** True while listeners are notified about a change that came from another client. */
  lastUpdateRemote = false;
  readonly history: YjsHistory | undefined;
  /** The presence channel (cursor, selection, live drags); `undefined` without `awareness` and `user`. */
  readonly presence: PresenceChannel | undefined;

  readonly #opts: Required<
    Pick<YjsFlowSourceOptions, 'livePositions' | 'heal' | 'softLocks' | 'richText'>
  >;
  readonly #awareness: Awareness | undefined;
  readonly #keys: DocKeys;
  readonly #maps: DocMaps;
  readonly #overlay: LocalOverlay;
  readonly #mat: Materializer<N, E>;
  readonly #remote: RemoteState | undefined;
  readonly #listeners = new Set<() => void>();
  readonly #cleanup: (() => void)[] = [];
  #store: FlowStore<N, E> | null = null;
  #storeCleanup: (() => void)[] = [];
  #hold = 0;
  #held = false;
  #readOnly: boolean;
  #tooNew = false;
  #ready = false;
  #destroyed = false;
  #healTimer: ReturnType<typeof setTimeout> | null = null;
  #pendingErrors: { code: string; message: string }[] = [];
  #lastPresence = { connection: '', viewport: '' };

  /**
   * @param doc - The shared document.
   * @param options - See {@link YjsFlowSourceOptions}.
   */
  constructor(doc: Y.Doc, options: YjsFlowSourceOptions = {}) {
    this.doc = doc;
    this.#opts = {
      livePositions: options.livePositions ?? 'awareness',
      heal: options.heal ?? true,
      softLocks: options.softLocks ?? true,
      richText: options.richText ?? {},
    };
    this.#awareness = options.awareness;
    this.#readOnly = options.readOnly ?? false;
    this.#keys = resolveKeys(options.keys);
    this.#maps = getMaps(doc, this.#keys);

    if (options.awareness && options.user) {
      this.presence = new PresenceChannel(options.awareness, options.user);
      this.#remote = new RemoteState(this.presence);
    }

    this.#overlay = new LocalOverlay(
      (kind, id) => (kind === 'node' ? this.#mat.markNodeView(id) : this.#mat.markEdgeView(id)),
      () => this.#publishSelection(),
    );
    this.#mat = new Materializer<N, E>(this.#maps, this.#overlay, () => this.#remote);
    this.#mat.flush();

    const onNodes = (events: Y.YEvent<Y.AbstractType<unknown>>[], tx: Y.Transaction): void => {
      this.#mat.handleEvents('nodes', events);
      this.#markRemoteAdds(events, tx);
    };
    const onEdges = (events: Y.YEvent<Y.AbstractType<unknown>>[]): void => {
      this.#mat.handleEvents('edges', events);
    };
    const onAfter = (tx: Y.Transaction): void => this.#afterTransaction(tx);
    this.#maps.nodes.observeDeep(onNodes);
    this.#maps.edges.observeDeep(onEdges);
    doc.on('afterTransaction', onAfter);
    this.#cleanup.push(
      () => this.#maps.nodes.unobserveDeep(onNodes),
      () => this.#maps.edges.unobserveDeep(onEdges),
      () => doc.off('afterTransaction', onAfter),
    );

    if (options.undo !== false) {
      this.history = new YjsHistory(
        [this.#maps.nodes, this.#maps.edges],
        {
          get: () => ({
            nodes: this.#overlay.selectedNodeIds(),
            edges: this.#overlay.selectedEdgeIds(),
          }),
          restore: (s) => this.#restoreSelection(s),
        },
        options.undo?.captureTimeout ?? 400,
      );
    }

    if (this.presence && this.#remote) {
      const remote = this.#remote;
      this.#cleanup.push(
        this.presence.subscribe(() => {
          const dirty = remote.update();
          if (!dirty.size) return;
          for (const id of dirty) this.#mat.markNodeView(id);
          this.#flush(true);
        }),
      );
    }

    const start = (): void => {
      if (this.#destroyed) return;
      this.#runMigrations(options.migrations ?? []);
      this.#ready = true;
      this.#scheduleHeal();
    };
    if (options.synced) void options.synced.then(start, start);
    else start();
  }

  // data source ---------------------------------------------------------------------------------

  /** The nodes, ordered and repaired, with the local overlay applied. */
  get nodes(): N[] {
    return this.#mat.nodes;
  }

  /** The edges, ordered and repaired. */
  get edges(): E[] {
    return this.#mat.edges;
  }

  /** Issues found in the document by the last materialisation. */
  get issues(): readonly RepairIssue[] {
    return this.#mat.issues;
  }

  /** Whether document writes are ignored (option `readOnly`, or a document that is too new). */
  get readOnly(): boolean {
    return this.#readOnly || this.#tooNew;
  }
  set readOnly(value: boolean) {
    this.#readOnly = value;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Called by the flow when it starts using the source. */
  attach(store: FlowStore<N, E>): void {
    this.#detachStore();
    this.#store = store;
    this.#storeCleanup.push(
      store.addNodeChangeMiddleware((changes, meta) => this.#softLock(changes, meta)),
      store.subscribe(() => this.#publishFromStore(store)),
    );
    for (const e of this.#pendingErrors.splice(0)) store.reportError(e.code, e.message);
    this.#publishFromStore(store);
    this.#scheduleHeal();
  }

  /** Called by the flow when it stops using the source. */
  detach(): void {
    this.#detachStore();
    this.presence?.setConnection(null);
    this.presence?.setDrag(null);
    this.presence?.setResize(null);
    this.presence?.setCursor(null);
  }

  /** Detach and remove every observer, timer and the undo manager. */
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.detach();
    if (this.#healTimer) clearTimeout(this.#healTimer);
    this.#healTimer = null;
    for (const fn of this.#cleanup.splice(0)) fn();
    this.history?.destroy();
    this.#remote?.destroy();
    this.presence?.destroy();
    this.#listeners.clear();
  }

  /** The durable fields of every node and edge (no local state, no remote presence). */
  toObject(): { nodes: N[]; edges: E[] } {
    return this.#mat.toObject();
  }

  /**
   * Fill an empty document. Written with the `MIGRATION` origin, so it is not undoable.
   *
   * @param doc - The document.
   * @param data - Nodes and edges, in order.
   * @param options - `richText` and `keys` as for the source.
   */
  static populate(
    doc: Y.Doc,
    data: { nodes: Node[]; edges: Edge[] },
    options: Pick<YjsFlowSourceOptions, 'richText' | 'keys'> = {},
  ): void {
    const maps = getMaps(doc, options.keys);
    const nodeOrders = initialOrders(data.nodes.length);
    const edgeOrders = initialOrders(data.edges.length);
    doc.transact(() => {
      data.nodes.forEach((n, i) => {
        maps.nodes.set(n.id, toYNode(n, nodeOrders[i]!, options.richText?.[n.type ?? ''] ?? []));
      });
      data.edges.forEach((e, i) => maps.edges.set(e.id, toYEdge(e, edgeOrders[i]!)));
      maps.meta.set('schema', SCHEMA_VERSION);
      if (!maps.meta.has('createdAt')) maps.meta.set('createdAt', Date.now());
    }, MIGRATION);
  }

  // applying changes ----------------------------------------------------------------------------

  /** Group several applies into one atomic unit: one document transaction, one undo step. */
  transact(fn: () => void, origin?: unknown): void {
    if (this.readOnly) return;
    this.#batch(() => this.doc.transact(fn, origin ?? LOCAL));
  }

  applyNodeChanges(changes: NodeChange<N>[], meta: ChangeMeta<N, E>): void {
    this.#batch(() => {
      if (meta.phase === 'start' || meta.phase === 'end') this.history?.stopCapturing();
      const ctx = this.#ctx();
      const live = meta.phase === 'start' || meta.phase === 'live';
      const document = this.#opts.livePositions === 'document';
      const resizeBatch =
        meta.origin === 'resize' ||
        changes.some((c) => c.type === 'dimensions' && c.resizing === true);
      const dragPositions: Record<string, { x: number; y: number }> = {};
      const resizeInfo = new Map<string, { size?: Size; position?: { x: number; y: number } }>();
      const commitResize = new Set<string>();

      for (const change of changes) {
        if (change.type === 'add') {
          this.#addNode(ctx, change.item, change.index);
          continue;
        }
        const id = change.id;
        if (ctx.removedNodes.has(id)) continue;
        if (change.type === 'remove') {
          this.#removeNode(ctx, id);
          continue;
        }
        if (!this.#mat.docNodes.has(id) && !ctx.addedNodes.has(id)) continue;
        switch (change.type) {
          case 'select':
            this.#overlay.patchNode(id, { selected: change.selected });
            break;
          case 'replace':
            this.#replaceNode(ctx, id, change.item);
            break;
          case 'position': {
            const ov = this.#overlay.getNode(id);
            const position =
              change.position ?? (meta.phase === 'end' ? ov?.livePosition : undefined);
            const patch: Parameters<LocalOverlay['patchNode']>[1] = {};
            if (change.dragging !== undefined) patch.dragging = change.dragging;
            if (position && !document && live) {
              patch.livePosition = position;
              if (resizeBatch) {
                const info = resizeInfo.get(id) ?? {};
                info.position = position;
                resizeInfo.set(id, info);
              } else dragPositions[id] = position;
            } else if (position) {
              this.#writeNodePosition(ctx, id, position);
              patch.livePosition = undefined;
            } else if (meta.phase === 'end') patch.livePosition = undefined;
            this.#overlay.patchNode(id, patch);
            break;
          }
          case 'dimensions': {
            const dims = change.dimensions;
            const patch: Parameters<LocalOverlay['patchNode']>[1] = {};
            if (dims) {
              patch.measured = { ...dims };
              if (change.setAttributes) {
                if (live && !document) {
                  const current = this.#currentSize(id);
                  const size = {
                    width:
                      change.setAttributes === true || change.setAttributes === 'width'
                        ? dims.width
                        : current.width,
                    height:
                      change.setAttributes === true || change.setAttributes === 'height'
                        ? dims.height
                        : current.height,
                  };
                  patch.liveSize = size;
                  const info = resizeInfo.get(id) ?? {};
                  info.size = size;
                  resizeInfo.set(id, info);
                } else {
                  this.#writeNodeSize(ctx, id, dims, change.setAttributes);
                  patch.liveSize = undefined;
                }
              }
            }
            if (change.resizing !== undefined) patch.resizing = change.resizing;
            else if (live && change.setAttributes && meta.origin === 'resize')
              patch.resizing = true;
            if (change.resizing === false && meta.phase === 'end') commitResize.add(id);
            this.#overlay.patchNode(id, patch);
            break;
          }
        }
      }

      for (const id of commitResize) {
        const ov = this.#overlay.getNode(id);
        if (ov?.liveSize) this.#writeNodeSize(ctx, id, ov.liveSize, true);
        if (ov?.livePosition) this.#writeNodePosition(ctx, id, ov.livePosition);
        this.#overlay.patchNode(id, { liveSize: undefined, livePosition: undefined });
      }

      // presence
      if (this.presence && !document) {
        if (resizeBatch) {
          if (live) {
            const [id, info] = [...resizeInfo].find(([, i]) => i.size) ?? [];
            if (id && info?.size) {
              const node = this.#mat.docNodes.get(id);
              this.presence.setResize({
                id,
                width: info.size.width,
                height: info.size.height,
                position: info.position ??
                  this.#overlay.getNode(id)?.livePosition ??
                  node?.position ?? { x: 0, y: 0 },
              });
            }
          } else if (meta.phase === 'end') this.presence.setResize(null);
        } else if (live && Object.keys(dragPositions).length) {
          this.presence.setDrag({ ids: Object.keys(dragPositions), positions: dragPositions });
        } else if (meta.phase === 'end') {
          this.presence.setDrag(null);
        }
      }

      this.#run(ctx, meta);
    });
  }

  applyEdgeChanges(changes: EdgeChange<E>[], meta: ChangeMeta<N, E>): void {
    this.#batch(() => {
      if (meta.phase === 'start' || meta.phase === 'end') this.history?.stopCapturing();
      const ctx = this.#ctx();
      for (const change of changes) {
        if (change.type === 'add') {
          this.#addEdge(ctx, change.item, change.index);
          continue;
        }
        const id = change.id;
        if (ctx.removedEdges.has(id)) continue;
        if (change.type === 'remove') {
          ctx.removedEdges.add(id);
          ctx.ops.push(() => this.#maps.edges.delete(id));
          continue;
        }
        if (!this.#mat.docEdges.has(id) && !ctx.addedEdges.has(id)) continue;
        if (change.type === 'select') this.#overlay.patchEdge(id, { selected: change.selected });
        else if (change.type === 'replace') this.#replaceEdge(ctx, id, change.item);
      }
      this.#run(ctx, meta);
    });
  }

  updateNodeData(id: string, patch: Partial<N['data']>, meta: ChangeMeta<N, E>): void {
    this.#batch(() => {
      const ctx = this.#ctx();
      this.#patchData(ctx, 'nodes', id, patch);
      this.#run(ctx, meta);
    });
  }

  updateEdgeData(id: string, patch: Partial<NonNullable<E['data']>>, meta: ChangeMeta<N, E>): void {
    this.#batch(() => {
      const ctx = this.#ctx();
      this.#patchData(ctx, 'edges', id, patch);
      this.#run(ctx, meta);
    });
  }

  // node writes ---------------------------------------------------------------------------------

  #ctx(): Ctx {
    return {
      ops: [],
      nodeOrders: new Map(),
      edgeOrders: new Map(),
      removedNodes: new Set(),
      removedEdges: new Set(),
      addedNodes: new Set(),
      addedEdges: new Set(),
    };
  }

  /** Run the collected writes in one `LOCAL` transaction. */
  #run(ctx: Ctx, meta: ChangeMeta<N, E>): void {
    if (ctx.ops.length && !this.readOnly) {
      this.doc.transact(() => {
        for (const op of ctx.ops) op();
      }, LOCAL);
    }
    if (meta.phase === 'end') this.history?.stopCapturing();
  }

  #reportSchemaError(error: unknown): void {
    const code = error instanceof SchemaError ? error.code : 'XYL10';
    const message = error instanceof Error ? error.message : String(error);
    if (this.#store) this.#store.reportError(code, message);
    else this.#pendingErrors.push({ code, message });
  }

  #richKeys(type: string | undefined): readonly string[] {
    return this.#opts.richText[type ?? ''] ?? [];
  }

  #writeNodePosition(ctx: Ctx, id: string, position: { x: number; y: number }): void {
    const value = { x: position.x, y: position.y };
    ctx.ops.push(() => {
      const y = this.#maps.nodes.get(id);
      if (y && !jsonEqual(y.get('position'), value)) y.set('position', value);
    });
  }

  #writeNodeSize(
    ctx: Ctx,
    id: string,
    dims: { width: number; height: number },
    setAttributes: boolean | 'width' | 'height',
  ): void {
    ctx.ops.push(() => {
      const y = this.#maps.nodes.get(id);
      if (!y) return;
      if ((setAttributes === true || setAttributes === 'width') && y.get('width') !== dims.width) {
        y.set('width', dims.width);
      }
      if (
        (setAttributes === true || setAttributes === 'height') &&
        y.get('height') !== dims.height
      ) {
        y.set('height', dims.height);
      }
    });
  }

  #currentSize(id: string): Size {
    const ov = this.#overlay.getNode(id);
    const doc = this.#mat.docNodes.get(id);
    return {
      width: ov?.liveSize?.width ?? doc?.width ?? ov?.measured?.width ?? 0,
      height: ov?.liveSize?.height ?? doc?.height ?? ov?.measured?.height ?? 0,
    };
  }

  /** Order key for a new element at `index` (appended when undefined). */
  #orderFor(ctx: Ctx, kind: 'node' | 'edge', index: number | undefined): string {
    const isNode = kind === 'node';
    const ids = isNode
      ? (ctx.nodeIds ??= [...this.#mat.orderedNodeIds])
      : (ctx.edgeIds ??= [...this.#mat.orderedEdgeIds]);
    const pending = isNode ? ctx.nodeOrders : ctx.edgeOrders;
    const persisted = isNode ? this.#mat.nodeOrders : this.#mat.edgeOrders;
    const orderOf = (id: string | undefined): string | null =>
      id === undefined ? null : (pending.get(id) ?? persisted.get(id) ?? null);
    if (index === undefined || index >= ids.length) {
      let max: string | null = isNode ? this.#mat.maxNodeOrder : this.#mat.maxEdgeOrder;
      for (const o of pending.values()) if (max === null || o > max) max = o;
      return keyBetween(max, null);
    }
    const at = Math.max(0, index);
    return keyBetween(orderOf(ids[at - 1]), orderOf(ids[at]));
  }

  #addNode(ctx: Ctx, item: N, index: number | undefined): void {
    const id = item.id;
    if (this.#mat.docNodes.has(id) || ctx.addedNodes.has(id)) {
      this.#replaceNode(ctx, id, item);
      return;
    }
    const order = this.#orderFor(ctx, 'node', index);
    let y: Y.Map<unknown>;
    try {
      y = toYNode(item, order, this.#richKeys(item.type));
    } catch (error) {
      this.#reportSchemaError(error);
      return;
    }
    ctx.addedNodes.add(id);
    ctx.removedNodes.delete(id);
    ctx.nodeOrders.set(id, order);
    const ids = (ctx.nodeIds ??= [...this.#mat.orderedNodeIds]);
    if (index === undefined || index >= ids.length) ids.push(id);
    else ids.splice(Math.max(0, index), 0, id);
    ctx.ops.push(() => this.#maps.nodes.set(id, y));
    const local: Parameters<LocalOverlay['patchNode']>[1] = {};
    if (item.selected !== undefined) local.selected = item.selected;
    if (item.dragging !== undefined) local.dragging = item.dragging;
    if (item.resizing !== undefined) local.resizing = item.resizing;
    if (item.measured) local.measured = { ...item.measured };
    if (Object.keys(local).length) {
      // the node does not exist yet: apply the overlay once it does
      ctx.ops.push(() => this.#overlay.patchNode(id, local));
    }
  }

  #addEdge(ctx: Ctx, item: E, index: number | undefined): void {
    const id = item.id;
    if (this.#mat.docEdges.has(id) || ctx.addedEdges.has(id)) {
      this.#replaceEdge(ctx, id, item);
      return;
    }
    const order = this.#orderFor(ctx, 'edge', index);
    let y: Y.Map<unknown>;
    try {
      y = toYEdge(item, order);
    } catch (error) {
      this.#reportSchemaError(error);
      return;
    }
    ctx.addedEdges.add(id);
    ctx.removedEdges.delete(id);
    ctx.edgeOrders.set(id, order);
    const ids = (ctx.edgeIds ??= [...this.#mat.orderedEdgeIds]);
    if (index === undefined || index >= ids.length) ids.push(id);
    else ids.splice(Math.max(0, index), 0, id);
    ctx.ops.push(() => this.#maps.edges.set(id, y));
    if (item.selected !== undefined) {
      ctx.ops.push(() => this.#overlay.patchEdge(id, { selected: item.selected }));
    }
  }

  /** A node, its descendants and every edge that touches one of them. */
  #removeNode(ctx: Ctx, id: string): void {
    if (!ctx.children) {
      ctx.children = new Map();
      for (const [nid, node] of this.#mat.docNodes) {
        const parent = node.parentId;
        if (!parent) continue;
        const list = ctx.children.get(parent);
        if (list) list.push(nid);
        else ctx.children.set(parent, [nid]);
      }
    }
    const doomed: string[] = [];
    const stack = [id];
    while (stack.length) {
      const next = stack.pop()!;
      if (ctx.removedNodes.has(next)) continue;
      ctx.removedNodes.add(next);
      doomed.push(next);
      for (const child of ctx.children.get(next) ?? []) stack.push(child);
    }
    const doomedSet = new Set(doomed);
    for (const [eid, edge] of this.#mat.docEdges) {
      if (doomedSet.has(edge.source) || doomedSet.has(edge.target)) {
        if (!ctx.removedEdges.has(eid)) {
          ctx.removedEdges.add(eid);
          ctx.ops.push(() => this.#maps.edges.delete(eid));
        }
      }
    }
    ctx.ops.push(() => {
      for (const nid of doomed) this.#maps.nodes.delete(nid);
    });
  }

  /** Write what differs between the node the user saw and `item`. */
  #replaceNode(ctx: Ctx, id: string, item: N): void {
    const before = this.#mat.nodeCache.get(id) ?? this.#mat.docNodes.get(id);
    ctx.ops.push(() => {
      const y = this.#maps.nodes.get(id);
      if (!y || !before) return;
      try {
        this.#diffInto(y, before, item, NODE_LOCAL_KEYS, this.#richKeys(item.type));
      } catch (error) {
        this.#reportSchemaError(error);
      }
    });
    const local: Parameters<LocalOverlay['patchNode']>[1] = {};
    if (item.selected !== undefined) local.selected = item.selected;
    if (Object.keys(local).length) this.#overlay.patchNode(id, local);
  }

  #replaceEdge(ctx: Ctx, id: string, item: E): void {
    const before = this.#mat.edgeCache.get(id) ?? this.#mat.docEdges.get(id);
    ctx.ops.push(() => {
      const y = this.#maps.edges.get(id);
      if (!y || !before) return;
      try {
        this.#diffInto(y, before, item, EDGE_LOCAL_KEYS, []);
      } catch (error) {
        this.#reportSchemaError(error);
      }
    });
    if (item.selected !== undefined) this.#overlay.patchEdge(id, { selected: item.selected });
  }

  /** Top-level diff of `before` to `item` written into `y`; `data` is diffed per key. */
  #diffInto(
    y: Y.Map<unknown>,
    before: Record<string, unknown>,
    item: Record<string, unknown>,
    local: ReadonlySet<string>,
    richKeys: readonly string[],
  ): void {
    const keys = new Set([...Object.keys(before), ...Object.keys(item)]);
    for (const key of keys) {
      if (local.has(key) || key === ORDER_KEY || key === 'data') continue;
      const next = item[key];
      if (jsonEqual(before[key], next)) continue;
      if (next === undefined) {
        if (y.has(key)) y.delete(key);
      } else {
        y.set(key, cloneJson(next, key));
      }
    }
    const nextData = item.data as Record<string, unknown> | undefined;
    const prevData = (before.data ?? {}) as Record<string, unknown>;
    if (nextData === undefined) {
      if (y.has('data') && Object.keys(prevData).length) y.delete('data');
      return;
    }
    let yData = y.get('data');
    if (!(yData instanceof Y.Map)) {
      yData = new Y.Map<unknown>();
      y.set('data', yData);
    }
    const dataMap = yData as Y.Map<unknown>;
    for (const [k, v] of Object.entries(nextData)) {
      if (v === undefined) {
        if (dataMap.has(k)) dataMap.delete(k);
        continue;
      }
      if (jsonEqual(prevData[k], v) && dataMap.has(k)) continue;
      this.#setDataKey(dataMap, k, v, richKeys);
    }
    for (const k of Object.keys(prevData)) {
      if (!(k in nextData) && dataMap.has(k)) dataMap.delete(k);
    }
  }

  #setDataKey(
    yData: Y.Map<unknown>,
    key: string,
    value: unknown,
    richKeys: readonly string[],
  ): void {
    const existing = yData.get(key);
    if (typeof value === 'string' && existing instanceof Y.Text) {
      applyTextDiff(existing, value);
    } else if (typeof value === 'string' && richKeys.includes(key)) {
      yData.set(key, new Y.Text(value));
    } else {
      yData.set(key, cloneJson(value, `data.${key}`));
    }
  }

  #patchData(ctx: Ctx, kind: 'nodes' | 'edges', id: string, patch: Record<string, unknown>): void {
    const known = kind === 'nodes' ? this.#mat.docNodes.has(id) : this.#mat.docEdges.has(id);
    if (!known) return;
    // validate before the transaction so a bad value changes nothing
    for (const [k, v] of Object.entries(patch)) {
      try {
        if (v !== undefined) cloneJson(v, `data.${k}`);
      } catch (error) {
        this.#reportSchemaError(error);
        return;
      }
    }
    const type = kind === 'nodes' ? this.#mat.docNodes.get(id)?.type : undefined;
    ctx.ops.push(() => {
      const y = (kind === 'nodes' ? this.#maps.nodes : this.#maps.edges).get(id);
      if (!y) return;
      let yData = y.get('data');
      if (!(yData instanceof Y.Map)) {
        yData = new Y.Map<unknown>();
        y.set('data', yData);
      }
      const dataMap = yData as Y.Map<unknown>;
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) {
          if (dataMap.has(k)) dataMap.delete(k);
        } else if (!jsonEqual(dataMap.get(k), v) || dataMap.get(k) instanceof Y.Text) {
          this.#setDataKey(dataMap, k, v, this.#richKeys(type));
        }
      }
    });
  }

  // notifications -------------------------------------------------------------------------------

  /** Hold notifications until the outermost batch ends, then notify once. */
  #batch(fn: () => void): void {
    this.#hold++;
    try {
      fn();
    } finally {
      this.#hold--;
      if (this.#hold === 0) this.#flush(false);
    }
  }

  #afterTransaction(tx: Y.Transaction): void {
    const remote = tx.origin !== LOCAL && !tx.local;
    if (this.#hold > 0) {
      this.#held = true;
      return;
    }
    this.#flush(remote);
    this.#scheduleHeal();
  }

  #flush(remote: boolean): void {
    if (this.#hold > 0 || this.#destroyed) return;
    const result = this.#mat.flush();
    if (result.structureChanged) this.structureVersion++;
    if (this.#held) {
      this.#held = false;
      this.#scheduleHeal();
    }
    if (!result.changed && !result.structureChanged) return;
    this.lastUpdateRemote = remote;
    try {
      for (const listener of [...this.#listeners]) listener();
    } finally {
      this.lastUpdateRemote = false;
    }
  }

  /** Mark nodes added by a remote transaction whose author is online (`remote.addedBy`). */
  #markRemoteAdds(events: Y.YEvent<Y.AbstractType<unknown>>[], tx: Y.Transaction): void {
    const remote = this.#remote;
    if (!remote || tx.local || tx.origin === LOCAL) return;
    const added: string[] = [];
    for (const event of events) {
      if (event.target !== this.#maps.nodes) continue;
      for (const [key, change] of event.changes.keys) if (change.action === 'add') added.push(key);
    }
    if (!added.length || added.length > 10) return;
    const authors: number[] = [];
    tx.afterState.forEach((clock, client) => {
      if (clock > (tx.beforeState.get(client) ?? 0)) authors.push(client);
    });
    if (authors.length !== 1) return;
    remote.update();
    const user = remote.userOf(authors[0]!);
    if (!user) return;
    for (const id of added) {
      remote.markAdded(id, user, (expired) => {
        remote.update();
        this.#mat.markNodeView(expired);
        this.#flush(true);
      });
    }
    remote.update();
    for (const id of added) this.#mat.markNodeView(id);
  }

  // selection and presence ----------------------------------------------------------------------

  #publishSelection(): void {
    this.presence?.setSelection({
      nodes: this.#overlay.selectedNodeIds(),
      edges: this.#overlay.selectedEdgeIds(),
    });
  }

  #restoreSelection(snapshot: { nodes: string[]; edges: string[] }): void {
    const nodes = new Set(snapshot.nodes);
    const edges = new Set(snapshot.edges);
    this.#batch(() => {
      for (const id of this.#overlay.selectedNodeIds()) {
        if (!nodes.has(id)) this.#overlay.patchNode(id, { selected: false });
      }
      for (const id of this.#overlay.selectedEdgeIds()) {
        if (!edges.has(id)) this.#overlay.patchEdge(id, { selected: false });
      }
      for (const id of nodes)
        if (this.#mat.docNodes.has(id)) this.#overlay.patchNode(id, { selected: true });
      for (const id of edges)
        if (this.#mat.docEdges.has(id)) this.#overlay.patchEdge(id, { selected: true });
    });
  }

  /** Connection in progress and viewport from the store to presence. */
  #publishFromStore(store: FlowStore<N, E>): void {
    const presence = this.presence;
    if (!presence) return;
    const { connection, transform } = store.getState();
    let connectionKey = '';
    let next: PresenceState['connection'] | null = null;
    if (connection.inProgress) {
      const [tx, ty, zoom] = transform;
      const to = { x: (connection.to.x - tx) / zoom, y: (connection.to.y - ty) / zoom };
      next = {
        fromNode: connection.fromNode.id,
        fromHandle: connection.fromHandle?.id ?? null,
        fromType: connection.fromHandle?.type ?? 'source',
        to,
      };
      connectionKey = JSON.stringify(next);
    }
    if (connectionKey !== this.#lastPresence.connection) {
      this.#lastPresence.connection = connectionKey;
      presence.setConnection(next);
    }
    const viewportKey = transform.join(',');
    if (viewportKey !== this.#lastPresence.viewport) {
      this.#lastPresence.viewport = viewportKey;
      const viewport: Viewport = { x: transform[0], y: transform[1], zoom: transform[2] };
      presence.setViewport(viewport);
    }
  }

  #detachStore(): void {
    for (const fn of this.#storeCleanup.splice(0)) fn();
    this.#store = null;
  }

  /** Drop moves and resizes of nodes a remote user is dragging or resizing (advisory). */
  #softLock(changes: NodeChange<N>[], meta: ChangeMeta<N, E>): NodeChange<N>[] {
    const remote = this.#remote;
    if (!this.#opts.softLocks || !remote) return changes;
    const out = changes.filter((c) => {
      if (c.type !== 'position' && !(c.type === 'dimensions' && c.setAttributes)) return true;
      const key = `${meta.gestureId ?? ''}:${c.id}`;
      if (meta.gestureId && this.#blocked.has(key)) {
        if (meta.phase === 'end') this.#blocked.delete(key);
        return false;
      }
      if (meta.phase === 'live' || meta.phase === 'end') return true;
      if (!remote.lockedBy(c.id)) return true;
      if (meta.gestureId) this.#blocked.add(key);
      return false;
    });
    return out.length === changes.length ? changes : out;
  }
  readonly #blocked = new Set<string>();

  // healing, migrations -------------------------------------------------------------------------

  #isHealer(): boolean {
    const awareness = this.#awareness;
    if (!awareness) return true;
    let lowest = awareness.clientID;
    for (const id of awareness.getStates().keys()) if (id < lowest) lowest = id;
    return lowest === awareness.clientID;
  }

  #scheduleHeal(): void {
    if (this.#destroyed || !this.#opts.heal || !this.#ready || this.readOnly) return;
    if (this.#mat.issues.length === 0) {
      if (this.#healTimer) clearTimeout(this.#healTimer);
      this.#healTimer = null;
      return;
    }
    if (this.#healTimer) return;
    this.#healTimer = setTimeout(() => this.#heal(), HEAL_DELAY);
  }

  #heal(): void {
    this.#healTimer = null;
    if (this.#destroyed || this.readOnly) return;
    // re-check: the issue may be gone (a late-arriving node, another healer)
    this.#mat.flush();
    const issues = this.#mat.issues;
    if (!issues.length) return;
    if (!this.#isHealer()) {
      this.#healTimer = setTimeout(() => this.#heal(), HEAL_RECHECK);
      return;
    }
    let fixed: { issue: RepairIssue; removed: number }[] = [];
    this.#batch(() => {
      this.doc.transact(() => {
        fixed = applyRepairs(this.#maps, issues);
      }, HEAL);
    });
    for (const { issue, removed } of fixed) {
      if (!removed) continue;
      const message =
        issue.kind === 'dangling-edge'
          ? `Removed edge "${issue.edgeId}": its ${issue.missing} node no longer exists.`
          : issue.kind === 'duplicate-edge'
            ? `Removed duplicate edge${removed > 1 ? 's' : ''} ${(issue as { drop: string[] }).drop.map((d) => `"${d}"`).join(', ')} (kept "${(issue as { keep: string }).keep}").`
            : '';
      if (message) this.#reportSchemaErrorCode('XYL20', message);
    }
  }

  #reportSchemaErrorCode(code: string, message: string): void {
    if (this.#store) this.#store.reportError(code, message);
    else this.#pendingErrors.push({ code, message });
  }

  #runMigrations(migrations: readonly Migration[]): void {
    const result = runMigrations(this.doc, this.#maps, migrations);
    if (result.status === 'too-new') {
      this.#tooNew = true;
      this.#reportSchemaErrorCode(
        'XYL21',
        `The document uses schema ${result.found} but this client understands up to ${SCHEMA_VERSION}; it is read-only.`,
      );
    } else if (result.status === 'no-path') {
      this.#tooNew = true;
      this.#reportSchemaErrorCode(
        'XYL21',
        `No migration from schema ${result.found} to ${SCHEMA_VERSION}; the document is read-only.`,
      );
    }
  }

  /** The user behind an awareness client id, if that client is online. */
  userOf(clientId: number): RemoteUser | undefined {
    return this.#remote?.userOf(clientId);
  }
}
