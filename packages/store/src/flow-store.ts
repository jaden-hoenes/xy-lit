// Ported from xyflow (MIT) packages/react/src/store/index.ts, hooks/useMoveSelectedNodes.ts, components/Nodes/utils.ts@3d35b57
// (selection handlers also follow packages/svelte/src/lib/store/index.ts@3d35b57)
import { DEFAULT_FIT_VIEW_TIMEOUT } from './constants.js';
import { devWarn } from './dev.js';
import { createSelectionChange, getSelectionChanges } from './changes.js';
import { getSelected, sameSelection } from './selection.js';
import {
  adoptUserNodes,
  calculateNodePosition,
  fitViewport,
  getNodeDimensions,
  panBySystem,
  withResolvers,
  errorMessages,
  getHandlePosition,
  handleExpandParent,
  initialConnection,
  Position,
  snapPosition,
  updateAbsolutePositions,
  updateNodeInternalsSystem,
  getInternalNodesBounds,
  getViewportForBounds,
  mergeAriaLabelConfig,
  updateConnectionLookup,
} from './engine.js';
import type {
  ConnectionMode,
  ConnectionState,
  CoordinateExtent,
  EdgeBase,
  EdgeLookupBase,
  InternalNodeUpdate,
  NodeDragItem,
  NodePositionChange,
  ParentExpandChild,
  SetCenterOptions,
  SnapGrid,
  Viewport,
  XYPosition,
  ZIndexMode,
} from './engine.js';
import { createFlowInstance } from './instance.js';
import { getLayoutedEdges, getNodesInViewport } from './visible.js';
import type { CullingViewport, EdgeLayoutResult } from './visible.js';
import { ArraySource } from './sources/array-source.js';
import { createMarkerDefs } from './markers.js';
import { createInitialState } from './state.js';
import { createId } from './utils.js';
import type { FlowState } from './state.js';
import type { ChangeMeta, EdgeChange, NodeChange } from './types/changes.js';
import type { DefaultEdgeOptions, Edge, EdgeLayouted, MarkerDef } from './types/edges.js';
import type { FlowEventMap } from './types/events.js';
import type { FlowInstance } from './types/instance.js';
import type { InternalNode, Node } from './types/nodes.js';
import type { FitViewOptions, FlowOptions, ParallelEdges } from './types/options.js';
import type { FlowDataSource, FlowHistory } from './types/source.js';

/** What a store needs from the element that hosts it. */
export interface FlowHost<N extends Node = Node, E extends Edge = Edge> {
  /** Dispatch a DOM event; returns false when a listener called `preventDefault()`. */
  emit<K extends keyof FlowEventMap<N, E>>(
    type: K,
    detail: FlowEventMap<N, E>[K],
    cancelable?: boolean,
  ): boolean;
}

/** Sees (and may filter or rewrite) every node change batch before it is emitted. */
export type NodeChangeMiddleware<N extends Node = Node, E extends Edge = Edge> = (
  changes: NodeChange<N>[],
  meta: ChangeMeta<N, E>,
) => NodeChange<N>[];

/** Sees (and may filter or rewrite) every edge change batch before it is emitted. */
export type EdgeChangeMiddleware<N extends Node = Node, E extends Edge = Edge> = (
  changes: EdgeChange<E>[],
  meta: ChangeMeta<N, E>,
) => EdgeChange<E>[];

/** Option keys whose `undefined` value is meaningful (clears the option). */
const CLEARABLE_OPTIONS: ReadonlySet<string> = new Set([
  'defaultEdgeOptions',
  'isValidConnection',
  'onBeforeDelete',
  'onBeforeConnect',
  'onBeforeReconnect',
  'fitViewOptions',
]);

/** Option keys `setOptions` handles itself (side effects, or not state fields). */
const SPECIAL_OPTIONS: ReadonlySet<string> = new Set([
  'nodes',
  'edges',
  'fitView',
  'width',
  'height',
  'ariaLabelConfig',
  'snapGrid',
  'snapToGrid',
  'minZoom',
  'maxZoom',
  'translateExtent',
  'nodeExtent',
  'nodeOrigin',
  'elevateNodesOnSelect',
  'zIndexMode',
]);

const sameCulling = (a: CullingViewport | null, b: CullingViewport | null): boolean => {
  if (a === null || b === null) return a === b;
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.transform[0] === b.transform[0] &&
    a.transform[1] === b.transform[1] &&
    a.transform[2] === b.transform[2]
  );
};

const extentEqual = (a: CoordinateExtent, b: CoordinateExtent): boolean =>
  a[0][0] === b[0][0] && a[0][1] === b[0][1] && a[1][0] === b[1][0] && a[1][1] === b[1][1];

/**
 * The state container of one flow: a framework-free port of React Flow's zustand store.
 *
 * State reads are always synchronous (`getState()`); subscribers are notified once per
 * microtask. Everything except `updateNodeInternals`, `screenToFlowPosition` and
 * `flowToScreenPosition` works without a DOM, so the store runs in Node for unit tests.
 */
export class FlowStore<N extends Node = Node, E extends Edge = Edge> {
  private state: FlowState<N, E>;
  private readonly listeners = new Set<() => void>();
  private host: FlowHost<N, E> | null = null;

  private dirty = false;
  private scheduled = false;
  private pendingInitializedEmit = false;

  private sourceRef: FlowDataSource<N, E>;
  private unsubscribeSource: (() => void) | null = null;
  private lastSourceStructureVersion: number | undefined;
  private nodeIds = new Set<string>();
  private edgeIds = new Set<string>();

  private historyRef: FlowHistory | null = null;

  /**
   * Hook set by the flow element (its `MeasureController`): measure the given nodes now.
   * `null` in Node tests, where there is no DOM.
   */
  requestNodeMeasure: ((ids: string[]) => void) | null = null;

  /** The imperative API of this flow; created once, stable identity. */
  readonly instance: FlowInstance<N, E>;

  /**
   * @param options - Initial options (see `FlowOptions`). `nodes` and `edges` seed the default
   * in-memory `ArraySource`.
   */
  constructor(options: Partial<FlowOptions<N, E>> = {}) {
    // 1. state: DEFAULTS merged with the options
    this.state = createInitialState(options);
    // 2. initial fit (React semantics)
    this.state.fitViewQueued = !!options.fitView;
    // 3. default source; subscribe and sync once
    this.sourceRef = new ArraySource<N, E>(options.nodes ?? [], options.edges ?? []);
    this.unsubscribeSource = this.sourceRef.subscribe(this.syncFromSource);
    this.syncFromSource();
    // initial transform when the size is known (no DOM needed), as React's getInitialState
    const { width, height, minZoom, maxZoom, nodeLookup } = this.state;
    if (options.fitView && width && height) {
      const bounds = getInternalNodesBounds(nodeLookup, {
        filter: (node) =>
          !!((node.width || node.initialWidth) && (node.height || node.initialHeight)),
      });
      const { x, y, zoom } = getViewportForBounds(
        bounds,
        width,
        height,
        minZoom,
        maxZoom,
        options.fitViewOptions?.padding ?? 0.1,
      );
      this.state = { ...this.state, transform: [x, y, zoom] };
    }
    // 4. instance
    this.instance = createFlowInstance(this);
    // the initial fit also gets the measurement timeout
    if (this.state.fitViewQueued) {
      this.startFitViewTimer(options.fitViewOptions?.timeout ?? DEFAULT_FIT_VIEW_TIMEOUT);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // state

  /** The current state. Always up to date, also inside actions. */
  getState(): Readonly<FlowState<N, E>> {
    return this.state;
  }

  /**
   * Shallow-merge a patch into the state and schedule one notification.
   *
   * @param patch - Fields to overwrite.
   */
  setState(patch: Partial<FlowState<N, E>>): void {
    this.state = { ...this.state, ...patch };
    this.dirty = true;
    this.schedule();
  }

  /**
   * Be notified after state changed. Notifications are coalesced: at most once per microtask.
   *
   * @returns Unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Run all pending notifications and deferred events now (for tests). */
  flush(): void {
    this.runPending();
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.runPending();
    });
  }

  private runPending(): void {
    if (!this.scheduled) return;
    this.scheduled = false;
    this.runDeferred();
    if (this.dirty) {
      this.dirty = false;
      this.notify();
    }
  }

  /** Deferred work that runs before listeners are notified. Extended by later tasks. */
  private runDeferred(): void {
    if (this.selectionCheckPending) {
      this.selectionCheckPending = false;
      this.checkSelection();
    }
    if (this.pendingInitializedEmit) {
      this.pendingInitializedEmit = false;
      const { nodesInitialized, nodes } = this.state;
      if (nodesInitialized && nodes.length > 0) this.emit('nodes-initialized', { nodes });
    }
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        this.reportListenerError(error);
      }
    }
  }

  private reportListenerError(error: unknown): void {
    try {
      this.reportError('XYL00', `A store listener threw: ${String(error)}`);
    } catch {
      // never let error reporting break the store
    }
  }

  // ---------------------------------------------------------------------------------------------
  // wiring

  /**
   * Attach the element that hosts this store (event dispatch). `null` detaches it.
   *
   * @param host - The host, or null.
   */
  setHost(host: FlowHost<N, E> | null): void {
    this.host = host;
  }

  /**
   * Dispatch a flow event through the host. Without a host nothing listens, so this returns true
   * (not prevented).
   */
  emit = <K extends keyof FlowEventMap<N, E>>(
    type: K,
    detail: FlowEventMap<N, E>[K],
    cancelable = false,
  ): boolean => (this.host ? this.host.emit(type, detail, cancelable) : true);

  /**
   * Report a recoverable error: a cancelable `flow-error` event whose default action is a
   * `console.warn` in development.
   *
   * @param code - Upstream error code (`'008'`) or an `XYL` code.
   * @param message - Human readable message.
   */
  reportError(code: string, message: string): void {
    if (this.emit('flow-error', { code, message }, true)) devWarn(code, message);
  }

  /** Upstream-style error callback for engine functions. */
  readonly onError = (code: string, message: string): void => {
    this.reportError(code, message);
  };

  /** Increment `structureRevision` (nodes/edges added or removed, or a source attached). */
  bumpStructureRevision(): void {
    this.setState({ structureRevision: this.state.structureRevision + 1 });
  }

  // ---------------------------------------------------------------------------------------------
  // sources

  /** The data source currently in use (an `ArraySource` unless one was set). */
  get source(): FlowDataSource<N, E> {
    return this.sourceRef;
  }

  /**
   * Hand state to another source. `null` goes back to a fresh, empty `ArraySource`.
   *
   * @param next - The new source, or null.
   */
  setSource(next: FlowDataSource<N, E> | null): void {
    this.sourceRef.detach?.();
    this.unsubscribeSource?.();
    this.sourceRef = next ?? new ArraySource<N, E>([], []);
    this.lastSourceStructureVersion = this.sourceRef.structureVersion;
    this.sourceRef.attach?.(this);
    this.unsubscribeSource = this.sourceRef.subscribe(this.syncFromSource);
    this.syncFromSource();
    this.bumpStructureRevision();
  }

  /** Pull nodes, edges and the structure version from the source into the state. */
  private readonly syncFromSource = (): void => {
    const source = this.sourceRef;
    if (source.nodes !== this.state.nodes) this.setNodesFromSource(source.nodes);
    if (source.edges !== this.state.edges) this.setEdgesFromSource(source.edges);
    if (
      source.structureVersion !== undefined &&
      source.structureVersion !== this.lastSourceStructureVersion
    ) {
      this.lastSourceStructureVersion = source.structureVersion;
      this.bumpStructureRevision();
    }
  };

  private updateIdSet(ids: Set<string>, items: { id: string }[]): boolean {
    let changed = ids.size !== items.length;
    if (!changed) {
      for (const item of items) {
        if (!ids.has(item.id)) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      ids.clear();
      for (const item of items) ids.add(item.id);
    }
    return changed;
  }

  /**
   * Adopt a new nodes array from the source (React `setNodes`): update the engine lookups,
   * the derived flags and the revisions.
   *
   * @param nodes - The source's nodes.
   */
  setNodesFromSource(nodes: N[]): void {
    const {
      nodeLookup,
      parentLookup,
      nodeOrigin,
      nodeExtent,
      elevateNodesOnSelect,
      fitViewQueued,
      zIndexMode,
      nodesSelectionActive,
      nodesInitialized: wasInitialized,
    } = this.state;

    /*
     * setNodesFromSource() is called exclusively in response to the source changing:
     * the `.nodes` property was assigned, changes were applied, or the instance's setNodes().
     * We take the node objects the user (or source) holds and extend them with the fields
     * relevant for internal operations.
     */
    const { nodesInitialized, hasSelectedNodes } = adoptUserNodes(nodes, nodeLookup, parentLookup, {
      nodeOrigin,
      nodeExtent,
      elevateNodesOnSelect,
      checkEquality: true,
      zIndexMode,
    });

    const idSetChanged = this.updateIdSet(this.nodeIds, nodes);

    this.setState({
      nodes,
      nodesInitialized,
      hasSelectedNodes,
      nodesSelectionActive: nodesSelectionActive && hasSelectedNodes,
      lookupVersion: this.state.lookupVersion + 1,
      structureRevision: this.state.structureRevision + (idSetChanged ? 1 : 0),
    });

    if (!wasInitialized && nodesInitialized && nodes.length > 0) {
      this.pendingInitializedEmit = true;
      this.schedule();
    }

    // an empty flow has nothing to wait for (`nodesInitialized` is false for no nodes)
    if (fitViewQueued && (nodesInitialized || nodes.length === 0)) {
      void this.resolveFitView();
    }

    this.scheduleSelectionCheck();
  }

  /**
   * Adopt a new edges array from the source (React `setEdges`).
   *
   * @param edges - The source's edges.
   */
  setEdgesFromSource(edges: E[]): void {
    const { connectionLookup, edgeLookup } = this.state;

    // XY Lit's Edge is not assignable to upstream's EdgeBase (custom markers), hence the casts
    updateConnectionLookup(
      connectionLookup,
      edgeLookup as unknown as EdgeLookupBase,
      edges as unknown as EdgeBase[],
    );

    const idSetChanged = this.updateIdSet(this.edgeIds, edges);

    this.setState({
      edges,
      structureRevision: this.state.structureRevision + (idSetChanged ? 1 : 0),
    });

    this.scheduleSelectionCheck();
  }

  // ---------------------------------------------------------------------------------------------
  // options

  /**
   * Shallow-merge option fields into the state, with the side effects each option needs
   * (pan/zoom scale extent, re-adopting nodes, ...). Unchanged values are ignored; `undefined`
   * is ignored too, except for options where it clears the value (`defaultEdgeOptions`,
   * `isValidConnection`, `onBefore*`, `fitViewOptions`).
   *
   * @param options - Options to apply.
   */
  setOptions(options: Partial<FlowOptions<N, E>>): void {
    const state = this.state;
    const patch: Partial<FlowState<N, E>> = {};
    const record = state as unknown as Record<string, unknown>;
    const patchRecord = patch as unknown as Record<string, unknown>;

    for (const [key, value] of Object.entries(options)) {
      if (SPECIAL_OPTIONS.has(key)) continue;
      if (value === undefined && !CLEARABLE_OPTIONS.has(key)) continue;
      if (!Object.is(record[key], value)) patchRecord[key] = value;
    }

    // zoom limits
    const minZoom = options.minZoom ?? state.minZoom;
    const maxZoom = options.maxZoom ?? state.maxZoom;
    if (minZoom !== state.minZoom || maxZoom !== state.maxZoom) {
      patch.minZoom = minZoom;
      patch.maxZoom = maxZoom;
      state.panZoom?.setScaleExtent([minZoom, maxZoom]);
    }

    // pan extent
    if (options.translateExtent && !extentEqual(options.translateExtent, state.translateExtent)) {
      patch.translateExtent = options.translateExtent;
      state.panZoom?.setTranslateExtent(options.translateExtent);
    }

    // snapping: a given snapGrid also switches snapping on unless snapToGrid is given
    if (options.snapToGrid !== undefined && options.snapToGrid !== state.snapToGrid) {
      patch.snapToGrid = options.snapToGrid;
    }
    if (options.snapGrid) {
      const same = (a: SnapGrid, b: SnapGrid) => a[0] === b[0] && a[1] === b[1];
      if (!same(options.snapGrid, state.snapGrid)) {
        patch.snapGrid = options.snapGrid;
        if (options.snapToGrid === undefined) patch.snapToGrid = true;
      }
    }

    if (options.ariaLabelConfig) {
      patch.ariaLabelConfig = mergeAriaLabelConfig(options.ariaLabelConfig);
    }

    // options that change how nodes are adopted
    let readopt = false;
    if (options.nodeOrigin && !Object.is(options.nodeOrigin, state.nodeOrigin)) {
      const [ox, oy] = options.nodeOrigin;
      if (ox !== state.nodeOrigin[0] || oy !== state.nodeOrigin[1]) {
        patch.nodeOrigin = options.nodeOrigin;
        readopt = true;
      }
    }
    if (
      options.elevateNodesOnSelect !== undefined &&
      options.elevateNodesOnSelect !== state.elevateNodesOnSelect
    ) {
      patch.elevateNodesOnSelect = options.elevateNodesOnSelect;
      readopt = true;
    }
    if (options.zIndexMode !== undefined && options.zIndexMode !== state.zIndexMode) {
      patch.zIndexMode = options.zIndexMode;
      readopt = true;
    }

    if (Object.keys(patch).length > 0) this.setState(patch);

    if (options.nodeExtent && !extentEqual(options.nodeExtent, state.nodeExtent)) {
      this.setNodeExtent(options.nodeExtent);
    } else if (readopt) {
      this.readoptNodes();
    }

    if (options.nodes !== undefined && options.nodes !== this.state.nodes) {
      this.assignNodes(options.nodes);
    }
    if (options.edges !== undefined && options.edges !== this.state.edges) {
      this.assignEdges(options.edges);
    }
  }

  private assignNodes(nodes: N[]): void {
    if (this.sourceRef instanceof ArraySource) this.sourceRef.replaceNodes(nodes);
    else this.instance.setNodes(nodes);
  }

  private assignEdges(edges: E[]): void {
    if (this.sourceRef instanceof ArraySource) this.sourceRef.replaceEdges(edges);
    else this.instance.setEdges(edges);
  }

  /** Re-run `adoptUserNodes` without equality shortcuts (origin, extent, z-index mode changed). */
  private readoptNodes(): void {
    const {
      nodes,
      nodeLookup,
      parentLookup,
      nodeOrigin,
      nodeExtent,
      elevateNodesOnSelect,
      zIndexMode,
    } = this.state;
    const { nodesInitialized, hasSelectedNodes } = adoptUserNodes(nodes, nodeLookup, parentLookup, {
      nodeOrigin,
      nodeExtent,
      elevateNodesOnSelect,
      checkEquality: false,
      zIndexMode,
    });
    this.setState({
      nodesInitialized,
      hasSelectedNodes,
      nodesSelectionActive: this.state.nodesSelectionActive && hasSelectedNodes,
      lookupVersion: this.state.lookupVersion + 1,
    });
  }

  /**
   * Set the extent nodes can be moved within; existing nodes are clamped again.
   *
   * @param nextNodeExtent - The new extent.
   */
  setNodeExtent(nextNodeExtent: CoordinateExtent): void {
    if (extentEqual(nextNodeExtent, this.state.nodeExtent)) return;
    this.state = { ...this.state, nodeExtent: nextNodeExtent };
    this.readoptNodes();
  }

  // ---------------------------------------------------------------------------------------------
  // change pipeline

  private readonly nodeMiddlewares: { fn: NodeChangeMiddleware<N, E> }[] = [];
  private readonly edgeMiddlewares: { fn: EdgeChangeMiddleware<N, E> }[] = [];

  /**
   * Register a middleware that sees every node change batch before the `nodes-change` event.
   * Middlewares run in registration order; returning an empty array drops the batch.
   *
   * @returns Unregister function.
   */
  addNodeChangeMiddleware(fn: NodeChangeMiddleware<N, E>): () => void {
    const entry = { fn };
    this.nodeMiddlewares.push(entry);
    return () => {
      const index = this.nodeMiddlewares.indexOf(entry);
      if (index !== -1) this.nodeMiddlewares.splice(index, 1);
    };
  }

  /**
   * Register a middleware that sees every edge change batch before the `edges-change` event.
   *
   * @returns Unregister function.
   */
  addEdgeChangeMiddleware(fn: EdgeChangeMiddleware<N, E>): () => void {
    const entry = { fn };
    this.edgeMiddlewares.push(entry);
    return () => {
      const index = this.edgeMiddlewares.indexOf(entry);
      if (index !== -1) this.edgeMiddlewares.splice(index, 1);
    };
  }

  /**
   * Send node changes through the pipeline: middlewares, a cancelable `nodes-change` event, then
   * the data source. When a listener calls `preventDefault()` nothing is applied: the app owns
   * state (controlled mode) and must assign `.nodes`. Nothing is retried.
   *
   * @param changes - The changes. Empty batches are ignored.
   * @param meta - Phase, origin and gesture id of the batch.
   * @param o.apply - Replaces the default `source.applyNodeChanges` call. It receives the
   * changes as left by the middlewares, so it can tell whether they were rewritten.
   */
  triggerNodeChanges(
    changes: NodeChange<N>[],
    meta: ChangeMeta<N, E>,
    o?: { apply?: (changes: NodeChange<N>[], meta: ChangeMeta<N, E>) => void },
  ): void {
    if (!changes.length) return;
    let next = changes;
    let nextMeta = meta;
    for (const { fn } of [...this.nodeMiddlewares]) {
      const result = fn(next, nextMeta);
      // a rewritten batch no longer matches a full-array snapshot
      if (result !== next && nextMeta.snapshotNodes)
        nextMeta = { ...nextMeta, snapshotNodes: undefined };
      next = result;
      if (!next.length) return;
    }
    if (this.state.debug) console.log('XY Lit: node changes', nextMeta, next);
    const proceed = this.emit('nodes-change', { changes: next, meta: nextMeta }, true);
    if (!proceed) return;
    if (o?.apply) o.apply(next, nextMeta);
    else this.sourceRef.applyNodeChanges(next, nextMeta);
  }

  /**
   * Send edge changes through the pipeline (see {@link triggerNodeChanges}), with the
   * `edges-change` event.
   *
   * @param changes - The changes. Empty batches are ignored.
   * @param meta - Phase, origin and gesture id of the batch.
   * @param o.apply - Replaces the default `source.applyEdgeChanges` call.
   */
  triggerEdgeChanges(
    changes: EdgeChange<E>[],
    meta: ChangeMeta<N, E>,
    o?: { apply?: (changes: EdgeChange<E>[], meta: ChangeMeta<N, E>) => void },
  ): void {
    if (!changes.length) return;
    let next = changes;
    let nextMeta = meta;
    for (const { fn } of [...this.edgeMiddlewares]) {
      const result = fn(next, nextMeta);
      if (result !== next && nextMeta.snapshotEdges)
        nextMeta = { ...nextMeta, snapshotEdges: undefined };
      next = result;
      if (!next.length) return;
    }
    if (this.state.debug) console.log('XY Lit: edge changes', nextMeta, next);
    const proceed = this.emit('edges-change', { changes: next, meta: nextMeta }, true);
    if (!proceed) return;
    if (o?.apply) o.apply(next, nextMeta);
    else this.sourceRef.applyEdgeChanges(next, nextMeta);
  }

  /**
   * Work out the `ChangeMeta` of a node position update from the gesture in progress, and
   * advance the gesture: the first `dragging: true` update starts a drag gesture (`start`),
   * further ones are `live`, the final `dragging: false` update is `end`; an update outside a
   * gesture is `discrete`.
   *
   * @param dragging - The `dragging` flag of the update.
   * @param meta - Explicit overrides (a given `phase` wins over the inference).
   */
  private resolvePositionMeta(
    dragging: boolean,
    meta?: Partial<ChangeMeta<N, E>>,
  ): ChangeMeta<N, E> {
    const gesture = this.state.activeGesture;
    let phase: ChangeMeta['phase'];
    if (meta?.phase) phase = meta.phase;
    else if (dragging) phase = gesture?.kind === 'drag' ? 'live' : 'start';
    else phase = gesture?.kind === 'drag' ? 'end' : 'discrete';

    let active = gesture;
    if (phase === 'start') active = { kind: 'drag', id: createId() };
    const fullMeta: ChangeMeta<N, E> = {
      ...meta,
      origin: meta?.origin ?? (phase === 'discrete' ? 'keyboard' : 'drag'),
      gestureId: meta?.gestureId ?? active?.id,
      phase,
    };
    if (phase === 'end') active = null;
    if (active !== gesture) this.setState({ activeGesture: active });
    return fullMeta;
  }

  // ---------------------------------------------------------------------------------------------
  // measuring, moving, connections

  /**
   * Measure nodes (every node is registered at a `ResizeObserver`; whenever one changes its
   * dimensions the measure controller calls this). Updates the engine's internals, absolute
   * positions and handle bounds, resolves a queued `fitView` and sends the resulting
   * `dimensions` / `position` changes through the pipeline (`origin: 'measure'`).
   *
   * @param updates - Node id to measuring info.
   * @param params.triggerFitView - Set to false to not resolve a queued `fitView` now.
   */
  updateNodeInternals(
    updates: Map<string, InternalNodeUpdate>,
    params?: { triggerFitView?: boolean },
  ): void {
    const {
      nodeLookup,
      parentLookup,
      domNode,
      nodeOrigin,
      nodeExtent,
      debug,
      fitViewQueued,
      zIndexMode,
    } = this.state;

    const { changes, updatedInternals } = updateNodeInternalsSystem(
      updates,
      nodeLookup,
      parentLookup,
      domNode,
      nodeOrigin,
      nodeExtent,
      zIndexMode,
    );

    if (!updatedInternals) {
      return;
    }

    updateAbsolutePositions(nodeLookup, parentLookup, { nodeOrigin, nodeExtent, zIndexMode });

    // we always want to trigger subscribers whenever updateNodeInternals changed something
    this.setState({ lookupVersion: this.state.lookupVersion + 1 });

    if (fitViewQueued && params?.triggerFitView !== false) {
      void this.resolveFitView();
    }

    if (changes.length > 0) {
      if (debug) console.log('XY Lit: trigger node changes', changes);
      this.triggerNodeChanges(changes, { phase: 'discrete', origin: 'measure' });
    }
  }

  /**
   * Send position changes for dragged (or keyboard-moved) nodes. Does not mutate the internal
   * nodes: new positions reach `nodeLookup` only through the source round trip (change, source,
   * `setNodesFromSource`), as in React. The phase (`start` / `live` / `end` / `discrete`) is
   * inferred from the gesture in progress unless `meta.phase` is given.
   *
   * @param nodeDragItems - Node id to drag item (or internal node).
   * @param dragging - Whether the drag is still in progress.
   * @param meta - Overrides for the change meta.
   */
  updateNodePositions(
    nodeDragItems: Map<string, NodeDragItem | InternalNode<N>>,
    dragging = false,
    meta?: Partial<ChangeMeta<N, E>>,
  ): void {
    const parentExpandChildren: ParentExpandChild[] = [];
    const changes: NodeChange<N>[] = [];
    const { nodeLookup, connection } = this.state;

    for (const [id, dragItem] of nodeDragItems) {
      // we are using the nodelookup to be sure to use the current expandParent and parentId value
      const node = nodeLookup.get(id);
      const expandParent = !!(node?.expandParent && node.parentId && dragItem.position);

      const change: NodePositionChange = {
        id,
        type: 'position',
        position: expandParent
          ? {
              x: Math.max(0, dragItem.position.x),
              y: Math.max(0, dragItem.position.y),
            }
          : dragItem.position,
        dragging,
      };

      if (node && connection.inProgress && connection.fromNode.id === node.id) {
        const updatedFrom = getHandlePosition(node, connection.fromHandle, Position.Left, true);
        this.updateConnection({ ...connection, from: updatedFrom });
      }

      if (expandParent && node.parentId) {
        parentExpandChildren.push({
          id,
          parentId: node.parentId,
          rect: {
            ...dragItem.internals.positionAbsolute,
            width: dragItem.measured.width ?? 0,
            height: dragItem.measured.height ?? 0,
          },
        });
      }

      changes.push(change);
    }

    if (parentExpandChildren.length > 0) {
      const { parentLookup, nodeOrigin } = this.state;
      const parentExpandChanges = handleExpandParent(
        parentExpandChildren,
        nodeLookup,
        parentLookup,
        nodeOrigin,
      );
      changes.push(...(parentExpandChanges as NodeChange<N>[]));
    }

    this.triggerNodeChanges(changes, this.resolvePositionMeta(dragging, meta));
  }

  /**
   * Move the selected, draggable nodes with the arrow keys (React `useMoveSelectedNodes`):
   * 5 px per step, or the snap grid when `snapToGrid`; `factor` is 4 with Shift. Unlike
   * `updateNodePositions` this does mutate the internal nodes, as the React hook does.
   *
   * @param direction - Unit direction, e.g. `{ x: 1, y: 0 }`.
   * @param factor - Step multiplier.
   */
  moveSelectedNodes(direction: XYPosition, factor: number): void {
    const { nodeExtent, snapToGrid, snapGrid, nodesDraggable, nodeLookup, nodeOrigin } = this.state;
    const nodeUpdates = new Map<string, InternalNode<N>>();

    /*
     * by default a node moves 5px on each key press
     * if snap grid is enabled, we use that for the velocity
     */
    const xVelo = snapToGrid ? snapGrid[0] : 5;
    const yVelo = snapToGrid ? snapGrid[1] : 5;

    const xDiff = direction.x * xVelo * factor;
    const yDiff = direction.y * yVelo * factor;

    for (const [, node] of nodeLookup) {
      const selectedAndDraggable =
        node.selected &&
        (node.draggable || (nodesDraggable && typeof node.draggable === 'undefined'));
      if (!selectedAndDraggable) {
        continue;
      }

      let nextPosition = {
        x: node.internals.positionAbsolute.x + xDiff,
        y: node.internals.positionAbsolute.y + yDiff,
      };

      if (snapToGrid) {
        nextPosition = snapPosition(nextPosition, snapGrid);
      }

      const { position, positionAbsolute } = calculateNodePosition({
        nodeId: node.id,
        nextPosition,
        nodeLookup,
        nodeExtent,
        nodeOrigin,
        onError: this.onError,
      });

      node.position = position;
      node.internals.positionAbsolute = positionAbsolute;

      nodeUpdates.set(node.id, node);
    }

    this.updateNodePositions(nodeUpdates, false, { phase: 'discrete', origin: 'keyboard' });
  }

  /**
   * Set the connection in progress (called by XYHandle).
   *
   * @param connection - The new connection state.
   */
  updateConnection(connection: ConnectionState<InternalNode<N>>): void {
    this.setState({ connection });
  }

  /** Reset the connection state to "no connection". */
  cancelConnection(): void {
    this.setState({ connection: { ...initialConnection } });
  }

  // ---------------------------------------------------------------------------------------------
  // selection

  /** Handlers notified together with the `selection-change` event (used by selection controllers). */
  readonly selectionChangeHandlers = new Map<symbol, (p: { nodes: N[]; edges: E[] }) => void>();

  private selectionCheckPending = false;
  private selectedNodeIds = new Set<string>();
  private selectedEdgeIds = new Set<string>();

  /**
   * Check, once per microtask, whether the set of selected nodes or edges changed and if so emit
   * `selection-change` and notify `selectionChangeHandlers`.
   */
  protected scheduleSelectionCheck(): void {
    this.selectionCheckPending = true;
    this.schedule();
  }

  private checkSelection(): void {
    const nodes = getSelected(this.state.nodes);
    const edges = getSelected(this.state.edges);
    if (sameSelection(this.selectedNodeIds, nodes) && sameSelection(this.selectedEdgeIds, edges))
      return;
    this.selectedNodeIds = new Set(nodes.map((n) => n.id));
    this.selectedEdgeIds = new Set(edges.map((e) => e.id));
    this.emit('selection-change', { nodes, edges });
    for (const handler of [...this.selectionChangeHandlers.values()]) {
      try {
        handler({ nodes, edges });
      } catch (error) {
        this.reportListenerError(error);
      }
    }
  }

  private selectionMeta(gestureId = createId()): ChangeMeta<N, E> {
    return { phase: 'discrete', origin: 'select', gestureId };
  }

  /**
   * Select nodes. Unless multi-selection is active, everything else is unselected. Internal
   * nodes are mutated too, so a drag that starts on an unselected node does not also drag the
   * previously selected one (upstream hack, `getSelectionChanges(..., mutateItem = true)`).
   *
   * @param selectedNodeIds - Ids of the nodes to select.
   */
  addSelectedNodes(selectedNodeIds: string[]): void {
    const { multiSelectionActive, edgeLookup, nodeLookup } = this.state;
    const meta = this.selectionMeta();

    if (multiSelectionActive) {
      this.triggerNodeChanges(
        selectedNodeIds.map((nodeId) => createSelectionChange(nodeId, true)),
        meta,
      );
      return;
    }

    this.triggerNodeChanges(getSelectionChanges(nodeLookup, new Set(selectedNodeIds), true), meta);
    this.triggerEdgeChanges(getSelectionChanges(edgeLookup), meta);
  }

  /**
   * Select edges. Unless multi-selection is active, everything else is unselected.
   *
   * @param selectedEdgeIds - Ids of the edges to select.
   */
  addSelectedEdges(selectedEdgeIds: string[]): void {
    const { multiSelectionActive, edgeLookup, nodeLookup } = this.state;
    const meta = this.selectionMeta();

    if (multiSelectionActive) {
      this.triggerEdgeChanges(
        selectedEdgeIds.map((edgeId) => createSelectionChange(edgeId, true)),
        meta,
      );
      return;
    }

    this.triggerEdgeChanges(getSelectionChanges(edgeLookup, new Set(selectedEdgeIds)), meta);
    this.triggerNodeChanges(getSelectionChanges(nodeLookup, new Set(), true), meta);
  }

  /**
   * Unselect nodes and edges.
   *
   * @param params.nodes - Nodes to unselect (default: all).
   * @param params.edges - Edges to unselect (default: all).
   */
  unselectNodesAndEdges(params: { nodes?: N[]; edges?: E[] } = {}): void {
    const { nodeLookup } = this.state;
    const nodesToUnselect = params.nodes ?? this.state.nodes;
    const edgesToUnselect = params.edges ?? this.state.edges;
    const meta = this.selectionMeta();

    const nodeChanges: NodeChange<N>[] = [];
    for (const node of nodesToUnselect) {
      if (!node.selected) {
        continue; // skip changing nodes that are not selected
      }

      const internalNode = nodeLookup.get(node.id);

      if (internalNode) {
        /*
         * we need to unselect the internal node that was selected previously before we
         * send the change to the user to prevent it to be selected while dragging the new node
         */
        internalNode.selected = false;
      }

      nodeChanges.push(createSelectionChange(node.id, false));
    }

    const edgeChanges: EdgeChange<E>[] = [];
    for (const edge of edgesToUnselect) {
      if (!edge.selected) {
        continue; // skip changing edges that are not selected
      }

      edgeChanges.push(createSelectionChange(edge.id, false));
    }

    this.triggerNodeChanges(nodeChanges, meta);
    this.triggerEdgeChanges(edgeChanges, meta);
  }

  /** Unselect everything (no-op when `elementsSelectable` is off). */
  resetSelectedElements(): void {
    const { edges, nodes, elementsSelectable } = this.state;

    if (!elementsSelectable) {
      return;
    }

    const meta = this.selectionMeta();
    const nodeChanges = nodes.flatMap((node) =>
      node.selected ? [createSelectionChange(node.id, false)] : [],
    );
    const edgeChanges = edges.flatMap((edge) =>
      edge.selected ? [createSelectionChange(edge.id, false)] : [],
    );

    this.triggerNodeChanges(nodeChanges, meta);
    this.triggerEdgeChanges(edgeChanges, meta);
  }

  /**
   * Select a node because it was clicked or its drag started (React `handleNodeClick`).
   * Selects an unselected node; unselects a selected node when `unselect` is true or
   * multi-selection is active (and blurs `nodeEl` on the next frame).
   *
   * @param id - Node id.
   * @param unselect - Unselect instead of select when the node is already selected.
   * @param nodeEl - The node element, blurred after unselecting.
   */
  handleNodeSelection(id: string, unselect = false, nodeEl?: HTMLElement | null): void {
    const { nodeLookup, multiSelectionActive } = this.state;
    const node = nodeLookup.get(id);

    if (!node) {
      this.reportError('012', errorMessages.error012(id));
      return;
    }

    this.setState({ nodesSelectionActive: false });

    if (!node.selected) {
      this.addSelectedNodes([id]);
    } else if (unselect || (node.selected && multiSelectionActive)) {
      this.unselectNodesAndEdges({ nodes: [node.internals.userNode], edges: [] });

      if (nodeEl && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => nodeEl.blur());
      }
    }
  }

  /**
   * Select an edge because it was clicked (React `onEdgeClick`, Svelte `handleEdgeSelection`).
   * Does nothing when the edge is not selectable.
   *
   * @param id - Edge id.
   */
  handleEdgeSelection(id: string): void {
    const { edgeLookup, elementsSelectable, multiSelectionActive } = this.state;
    const edge = edgeLookup.get(id);

    if (!edge) {
      this.reportError('016', errorMessages.error016(id));
      return;
    }

    const selectable = edge.selectable ?? elementsSelectable;
    if (!selectable) return;

    this.setState({ nodesSelectionActive: false });

    if (edge.selected && multiSelectionActive) {
      this.unselectNodesAndEdges({ nodes: [], edges: [edge] });
    } else {
      this.addSelectedEdges([id]);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // visible elements

  private layoutMemo: {
    edges: E[];
    lookupVersion: number;
    defaultEdgeOptions: DefaultEdgeOptions | undefined;
    connectionMode: ConnectionMode;
    elevateEdgesOnSelect: boolean;
    zIndexMode: ZIndexMode;
    parallelEdges: ParallelEdges;
    parallelEdgeGap: number;
    culling: CullingViewport | null;
    result: EdgeLayoutResult<E>;
  } | null = null;
  private visibleNodesMemo: {
    lookupVersion: number;
    culling: CullingViewport | null;
    layout: EdgeLayoutResult<E> | null;
    result: InternalNode<N>[];
  } | null = null;
  private reportedLayoutErrors = new Set<string>();
  private reportedLayoutErrorsFor: E[] | null = null;

  private cullingViewport(): CullingViewport | null {
    const { onlyRenderVisibleElements, transform, width, height } = this.state;
    return onlyRenderVisibleElements ? { transform, width, height } : null;
  }

  private layout(): EdgeLayoutResult<E> {
    const s = this.state;
    const culling = this.cullingViewport();
    const memo = this.layoutMemo;
    if (
      memo &&
      memo.edges === s.edges &&
      memo.lookupVersion === s.lookupVersion &&
      memo.defaultEdgeOptions === s.defaultEdgeOptions &&
      memo.connectionMode === s.connectionMode &&
      memo.elevateEdgesOnSelect === s.elevateEdgesOnSelect &&
      memo.zIndexMode === s.zIndexMode &&
      memo.parallelEdges === s.parallelEdges &&
      memo.parallelEdgeGap === s.parallelEdgeGap &&
      sameCulling(memo.culling, culling)
    ) {
      return memo.result;
    }

    // report each layout error once per edges array, not on every pass
    if (this.reportedLayoutErrorsFor !== s.edges) {
      this.reportedLayoutErrorsFor = s.edges;
      this.reportedLayoutErrors.clear();
    }
    const onError = (code: string, message: string): void => {
      const key = `${code}:${message}`;
      if (this.reportedLayoutErrors.has(key)) return;
      this.reportedLayoutErrors.add(key);
      this.reportError(code, message);
    };

    // reuse is only valid when everything but the edges/nodes themselves is unchanged
    const previous =
      memo &&
      memo.defaultEdgeOptions === s.defaultEdgeOptions &&
      memo.elevateEdgesOnSelect === s.elevateEdgesOnSelect &&
      memo.zIndexMode === s.zIndexMode &&
      memo.connectionMode === s.connectionMode
        ? memo.result.edges
        : new Map<string, EdgeLayouted<E>>();

    const result = getLayoutedEdges<N, E>({
      edges: s.edges,
      nodeLookup: s.nodeLookup,
      defaultEdgeOptions: s.defaultEdgeOptions,
      connectionMode: s.connectionMode,
      elevateEdgesOnSelect: s.elevateEdgesOnSelect,
      zIndexMode: s.zIndexMode,
      parallelEdges: s.parallelEdges,
      parallelEdgeGap: s.parallelEdgeGap,
      previous,
      culling,
      onError,
    });
    this.layoutMemo = {
      edges: s.edges,
      lookupVersion: s.lookupVersion,
      defaultEdgeOptions: s.defaultEdgeOptions,
      connectionMode: s.connectionMode,
      elevateEdgesOnSelect: s.elevateEdgesOnSelect,
      zIndexMode: s.zIndexMode,
      parallelEdges: s.parallelEdges,
      parallelEdgeGap: s.parallelEdgeGap,
      culling,
      result,
    };
    return result;
  }

  /**
   * The nodes to render, in lookup order, memoised: the same array is returned until the lookup
   * (or, with `onlyRenderVisibleElements`, the viewport) changes. Hidden nodes are excluded. With
   * culling only nodes inside the viewport plus the endpoints of visible edges are returned.
   */
  getVisibleNodes(): InternalNode<N>[] {
    const s = this.state;
    const culling = this.cullingViewport();
    const layout = culling ? this.layout() : null;
    const memo = this.visibleNodesMemo;
    if (
      memo &&
      memo.lookupVersion === s.lookupVersion &&
      memo.layout === layout &&
      sameCulling(memo.culling, culling)
    ) {
      return memo.result;
    }

    let result: InternalNode<N>[];
    if (culling && layout) {
      const ids = new Set(
        getNodesInViewport(s.nodeLookup, culling.transform, culling.width, culling.height).map(
          (node) => node.id,
        ),
      );
      for (const id of layout.endpointIds) ids.add(id);
      result = [];
      for (const node of s.nodeLookup.values()) if (ids.has(node.id)) result.push(node);
    } else {
      result = [];
      for (const node of s.nodeLookup.values()) if (!node.hidden) result.push(node);
    }
    this.visibleNodesMemo = { lookupVersion: s.lookupVersion, culling, layout, result };
    return result;
  }

  /**
   * The laid-out edges to render (endpoints resolved, handle positions computed), by edge id,
   * memoised. A laid-out edge keeps its object identity as long as nothing it depends on
   * changed, so `<xy-edge>` re-renders only for edges that really changed.
   */
  getLayoutedEdges(): Map<string, EdgeLayouted<E>> {
    return this.layout().edges;
  }

  private markerMemo: {
    edges: E[];
    defaultEdgeOptions: DefaultEdgeOptions | undefined;
    defaultMarkerColor: string | null;
    flowId: string;
    result: MarkerDef[];
  } | null = null;

  /**
   * The `<marker>` definitions the edges need, memoised on the edges, the default edge options,
   * the default marker colour and the flow id.
   */
  getMarkerDefs(): MarkerDef[] {
    const { edges, defaultEdgeOptions, defaultMarkerColor, flowId } = this.state;
    const memo = this.markerMemo;
    if (
      memo &&
      memo.edges === edges &&
      memo.defaultEdgeOptions === defaultEdgeOptions &&
      memo.defaultMarkerColor === defaultMarkerColor &&
      memo.flowId === flowId
    ) {
      return memo.result;
    }
    const result = createMarkerDefs(edges, {
      flowId,
      defaultColor: defaultMarkerColor,
      defaultEdgeOptions,
    });
    this.markerMemo = { edges, defaultEdgeOptions, defaultMarkerColor, flowId, result };
    return result;
  }

  // ---------------------------------------------------------------------------------------------
  // viewport

  private fitViewTimer: ReturnType<typeof setTimeout> | null = null;
  private fitViewTimedOut = false;

  /**
   * Set the minimum zoom (and tell the pan/zoom engine).
   *
   * @param minZoom - New minimum.
   */
  setMinZoom(minZoom: number): void {
    const { panZoom, maxZoom } = this.state;
    panZoom?.setScaleExtent([minZoom, maxZoom]);
    this.setState({ minZoom });
  }

  /**
   * Set the maximum zoom (and tell the pan/zoom engine).
   *
   * @param maxZoom - New maximum.
   */
  setMaxZoom(maxZoom: number): void {
    const { panZoom, minZoom } = this.state;
    panZoom?.setScaleExtent([minZoom, maxZoom]);
    this.setState({ maxZoom });
  }

  /**
   * Set the pannable area (and tell the pan/zoom engine).
   *
   * @param translateExtent - New extent.
   */
  setTranslateExtent(translateExtent: CoordinateExtent): void {
    this.state.panZoom?.setTranslateExtent(translateExtent);
    this.setState({ translateExtent });
  }

  /**
   * Pan the viewport by a delta in screen pixels, respecting the translate extent.
   *
   * @param delta - Pixels to move the viewport.
   * @returns Whether the viewport moved.
   */
  panBy(delta: XYPosition): Promise<boolean> {
    const { transform, width, height, panZoom, translateExtent } = this.state;
    return panBySystem({ delta, panZoom, transform, translateExtent, width, height });
  }

  /**
   * Centre the viewport on a flow position.
   *
   * @param x - Flow x.
   * @param y - Flow y.
   * @param options - Zoom (default: `maxZoom`) and animation options.
   * @returns False when the pan/zoom engine is not attached yet.
   */
  async setCenter(x: number, y: number, options?: SetCenterOptions): Promise<boolean> {
    const { width, height, maxZoom, panZoom } = this.state;

    if (!panZoom) {
      return false;
    }

    const nextZoom = typeof options?.zoom !== 'undefined' ? options.zoom : maxZoom;

    await panZoom.setViewport(
      {
        x: width / 2 - x * nextZoom,
        y: height / 2 - y * nextZoom,
        zoom: nextZoom,
      },
      { duration: options?.duration, ease: options?.ease, interpolate: options?.interpolate },
    );

    return true;
  }

  /**
   * Mirror the pan/zoom engine's transform into the state (called on every XYPanZoom frame).
   *
   * @param viewport - The engine's viewport.
   */
  setViewportFromPanZoom(viewport: Viewport): void {
    this.setState({ transform: [viewport.x, viewport.y, viewport.zoom] });
  }

  /**
   * Fit the viewport to the nodes. The request is queued until the nodes are measured and the
   * pan/zoom engine and container size are known; if measurement takes longer than
   * `options.timeout` (default 400 ms) the measured nodes are fitted anyway. Calling it again
   * while a fit is pending shares one promise.
   *
   * @param options - Padding, zoom limits, animation, node filter, timeout.
   * @returns Resolves true when fitted, false when there was nothing to fit.
   */
  fitView(options?: FitViewOptions<N>): Promise<boolean> {
    // We either create a new Promise or reuse the existing one
    // Even if fitView is called multiple times in a row, we only end up with a single Promise
    const resolver = this.state.fitViewResolver ?? withResolvers<boolean>();

    this.fitViewTimedOut = false;
    this.setState({ fitViewQueued: true, fitViewOptions: options, fitViewResolver: resolver });
    this.startFitViewTimer(options?.timeout ?? DEFAULT_FIT_VIEW_TIMEOUT);

    // already initialised (or nothing to measure): resolve now
    const { nodesInitialized, nodeLookup, panZoom } = this.state;
    if ((nodesInitialized || nodeLookup.size === 0) && panZoom) void this.resolveFitView();

    return resolver.promise;
  }

  /**
   * Run a queued `fitView` if everything it needs is available: the pan/zoom engine, a non-zero
   * container size and at least one measured node. Otherwise the request stays queued.
   *
   * Called by the node measuring code (when nodes were measured), by `PanZoomController` right
   * after it attached the engine, by the container size observer once the size is known, and by
   * the timeout fallback (`force`), which also fits when only some nodes are measured.
   *
   * @param o.force - Give up waiting for measurement: fit what is measured, or resolve false
   * when nothing is.
   */
  async resolveFitView(o: { force?: boolean } = {}): Promise<void> {
    const {
      panZoom,
      nodeLookup,
      width,
      height,
      minZoom,
      maxZoom,
      fitViewOptions,
      fitViewResolver,
    } = this.state;
    if (!this.state.fitViewQueued) return;
    // stays queued; the pan/zoom and size controllers call this again when ready
    if (!panZoom || !width || !height) return;

    const force = o.force === true || this.fitViewTimedOut;
    if (nodeLookup.size > 0 && !this.hasFittableNodes(fitViewOptions)) {
      if (!force) return;
      // nothing has dimensions, even after the timeout: nothing to fit
      this.finishFitView(false);
      return;
    }

    this.clearFitViewTimer();
    this.fitViewTimedOut = false;
    // detach the request: a fitView() call while the viewport animates queues a new one
    this.setState({ fitViewQueued: false, fitViewOptions: undefined, fitViewResolver: null });

    try {
      const fitted = await fitViewport(
        { nodes: nodeLookup, width, height, panZoom, minZoom, maxZoom },
        fitViewOptions,
      );
      fitViewResolver?.resolve(fitted);
    } catch (error) {
      fitViewResolver?.resolve(false);
      this.reportError('XYL02', `fitView failed: ${String(error)}`);
    }
  }

  private finishFitView(result: boolean): void {
    const resolver = this.state.fitViewResolver;
    this.clearFitViewTimer();
    this.fitViewTimedOut = false;
    this.setState({ fitViewQueued: false, fitViewOptions: undefined, fitViewResolver: null });
    resolver?.resolve(result);
  }

  /** Mirrors the engine's `getFitViewNodes`: is there anything `fitViewport` would fit? */
  private hasFittableNodes(options: FitViewOptions<N> | undefined): boolean {
    const ids = options?.nodes ? new Set(options.nodes.map((node) => node.id)) : null;
    for (const node of this.state.nodeLookup.values()) {
      let fittable: boolean;
      if (options?.includeHiddenNodes) {
        const { width, height } = getNodeDimensions(node);
        fittable = width > 0 && height > 0;
      } else {
        fittable = Boolean(node.measured.width && node.measured.height && !node.hidden);
      }
      if (fittable && (!ids || ids.has(node.id))) return true;
    }
    return false;
  }

  private startFitViewTimer(timeout: number): void {
    this.clearFitViewTimer();
    const timer = setTimeout(() => {
      this.fitViewTimer = null;
      if (!this.state.fitViewQueued) return;
      this.fitViewTimedOut = true;
      void this.resolveFitView({ force: true });
    }, timeout);
    // never keep a Node process alive for a fit that nobody waits for
    (timer as { unref?: () => void }).unref?.();
    this.fitViewTimer = timer;
  }

  private clearFitViewTimer(): void {
    if (this.fitViewTimer !== null) {
      clearTimeout(this.fitViewTimer);
      this.fitViewTimer = null;
    }
  }

  /**
   * Restore the runtime state (DOM node, pan/zoom, size, transform, selection boxes, key flags,
   * connection, pending fitView, gesture) to its initial values. Options and elements are kept.
   * Used when the host element goes away.
   */
  reset(): void {
    const initial = createInitialState<N, E>();
    this.finishFitView(false);
    this.setState({
      domNode: initial.domNode,
      panZoom: initial.panZoom,
      width: initial.width,
      height: initial.height,
      transform: initial.transform,
      paneDragging: initial.paneDragging,
      nodesSelectionActive: initial.nodesSelectionActive,
      userSelectionActive: initial.userSelectionActive,
      userSelectionRect: initial.userSelectionRect,
      multiSelectionActive: initial.multiSelectionActive,
      selectionKeyPressed: initial.selectionKeyPressed,
      panActivationKeyPressed: initial.panActivationKeyPressed,
      zoomActivationKeyPressed: initial.zoomActivationKeyPressed,
      connection: initial.connection,
      connectionClickStartHandle: initial.connectionClickStartHandle,
      ariaLiveMessage: initial.ariaLiveMessage,
      activeGesture: initial.activeGesture,
      lastPointerFlowPosition: initial.lastPointerFlowPosition,
    });
  }

  /** The active history: the source's, else the registered one, else null. */
  get history(): FlowHistory | null {
    return this.sourceRef.history ?? this.historyRef;
  }

  /**
   * Register a local undo/redo history (a source's own history wins over it).
   *
   * @param h - The history, or null to unregister.
   */
  setHistory(h: FlowHistory | null): void {
    this.historyRef = h;
  }
}
