# 03 · `@xy-lit/store`

A framework-free port of `.vendor/xyflow/packages/react/src/store/` (state + actions) and
`.vendor/xyflow/packages/react/src/hooks/useReactFlow.ts` + `useViewportHelper.ts` (instance),
with the change pipeline extended by `ChangeMeta`, cancelable events and data sources.

The store never touches Lit. It touches the DOM only through `domNode` (passed in by the
element) inside `updateNodeInternals`, `screenToFlowPosition` and `flowToScreenPosition`, so
all other actions run in Node for unit tests.

## `engine.ts`

```ts
// The only module that imports @xyflow/system. Named re-exports only (no `export *`),
// so every engine symbol XY Lit depends on is listed here and reviewed on upgrade.
export {
  // drag / pan-zoom / connect / resize / minimap
  XYDrag, XYPanZoom, XYHandle, XYResizer, XYMinimap,
  XY_RESIZER_HANDLE_POSITIONS, XY_RESIZER_LINE_POSITIONS, ResizeControlVariant,
  // store utils
  adoptUserNodes, updateAbsolutePositions, updateNodeInternals as updateNodeInternalsSystem,
  updateConnectionLookup, handleExpandParent, panBy as panBySystem, fitViewport,
  getElementsToRemove, calculateNodePosition, snapPosition, getHandlePosition,
  // geometry / graph
  getBezierPath, getSmoothStepPath, getStraightPath, getBezierEdgeCenter, getEdgeCenter,
  getEdgePosition, getElevatedEdgeZIndex, isEdgeVisible, getNodesInside, getNodesBounds,
  getInternalNodesBounds, getViewportForBounds, getBoundsOfRects, getOverlappingArea,
  nodeToRect, isRectObject, rectToBox, boxToRect, pointToRendererPoint, rendererPointToPoint,
  evaluateAbsolutePosition, getNodeDimensions, nodeHasDimensions, clamp, isNumeric,
  getIncomers, getOutgoers, getConnectedEdges, addEdge as addEdgeBase, reconnectEdge as reconnectEdgeBase,
  getEdgeId, getMarkerId, createMarkerIds, getNodeToolbarTransform, getEdgeToolbarTransform,
  getConnectionStatus, areConnectionMapsEqual, handleConnectionChange, shallowNodeData,
  // dom
  getHostForElement, isInputDOMNode, isMouseEvent, getEventPosition, calcAutoPan,
  // misc
  infiniteExtent, initialConnection, errorMessages, createDevWarn, mergeAriaLabelConfig,
  elementSelectionKeys, isMacOs, withResolvers, isNodeBase, isEdgeBase,
  ConnectionMode, ConnectionLineType, MarkerType, PanOnScrollMode, Position, SelectionMode,
} from '@xyflow/system';
export type { /* every type used elsewhere: NodeBase, InternalNodeBase, NodeProps, EdgeBase,
  EdgePosition, NodeChange, EdgeChange, NodeDimensionChange, NodePositionChange, NodeSelectionChange,
  NodeRemoveChange, NodeAddChange, NodeReplaceChange, EdgeSelectionChange, EdgeRemoveChange,
  EdgeAddChange, EdgeReplaceChange, Connection, ConnectionState, FinalConnectionState, Handle,
  HandleType, HandleConnection, NodeConnection, NodeHandle, NodeLookup, ParentLookup, EdgeLookup,
  ConnectionLookup, InternalNodeUpdate, NodeDragItem, Transform, Viewport, XYPosition, Rect,
  Dimensions, CoordinateExtent, NodeOrigin, SnapGrid, PanZoomInstance, XYResizerInstance,
  XYResizerChange, XYResizerChildChange, ControlPosition, ShouldResize, OnResizeStart, OnResize,
  OnResizeEnd, AriaLabelConfig, ZIndexMode, SelectionRect, ViewportHelperFunctionOptions,
  SetCenterOptions, FitBoundsOptions, FitViewOptionsBase, MarkerProps, EdgeMarker,
  DefaultEdgeOptionsBase, OnError, PanBy, UpdateConnection, … */ } from '@xyflow/system';
```

If a later task needs another engine symbol, add it here; never import the system package
elsewhere.

## `constants.ts`

```ts
export const LIB = 'lit';
export const LIB_NAME = 'XY Lit';
export const DOCS_URL = 'https://jaden-hoenes.github.io/xy-lit';
export const ARIA_NODE_DESC_KEY = 'lit-flow__node-desc';
export const ARIA_EDGE_DESC_KEY = 'lit-flow__edge-desc';
export const ARIA_LIVE_MESSAGE = 'lit-flow__aria-live';
export const DEFAULT_NODE_SIZE = { width: 150, height: 40 };   // placement fallback only
```

`DEFAULTS` holds every option default from the table in §State.

## State — `state.ts`

`FlowState<N, E>` fields, defaults and the React field they port from. Every option field
is settable through `store.setOptions(partial)`.

| Field | Type | Default | Notes |
|---|---|---|---|
| `flowId` | string | `'1'` | `id` attribute of `<xy-flow>`; React `rfId` |
| `nodes` / `edges` | `N[]` / `E[]` | `[]` | mirrors of the source arrays |
| `nodeLookup`, `parentLookup`, `edgeLookup`, `connectionLookup` | Maps | empty | engine-owned, mutated in place |
| `nodesInitialized` | boolean | false | from `adoptUserNodes` |
| `hasSelectedNodes` | boolean | false | from `adoptUserNodes` |
| `lookupVersion` | number | 0 | +1 whenever nodeLookup content changes (memo key) |
| `structureRevision` | number | 0 | +1 when node or edge id sets change, or a source is attached |
| `domNode` | `HTMLDivElement \| null` | null | the `.lit-flow` wrapper inside the render root |
| `width`, `height` | number | 0 | wrapper client size |
| `transform` | Transform | `[0,0,1]` | |
| `panZoom` | PanZoomInstance \| null | null | |
| `minZoom` / `maxZoom` | number | 0.5 / 2 | |
| `translateExtent` / `nodeExtent` | CoordinateExtent | `infiniteExtent` | |
| `nodeOrigin` | NodeOrigin | `[0,0]` | |
| `nodeDragThreshold` | number | 1 | |
| `connectionDragThreshold` | number | 1 | |
| `paneDragging` | boolean | false | XYPanZoom `onDraggingChange` |
| `nodesDraggable`, `nodesConnectable`, `nodesFocusable`, `edgesFocusable`, `elementsSelectable` | boolean | true | |
| `edgesReconnectable` | boolean | **false** | ⚑ see 00-decisions |
| `reconnectRadius` | number | 10 | |
| `elevateNodesOnSelect` / `elevateEdgesOnSelect` | boolean | true / false | React defaults |
| `selectNodesOnDrag` | boolean | true | |
| `autoPanOnNodeFocus`, `autoPanOnNodeDrag`, `autoPanOnConnect`, `autoPanOnSelection` | boolean | true | |
| `autoPanSpeed` | number | 15 | |
| `snapToGrid` / `snapGrid` | boolean / SnapGrid | false / `[15,15]` | |
| `nodesSelectionActive` | boolean | false | selected-nodes box visible |
| `userSelectionActive` / `userSelectionRect` | boolean / SelectionRect \| null | false / null | |
| `selectionMode` | SelectionMode | `Full` | React default |
| `multiSelectionActive`, `selectionKeyPressed`, `panActivationKeyPressed`, `zoomActivationKeyPressed` | boolean | false | from KeyboardTracker |
| `connection` | ConnectionState | `initialConnection` | screen→flow converted by XYHandle already |
| `connectionMode` | ConnectionMode | `Strict` | |
| `connectionRadius` | number | 20 | |
| `connectionClickStartHandle` | `{nodeId,id,type} \| null` | null | |
| `connectOnClick` | boolean | true | |
| `defaultEdgeOptions` | DefaultEdgeOptions \| undefined | undefined | |
| `defaultMarkerColor` | string \| null | `'#b1b1b7'` | |
| `parallelEdges` / `parallelEdgeGap` | ParallelEdges / number | `'off'` / 12 | XY Lit |
| `onlyRenderVisibleElements` | boolean | false | |
| `zIndexMode` | ZIndexMode | `'basic'` | |
| `noDragClassName` / `noWheelClassName` / `noPanClassName` | string | `nodrag` / `nowheel` / `nopan` | |
| `fitViewQueued` / `fitViewOptions` / `fitViewResolver` | | false / undefined / null | |
| `ariaLabelConfig` | AriaLabelConfig | `mergeAriaLabelConfig()` | |
| `ariaLiveMessage` | string | `''` | |
| `disableKeyboardA11y` | boolean | false | |
| `isValidConnection` | IsValidConnection \| undefined | undefined | function property |
| `onBeforeDelete`, `onBeforeConnect`, `onBeforeReconnect` | fn \| undefined | undefined | function properties |
| `getEdgeId` | GetEdgeId | upstream `getEdgeId` | |
| `activeGesture` | `{ kind: 'drag' \| 'resize'; id: string } \| null` | null | phase tracking |
| `lastPointerFlowPosition` | XYPosition \| null | null | pane pointermove |
| `debug` | boolean | false | logs changes |

## `FlowStore` — `flow-store.ts`

```ts
export interface FlowHost<N extends Node = Node, E extends Edge = Edge> {
  /** Dispatch a DOM event; returns false when a listener called preventDefault(). */
  emit<K extends keyof FlowEventMap<N, E>>(type: K, detail: FlowEventMap<N, E>[K], cancelable?: boolean): boolean;
}

export class FlowStore<N extends Node = Node, E extends Edge = Edge> {
  constructor(options?: Partial<FlowOptions<N, E>>);

  // state
  getState(): Readonly<FlowState<N, E>>;
  setState(patch: Partial<FlowState<N, E>>): void;          // shallow merge, schedules notify
  subscribe(listener: () => void): () => void;              // notified once per microtask
  flush(): void;                                            // run pending notify now (tests)

  // wiring
  setHost(host: FlowHost<N, E> | null): void;
  setOptions(options: Partial<FlowOptions<N, E>>): void;    // see §setOptions
  get source(): FlowDataSource<N, E>;
  setSource(source: FlowDataSource<N, E> | null): void;     // null → fresh ArraySource
  readonly instance: FlowInstance<N, E>;                    // created once, stable identity

  // middleware (experimental_useOnNodesChangeMiddleware equivalent)
  addNodeChangeMiddleware(fn: NodeChangeMiddleware<N, E>): () => void;
  addEdgeChangeMiddleware(fn: EdgeChangeMiddleware<N, E>): () => void;

  // actions (ported; signatures follow React's ReactFlowActions unless noted)
  setNodesFromSource(nodes: N[]): void;                     // React setNodes
  setEdgesFromSource(edges: E[]): void;                     // React setEdges
  updateNodeInternals(updates: Map<string, InternalNodeUpdate>, params?: { triggerFitView?: boolean }): void;
  updateNodePositions(items: Map<string, NodeDragItem | InternalNode<N>>, dragging?: boolean, meta?: Partial<ChangeMeta>): void;
  triggerNodeChanges(changes: NodeChange<N>[], meta: ChangeMeta<N, E>, o?: { apply?: () => void }): void;
  triggerEdgeChanges(changes: EdgeChange<E>[], meta: ChangeMeta<N, E>, o?: { apply?: () => void }): void;
  addSelectedNodes(ids: string[]): void;
  addSelectedEdges(ids: string[]): void;
  unselectNodesAndEdges(params?: { nodes?: N[]; edges?: E[] }): void;
  resetSelectedElements(): void;
  handleNodeSelection(id: string, unselect?: boolean, nodeEl?: HTMLElement | null): void;  // Svelte port
  handleEdgeSelection(id: string): void;                                                   // Svelte port
  moveSelectedNodes(direction: XYPosition, factor: number): void;                         // React useMoveSelectedNodes
  setMinZoom(z: number): void; setMaxZoom(z: number): void;
  setTranslateExtent(e: CoordinateExtent): void; setNodeExtent(e: CoordinateExtent): void;
  panBy(delta: XYPosition): Promise<boolean>;
  setCenter(x: number, y: number, o?: SetCenterOptions): Promise<boolean>;
  fitView(options?: FitViewOptions<N>): Promise<boolean>;
  updateConnection(c: ConnectionState<InternalNode<N>>): void;
  cancelConnection(): void;
  setViewportFromPanZoom(v: Viewport): void;                // XYPanZoom onTransformChange
  resolveFitView(o?: { force?: boolean }): Promise<void>;   // called by PanZoom/ContainerSize controllers
  reset(): void;

  // hooks set by the flow element (null in Node tests)
  requestNodeMeasure: ((ids: string[]) => void) | null;    // MeasureController
  readonly selectionChangeHandlers: Map<symbol, (p: { nodes: N[]; edges: E[] }) => void>;

  // derived (memoised; see §Visible elements)
  getVisibleNodes(): InternalNode<N>[];
  getLayoutedEdges(): Map<string, EdgeLayouted<E>>;
  getMarkerDefs(): MarkerDef[];

  // history (02-types §FlowHistory): source.history ?? registered local history ?? null
  get history(): FlowHistory | null;
  setHistory(h: FlowHistory | null): void;

  // utilities used by elements
  emit: FlowHost<N, E>['emit'];                             // forwards to host, returns true without host
  reportError(code: string, message: string): void;         // 'flow-error' event; default console.warn in dev
  bumpStructureRevision(): void;
}
```

### Notification

`setState` merges synchronously, marks dirty and schedules one `queueMicrotask(notify)`.
`notify` calls listeners in subscription order. Listeners must not throw; wrap each in
try/catch and `reportError('XYL00', …)`. Actions read and write state synchronously, so the
engine's `getStoreItems()`/`getTransform()` callbacks always see current values.

### Construction

`new FlowStore(options)`:

1. `state = createInitialState(options)` (DEFAULTS merged with options).
2. `fitViewQueued = !!options.fitView` (initial fit, React semantics).
3. `source = new ArraySource(options.nodes ?? [], options.edges ?? [])`; subscribe
   (`syncFromSource`), then call `syncFromSource()` once.
4. `instance = createFlowInstance(this)`.

### Sources

```ts
setSource(next) {
  oldSource.detach?.(); unsubscribe old;
  source = next ?? new ArraySource([], []);
  source.attach?.(this);
  subscribe(source → syncFromSource);
  syncFromSource();
  bumpStructureRevision();
}

syncFromSource() {
  if (source.nodes !== state.nodes) setNodesFromSource(source.nodes);
  if (source.edges !== state.edges) setEdgesFromSource(source.edges);
  if (source.structureVersion !== undefined && source.structureVersion !== lastSourceStructureVersion) {
    lastSourceStructureVersion = source.structureVersion; bumpStructureRevision();
  }
}
```

`ArraySource` (`sources/array-source.ts`):

```ts
export class ArraySource<N, E> implements FlowDataSource<N, E> {
  constructor(public nodes: N[], public edges: E[]);
  subscribe(l): () => void;
  replaceNodes(nodes: N[]): void;   // assign + notify (used by the .nodes setter)
  replaceEdges(edges: E[]): void;
  applyNodeChanges(changes, meta) { this.nodes = meta.snapshotNodes ?? applyNodeChanges(changes, this.nodes); notify(); }
  applyEdgeChanges(changes, meta) { this.edges = meta.snapshotEdges ?? applyEdgeChanges(changes, this.edges); notify(); }
}
```

Listeners are called synchronously, so in uncontrolled mode the store is up to date when
`triggerNodeChanges` returns.

### `setNodesFromSource(nodes)` (React `setNodes`)

1. `prevIds` = the id set kept from the previous call (maintain `Set<string>`).
2. `const { nodesInitialized, hasSelectedNodes } = adoptUserNodes(nodes, nodeLookup, parentLookup, { nodeOrigin, nodeExtent, elevateNodesOnSelect, checkEquality: true, zIndexMode })`.
3. `idSetChanged` = sizes differ or any `nodes[i].id` not in `prevIds`. Update `prevIds`.
4. `nodesSelectionActive = nodesSelectionActive && hasSelectedNodes`.
5. `lookupVersion++`; if `idSetChanged` → `structureRevision++`.
6. If `fitViewQueued && nodesInitialized` → `resolveFitView()` (see §fitView).
7. If `nodesInitialized` flipped false→true → schedule `emit('nodes-initialized', { nodes })`
   (microtask, once per flip).
8. `setState({ nodes, nodesInitialized, hasSelectedNodes, nodesSelectionActive, lookupVersion, structureRevision })`.
9. `scheduleSelectionCheck()` (§Selection change).

### `setEdgesFromSource(edges)` (React `setEdges`)

`updateConnectionLookup(connectionLookup, edgeLookup, edges)`; edge id-set change bumps
`structureRevision`; `setState({ edges })`; `scheduleSelectionCheck()`.

### Change pipeline

```ts
triggerNodeChanges(changes, meta) {
  if (!changes.length) return;
  for (const mw of nodeMiddlewares) { changes = mw(changes, meta); if (!changes.length) return; }
  if (state.debug) console.log('XY Lit: node changes', meta, changes);
  const proceed = emit('nodes-change', { changes, meta }, true);
  if (!proceed) return;
  if (o?.apply) o.apply(); else source.applyNodeChanges(changes, meta);
}
```

`triggerEdgeChanges` is identical with `edges-change`. When a listener prevents default, the
app owns state and must assign `.nodes`/`.edges` (controlled mode). Nothing is retried.

`NodeChangeMiddleware<N,E> = (changes: NodeChange<N>[], meta: ChangeMeta<N,E>) => NodeChange<N>[]`.
Middlewares run in registration order. Helper lines (pro) and soft locks (collab) use them.

### Phases

`updateNodePositions(items, dragging = false, meta?)` — port React's version (expandParent
handling, connection `from` update, middlewares via `triggerNodeChanges`) and compute meta:

```ts
const gesture = state.activeGesture;
let phase: ChangePhase;
if (meta?.phase) phase = meta.phase;
else if (dragging) phase = gesture?.kind === 'drag' ? 'live' : 'start';
else phase = gesture?.kind === 'drag' ? 'end' : 'discrete';
if (phase === 'start') state.activeGesture = { kind: 'drag', id: nanoid() };
const fullMeta = { origin: meta?.origin ?? (phase === 'discrete' ? 'keyboard' : 'drag'), gestureId: state.activeGesture?.id, ...meta, phase };
if (phase === 'end') state.activeGesture = null;
```

Use a 10-character random id (`crypto.randomUUID().slice(0, 10)`); no nanoid dependency.
Resize gestures set `activeGesture = { kind: 'resize', … }` from `<xy-resize-control>`
(see `08-plugins.md`).

`updateNodePositions` does **not** mutate internal nodes. New positions reach `nodeLookup`
only through the source round trip (change → source → `setNodesFromSource`), as in React.
XYDrag keeps its own drag items, so a controlled app that applies changes a frame late only
makes the node lag, as in React. (`moveSelectedNodes` does mutate, as React's
`useMoveSelectedNodes` does; keep that.)

### `updateNodeInternals(updates, params)`

Port React's version: call `updateNodeInternalsSystem(updates, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent, zIndexMode)`;
if `updatedInternals`: `updateAbsolutePositions(...)`, `lookupVersion++`, resolve a queued
fitView (if `params?.triggerFitView !== false`), `setState({ lookupVersion })`; then
`triggerNodeChanges(changes, { phase: 'discrete', origin: 'measure' })` when changes exist.

### Selection actions

Port from React `store/index.ts`: `addSelectedNodes`, `addSelectedEdges`,
`unselectNodesAndEdges`, `resetSelectedElements`, including the `getSelectionChanges(…,
mutateItem = true)` hack (mutates `internalNode.selected` so a drag that starts on an
unselected node does not also drag the previously selected one). All emit with
`{ phase: 'discrete', origin: 'select' }`.

`handleNodeSelection` and `handleEdgeSelection`: port Svelte's versions
(`.vendor/xyflow/packages/svelte/src/lib/store/index.ts`) but express them with the React
actions above (no direct array mutation). `handleNodeSelection` blurs `nodeEl` in a rAF when
unselecting.

`moveSelectedNodes(direction, factor)`: port React `useMoveSelectedNodes`: velocity 5 px or
`snapGrid` when `snapToGrid`, factor 4 with Shift; `calculateNodePosition` with extents;
`updateNodePositions(map, false, { phase: 'discrete', origin: 'keyboard' })`.

### Selection change

`scheduleSelectionCheck()` coalesces to one microtask. It recomputes selected node ids and
selected edge ids. If either set differs from the previous sets, it emits
`selection-change` with `{ nodes: selectedNodes, edges: selectedEdges }` (arrays in model
order). Also notifies `selectionChangeHandlers` (used by `OnSelectionChangeController`).

### fitView

```ts
fitView(options) {
  const resolver = state.fitViewResolver ?? withResolvers<boolean>();
  setState({ fitViewQueued: true, fitViewOptions: options, fitViewResolver: resolver });
  startFitViewTimer(options?.timeout ?? 400);
  // trigger the check: if already initialised, resolve now
  if (state.nodesInitialized && state.panZoom) resolveFitView();
  return resolver.promise;
}

async resolveFitView({ force = false } = {}) {
  const { panZoom, nodeLookup, width, height, minZoom, maxZoom, fitViewOptions, fitViewResolver } = state;
  if (!panZoom || !width || !height) return;           // stays queued; PanZoomController re-calls when ready
  clearFitViewTimer();
  setState({ fitViewQueued: false });
  await fitViewport({ nodes: nodeLookup, width, height, panZoom, minZoom, maxZoom }, fitViewOptions);
  fitViewResolver?.resolve(true);
  setState({ fitViewOptions: undefined, fitViewResolver: null });
}
```

Timer fallback: when the timer fires and `fitViewQueued` is still true, call
`resolveFitView({ force: true })`. `fitViewport` ignores unmeasured nodes (it filters by
dimensions), so this fits whatever is measured. If no node has dimensions, resolve `false`.

`PanZoomController` (04) calls `store.resolveFitView()` right after it sets `panZoom` if
`fitViewQueued && nodesInitialized`. The `ResizeController` calls it when `width`/`height`
become non-zero.

### Viewport actions

Port from React: `panBy` (via `panBySystem`), `setCenter`, `setMinZoom`, `setMaxZoom`,
`setTranslateExtent`, `setNodeExtent` (re-adopts with `checkEquality: false`).
`setViewportFromPanZoom(v)` sets `transform = [v.x, v.y, v.zoom]` and is called on every
XYPanZoom frame.

### Connection

`updateConnection(c)` → `setState({ connection: c })`; `cancelConnection()` →
`setState({ connection: { ...initialConnection } })`. While a connection is in progress and
the source node moves, `updateNodePositions` updates `connection.from` (React lines 233–236).

### `setOptions(options)`

Shallow-merges option fields. Side effects:

| Option changed | Effect |
|---|---|
| `minZoom` / `maxZoom` | `panZoom?.setScaleExtent([min, max])` |
| `translateExtent` | `panZoom?.setTranslateExtent(extent)` |
| `nodeExtent` | `setNodeExtent` |
| `nodeOrigin`, `elevateNodesOnSelect`, `zIndexMode` | re-run `adoptUserNodes` with `checkEquality: false`; `lookupVersion++` |
| `snapGrid` | also sets `snapToGrid = !!options.snapGrid` unless `snapToGrid` given |
| `ariaLabelConfig` | `mergeAriaLabelConfig(partial)` |
| `defaultEdgeOptions`, `connectionMode`, `parallelEdges`, `parallelEdgeGap`, `elevateEdgesOnSelect` | invalidate the edge-layout memo |

## Visible elements — `visible.ts`

Port `.vendor/xyflow/packages/svelte/src/lib/store/visibleElements.ts`.

- `getVisibleNodes()`: memo key `(lookupVersion, onlyRenderVisibleElements ? transform+width+height : 0)`.
  Without culling: every node in `nodeLookup` with `!hidden`, in lookup order. With culling:
  `getNodesInside(nodeLookup, {x:0,y:0,width,height}, transform, true)` filtered by
  `!hidden`, plus the endpoints of visible edges (Svelte adds them).
- `getLayoutedEdges()`: memo key `(edges identity, lookupVersion, layout options, culling key)`.
  For each edge: skip if either endpoint missing or hidden; skip when culled
  (`isEdgeVisible`). **Reuse** the previous `EdgeLayouted` object when `edge === prev.edge`,
  `sourceNode === prev.sourceNode`, `targetNode === prev.targetNode`, and the endpoints'
  `internals.positionAbsolute` objects and `internals.handleBounds` objects are the same
  objects as last time (in-place assignments by `updateAbsolutePositions` would otherwise go
  unnoticed). Otherwise compute `getEdgePosition(...)`; when it returns null (missing handle,
  error 008), skip. Build `{ ...defaultEdgeOptions, ...edge, ...edgePosition, zIndex:
  getElevatedEdgeZIndex(...), sourceNode, targetNode, edge, resolvedOffset }`.
- Parallel spreading (`edges/parallel.ts`), only when `parallelEdges === 'spread'`: group the
  laid-out edges by key `sortedPair(source:sourceHandle, target:targetHandle)`. For a group of
  k edges sorted by id, edge i gets `((i - (k - 1) / 2) * parallelEdgeGap) * dir`, where
  `dir = 1` if `source:sourceHandle` is the lexicographically smaller endpoint, else `-1`.
  Explicit `edge.offset` always wins. `resolvedOffset` participates in the reuse check.

## Markers — `markers.ts`

`getMarkerDefs()` (memo on edges identity + defaultEdgeOptions + defaultMarkerColor + flowId):

- Upstream markers (`arrow`, `arrowclosed`, object or default options): `createMarkerIds(edges, { id: flowId, defaultColor, defaultMarkerStart, defaultMarkerEnd })`
  after filtering out custom markers. Ids look like `1__type=arrowclosed` (e2e checks
  `marker-start="url('#1__type=arrowclosed')"`).
- Custom markers (`type: 'custom'`): id `${flowId}__custom-${hash}` where `hash` is FNV-1a
  (32-bit, base36) of the JSON of the marker with sorted keys. One def per distinct spec.
- `getMarkerUrl(marker, flowId)`: string markers → `url('#${marker}')`; upstream objects →
  `` url('#${getMarkerId(marker, flowId)}') ``; custom → `url('#<custom id>')`.

## Instance — `instance.ts`

`createFlowInstance(store)` returns an object with stable identity, implementing
`FlowInstance` (02-types). Port `useReactFlow.ts` and `useViewportHelper.ts`. Differences:

- `setNodes(payload)` / `setEdges(payload)` push onto `SetQueue` (`batch.ts`, a port of
  React's `BatchProvider`): payloads are folded in a microtask
  (`next = queue.reduce((acc, p) => typeof p === 'function' ? p(acc) : p, current)`), then
  `triggerNodeChanges(getElementsDiffChanges({ items: next, lookup: nodeLookup }), { phase: 'discrete', origin: 'api', snapshotNodes: next })`.
  Same for edges with `edgeLookup` and `snapshotEdges`.
- `addNodes(payload, { placement })`: nodes without `position` get
  `findFreePosition(size, placement)`, where size = `width/height ?? initialWidth/initialHeight ?? DEFAULT_NODE_SIZE`.
  Placed nodes are added one by one into the spatial index so a batch doesn't overlap
  itself. Then `triggerNodeChanges(nodes.map(item => ({ type: 'add', item })), { phase: 'discrete', origin: 'api' })`.
- `addEdges(payload)`: `triggerEdgeChanges(adds, { phase: 'discrete', origin: 'api' })`.
- `updateNodeData(id, update, options)`: build the equivalent `replace` change. If
  `source.updateNodeData` exists and `!options?.replace`: run the node middlewares on
  `[replaceChange]` (a middleware may drop it), emit `nodes-change` (cancelable), and if not
  prevented call `source.updateNodeData(id, patch, { phase: 'discrete', origin: 'api' })`
  instead of `applyNodeChanges`. Otherwise go through `triggerNodeChanges([replaceChange])`
  (React behaviour). Same pattern for `updateEdgeData`. Implement this as
  `store.triggerNodeChanges(changes, meta, { apply?: () => void })`: the optional `apply`
  replaces the default `source.applyNodeChanges` call.
- Multi-trigger operations (`deleteElements`, and pro's paste/layout) set one shared
  `meta.gestureId` on all their triggers so history can group them.
- `deleteElements({ nodes, edges })`: `getElementsToRemove({ nodesToRemove, edgesToRemove, nodes, edges, onBeforeDelete })`;
  if anything matches: emit `edges-delete`/`nodes-delete`/`delete` (React order:
  edges, nodes, then `delete`), then `triggerEdgeChanges(remove…)` and
  `triggerNodeChanges(remove…)` with `{ phase: 'discrete', origin: 'delete' }`. If the source
  has `transact`, wrap both triggers in `source.transact(fn, 'delete')`.
- `updateNodeInternals(ids)`: needs DOM; the flow element provides
  `store.requestNodeMeasure(ids)` (set by `MeasureController`). The instance forwards to it.
- `findFreePosition(size, options)`: see §Placement.
- `screenToFlowPosition`/`flowToScreenPosition`: port React (uses `domNode.getBoundingClientRect()`).
- `getNodes()`/`getEdges()`/`toObject()`: shallow copies like React, with the local-only
  `remote` field removed.
- `viewportInitialized`: getter, `!!state.panZoom`.

## Keyboard — `keyboard/`

`key-code.ts`: port the matching logic of `.vendor/xyflow/packages/react/src/hooks/useKeyPress.ts`
as pure functions:

```ts
export function parseKeyCode(keyCode: KeyCode | null): string[][];      // [['Meta','s'], ['Shift']]
export class PressedKeys { add(e: KeyboardEvent): void; remove(e: KeyboardEvent): void; clear(): void;
  matches(combos: string[][]): boolean; }
```

Keep React's details: match on both `event.key` and `event.code`; clear all pressed keys on
Meta keyup on macOS (keyup for other keys is not fired while Meta is held); combos with `+`.

`key-tracker.ts`: one `KeyboardTracker` per page (module singleton, created lazily on first
subscription; listeners removed when the last subscriber leaves):

```ts
export const keyboardTracker: {
  subscribe(listener: (e: KeyboardEvent, type: 'down' | 'up') => void): () => void;
  onReset(listener: () => void): () => void;                // window blur / contextmenu
  readonly pressed: PressedKeys;
  activeFlow: object | null;                                 // set by flows on pointerdown/focusin
};
```

It listens on `window` for `keydown`, `keyup`, `blur`, `contextmenu`. Flows translate key
state into store flags in `FlowKeysController` (04).

## Placement — `placement.ts`

```ts
export class NodeSpatialIndex {            // rbush of absolute node rects
  constructor(nodeLookup: NodeLookup, gap: number);
  insert(rect: Rect): void;
  collides(rect: Rect): boolean;           // inflate by gap, rbush.collides
}
export function findFreePosition(store: FlowStore, size: Dimensions, o?: PlacementOptions): XYPosition;
```

Algorithm: centre `c` = `around` resolved in flow coordinates (`'viewport-center'` =
`screenToFlowPosition` of the pane centre without snapping; `'pointer'` =
`lastPointerFlowPosition ?? viewport centre`). For ring `r = 0..maxRings` iterate candidates
`(i, j)` with `max(|i|,|j|) === r` in a fixed order (top edge left→right, right edge
top→bottom, bottom edge right→left, left edge bottom→top). Candidate top-left =
`c + (i*step, j*step) - size/2`, snapped to `snapGrid` when `snapToGrid`. Return the first
candidate whose rect doesn't collide. If none, return `c - size/2`. Convert to `node.position`
using `nodeOrigin` (position = topLeft + origin × size).

## Edge end labels — `edges/end-labels.ts`

```ts
export function getEdgeEndLabelPosition(
  p: EdgePosition, o: { end: 'source' | 'target'; distance?: number; normalOffset?: number },
): XYPosition
```

Direction per handle side: right (1,0), left (−1,0), top (0,−1), bottom (0,1). Point =
handle point + dir × `distance` (default 14) + normal × `normalOffset` (default 10), with
normal = (−dir.y, dir.x). Deterministic, no path sampling.

## Change helpers — `changes.ts`

Port `.vendor/xyflow/packages/react/src/utils/changes.ts` verbatim (types adapted):
`applyNodeChanges`, `applyEdgeChanges`, `createSelectionChange`, `getSelectionChanges`,
`getElementsDiffChanges`, `elementToRemoveChange`.

## Exports — `index.ts`

`FlowStore`, `ArraySource`, `createFlowInstance`, every function above, every type in
`02-types.md`, the constants, `keyboardTracker`, `parseKeyCode`, `PressedKeys`, and these
engine re-exports for users: `getBezierPath`, `getSmoothStepPath`, `getStraightPath`,
`getBezierEdgeCenter`, `getEdgeCenter`, `getViewportForBounds`, `getNodesBounds`,
`getIncomers`, `getOutgoers`, `getConnectedEdges`, `addEdge`, `reconnectEdge` (wrapped to the
XY Lit `Edge` type), `Position`, `MarkerType`, `ConnectionMode`, `ConnectionLineType`,
`PanOnScrollMode`, `SelectionMode`, `ResizeControlVariant`, plus the engine types listed in
`engine.ts`. Internal-only engine symbols (XYDrag etc.) are exported from
`@xy-lit/store/internal` (second entry point) for `@xy-lit/flow` and `@xy-lit/pro`.

## Unit tests (`packages/store/test/`, Node)

Port the intent of upstream behaviour into these files; each bullet is at least one test.

- `changes.test.ts`: every change type; add with index; remove wins over other changes; replace.
- `flow-store.test.ts`: uncontrolled apply; controlled (host prevents default → source untouched);
  middleware order and filtering; structureRevision bumps only on id-set change; nodes-initialized
  fires once per flip; selection-change fires on set change only; phase inference start/live/end/discrete;
  fitView queue → resolves after measurement (fake panZoom); fitView timeout fallback.
- `visible.test.ts`: hidden nodes excluded; culling; edge reuse identity; reuse invalidated when
  positionAbsolute object changes; parallel offsets for k = 2, 3 and opposite directions.
- `instance.test.ts`: setNodes batching (two calls in one tick → one change event);
  updateNodeData via source fast path; deleteElements with onBeforeDelete false/partial;
  addNodes without position places without overlap.
- `markers.test.ts`: upstream ids; custom hash stable and deduplicated.
- `key-code.test.ts`: combos, arrays, macOS Meta quirk.
- `placement.test.ts`: spiral order, snapping, nodeOrigin conversion.
