# 02 · Public types

All types live in `packages/store/src/types/` and are re-exported by `@xy-lit/store` and
`@xy-lit/flow`. Upstream types come from `engine.ts`. Names match React Flow wherever the
concept is the same.

## Nodes — `types/nodes.ts`

```ts
import type { NodeBase, InternalNodeBase, NodeProps as NodePropsBase, Position } from '../engine.js';

export type Node<
  NodeData extends Record<string, unknown> = Record<string, unknown>,
  NodeType extends string | undefined = string | undefined,
> = NodeBase<NodeData, NodeType> & {
  /** Extra classes for the <xy-node> host. Space-separated string. */
  class?: string;
  /** Inline style string for the <xy-node> host, e.g. "background: red;". */
  style?: string;
  focusable?: boolean;
  /** Set by the change pipeline while a NodeResizer gesture is active. */
  resizing?: boolean;
  /** ARIA role for the node host. Default "group" when focusable. */
  ariaRole?: string;
  /**
   * Extra attributes for the <xy-node> host. Keys must match /^(data|aria)-[a-z0-9-]+$/ or be
   * one of: title, lang, dir, tabindex. Anything else is dropped with dev warning 'XYL01'.
   */
  domAttributes?: Record<string, string>;
  /**
   * Local-only presence info filled in by collaborative sources. Never persisted, never sent;
   * toObject() strips it. Used by <xy-node> for remote selection rings and highlights.
   */
  remote?: RemoteNodeMeta;
};

export type RemoteUser = { clientId: number; id: string; name: string; color: string };
export type RemoteNodeMeta = {
  selectedBy?: RemoteUser[];
  draggingBy?: RemoteUser;
  resizingBy?: RemoteUser;
  addedBy?: RemoteUser;         // set for ~1.5 s after a remote insert
};

export type InternalNode<N extends Node = Node> = InternalNodeBase<N>;

export type BuiltInNode =
  | Node<{ label: string }, 'input' | 'output' | 'default' | undefined>
  | Node<Record<string, never>, 'group'>;

/** Props passed to node renderers and FlowNodeElement. */
export type NodeProps<N extends Node = Node> = NodePropsBase<N> & {
  type: N['type'] extends string ? N['type'] : string;
};
```

`NodePropsBase` (upstream) is: `id, data, width, height, sourcePosition, targetPosition,
dragHandle, parentId, type, dragging, zIndex, selectable, deletable, selected, draggable,
isConnectable, positionAbsoluteX, positionAbsoluteY`.

## Edges — `types/edges.ts`

```ts
import type { EdgeBase, EdgePosition, DefaultEdgeOptionsBase, EdgeMarker, MarkerType,
  BezierPathOptions, SmoothStepPathOptions, StepPathOptions } from '../engine.js';

/** Upstream markers plus custom path markers (XY Lit addition). */
export type CustomEdgeMarker = {
  type: 'custom';
  /** SVG path data drawn in a 20×20 viewBox centred on 0,0, pointing towards +x. */
  path: string;
  width?: number;      // default 12.5
  height?: number;     // default 12.5
  refX?: number;       // default 0
  refY?: number;       // default 0
  color?: string | null;
  fill?: 'stroke' | 'none' | string;  // 'stroke' = same as color (default), 'none' = outline
  strokeWidth?: number;
  markerUnits?: string; // default 'strokeWidth'
  orient?: string;      // default 'auto-start-reverse'
};
export type XYEdgeMarker = EdgeMarker | CustomEdgeMarker;
export type XYEdgeMarkerType = string | XYEdgeMarker;

export type Edge<
  EdgeData extends Record<string, unknown> = Record<string, unknown>,
  EdgeType extends string | undefined = string | undefined,
> = Omit<EdgeBase<EdgeData, EdgeType>, 'markerStart' | 'markerEnd'> & {
  markerStart?: XYEdgeMarkerType;
  markerEnd?: XYEdgeMarkerType;
  /** Centre label (plain text, rendered with edgeText()). */
  label?: string;
  /** Label near the source end (XY Lit addition). */
  startLabel?: string;
  /** Label near the target end (XY Lit addition). */
  endLabel?: string;
  /** Inline style for the HTML label wrapper (labels are HTML, as in Svelte Flow). */
  labelStyle?: string;
  style?: string;
  class?: string;
  focusable?: boolean;
  reconnectable?: boolean | 'source' | 'target';
  /** Perpendicular offset in px for parallel edges; set by parallel-edges="spread" if absent. */
  offset?: number;
  ariaRole?: string;
  domAttributes?: Record<string, string>;  // same key rules as Node.domAttributes, applied to <g>
  pathOptions?: BezierPathOptions | SmoothStepPathOptions | StepPathOptions;
};

export type DefaultEdgeOptions = DefaultEdgeOptionsBase<Edge>;

/** What the edge layout pass produces for each visible edge. Identity-stable (see 03-store.md). */
export type EdgeLayouted<E extends Edge = Edge> = E & EdgePosition & {
  sourceNode: InternalNode;
  targetNode: InternalNode;
  /** The user edge this was laid out from (for identity comparison). */
  edge: E;
  zIndex: number;
  /** Resolved offset (explicit edge.offset, or assigned by parallel spreading, else 0). */
  resolvedOffset: number;
};

/** Props passed to edge renderers. */
export type EdgeProps<E extends Edge = Edge> = Omit<E, 'sourceHandle' | 'targetHandle' | 'markerStart' | 'markerEnd'> &
  EdgePosition & {
    type: string;
    selected: boolean;
    animated: boolean;
    selectable: boolean;
    deletable: boolean;
    sourceHandleId: string | null;
    targetHandleId: string | null;
    /** Ready-to-use `url('#…')` strings, or undefined. */
    markerStart?: string;
    markerEnd?: string;
    /** resolvedOffset from the layout pass. */
    offset: number;
    interactionWidth: number; // default 20
  };
```

## Renderers — `packages/flow/src/nodes/define-node-type.ts`, `edges/define-edge-type.ts`

These live in `@xy-lit/flow` because they depend on Lit types.

```ts
import type { TemplateResult, SVGTemplateResult, CSSResultGroup } from 'lit';

export type NodeRenderer<N extends Node = Node> =
  (props: NodeProps<N>, flow: FlowInstance) => TemplateResult | typeof nothing | string;

export type NodeTypeDefinition<N extends Node = Node> = {
  readonly kind: 'renderer';
  readonly render: NodeRenderer<N>;
  /** Adopted into the flow root once per flow, deduplicated by object identity. */
  readonly styles?: CSSResultGroup;
  /** Optional resizer defaults applied by <xy-node> (renders <xy-node-resizer> before content). */
  readonly resizer?: NodeResizerDefaults;
};

export function defineNodeType<N extends Node = Node>(def: {
  render: NodeRenderer<N>;
  styles?: CSSResultGroup;
  resizer?: NodeResizerDefaults;
}): NodeTypeDefinition<N>;

/** Element-based node: a FlowNodeElement subclass constructor, or a registered tag name. */
export type NodeTypeEntry = NodeTypeDefinition<any> | (new () => FlowNodeElement<any>) | string;
export type NodeTypes = Record<string, NodeTypeEntry>;

export type EdgeRenderResult = {
  /** SVG content placed inside the edge's <g>. Usually baseEdge(...). Required. */
  path: SVGTemplateResult;
  /** HTML rendered in the edge-label layer (flow coordinates). */
  label?: TemplateResult;
  startLabel?: TemplateResult;
  endLabel?: TemplateResult;
};
export type EdgeRenderer<E extends Edge = Edge> =
  (props: EdgeProps<E>, flow: FlowInstance) => EdgeRenderResult;
export type EdgeTypeDefinition<E extends Edge = Edge> = {
  readonly kind: 'edge-renderer';
  readonly render: EdgeRenderer<E>;
  readonly styles?: CSSResultGroup;
};
export function defineEdgeType<E extends Edge = Edge>(def: { render: EdgeRenderer<E>; styles?: CSSResultGroup }): EdgeTypeDefinition<E>;
export type EdgeTypes = Record<string, EdgeTypeDefinition<any>>;

export type ConnectionLineRenderer = (props: ConnectionLineProps, flow: FlowInstance) => SVGTemplateResult;
export type ConnectionLineProps = {
  fromX: number; fromY: number; toX: number; toY: number;
  fromPosition: Position; toPosition: Position;
  fromNode: InternalNode; fromHandle: Handle;
  toNode: InternalNode | null; toHandle: Handle | null;
  connectionStatus: 'valid' | 'invalid' | null;
  connectionLineType: ConnectionLineType;
  style?: string;
};
```

## Changes — `types/changes.ts`

Upstream `NodeChange`, `EdgeChange` and their members are re-exported unchanged. Added:

```ts
export type ChangePhase = 'start' | 'live' | 'end' | 'discrete';

export type ChangeOrigin =
  | 'drag' | 'resize' | 'keyboard' | 'select' | 'measure' | 'connect' | 'reconnect'
  | 'delete' | 'api' | 'paste' | 'undo' | 'layout' | 'remote';

export type ChangeMeta<N extends Node = Node, E extends Edge = Edge> = {
  phase: ChangePhase;
  origin: ChangeOrigin;
  /** Stable id for one gesture (drag/resize), same across start/live/end. */
  gestureId?: string;
  /** For origin 'api' setNodes/setEdges: the full next array, so ArraySource can take it verbatim. */
  snapshotNodes?: N[];
  snapshotEdges?: E[];
};
```

Phase rules (filled in by the store, see `03-store.md` §Phases):

| Source | Phase |
|---|---|
| XYDrag first `updateNodePositions(…, true)` of a gesture | `start` |
| subsequent `dragging: true` updates | `live` |
| `updateNodePositions(…, false)` | `end` |
| XYResizer `onResizeStart` / `onResize` / `onResizeEnd` | `start` / `live` / `end` |
| keyboard arrow moves, select, measure, connect, delete, api | `discrete` |

## Data source — `types/source.ts`

```ts
export interface FlowDataSource<N extends Node = Node, E extends Edge = Edge> {
  /** Current arrays. Must keep object identity for unchanged elements between notifications. */
  readonly nodes: N[];
  readonly edges: E[];
  /** Called after nodes and/or edges changed. Synchronous or async is fine. */
  subscribe(listener: () => void): () => void;
  applyNodeChanges(changes: NodeChange<N>[], meta: ChangeMeta<N, E>): void;
  applyEdgeChanges(changes: EdgeChange<E>[], meta: ChangeMeta<N, E>): void;
  /** Precise data update; when absent the store sends a 'replace' change instead. */
  updateNodeData?(id: string, patch: Partial<N['data']>, meta: ChangeMeta<N, E>): void;
  updateEdgeData?(id: string, patch: Partial<NonNullable<E['data']>>, meta: ChangeMeta<N, E>): void;
  /** Group several applies into one atomic unit (one undo step for Yjs). */
  transact?(fn: () => void, origin?: unknown): void;
  /** Bumped when the source wants render-complete to re-arm (e.g. a remote structural change). */
  readonly structureVersion?: number;
  /** True while the source notifies about a change that came from another client (motion). */
  readonly lastUpdateRemote?: boolean;
  /** Undo/redo the source supports (Yjs). The flow binds Mod+Z / Mod+Shift+Z / Mod+Y to it. */
  readonly history?: FlowHistory;
  /** Called by the flow when it stops using the source. */
  detach?(): void;
  /** Called by the flow when it starts using the source. */
  attach?(store: FlowStore<N, E>): void;
}
```

```ts
export interface FlowHistory {
  undo(): void; redo(): void;
  canUndo(): boolean; canRedo(): boolean;
  /** Notifies when canUndo/canRedo may have changed. */
  subscribe(listener: () => void): () => void;
}
```

The store exposes the active history as `store.history` (the source's, else one registered by
`@xy-lit/pro`'s `LocalHistory` through `store.setHistory(h)`; a source history wins).

## Options — `types/options.ts`

```ts
export type FitViewOptions<N extends Node = Node> = FitViewOptionsBase<N> & {
  /** XY Lit: give up waiting for measurement after this many ms and fit what is known. Default 400. */
  timeout?: number;
};
export type KeyCode = string | string[];   // React semantics: 'Shift', 'Meta+s', ['Meta', 's']
export type ColorMode = 'light' | 'dark' | 'system';
export type RenderRoot = 'shadow' | 'light';
export type ParallelEdges = 'off' | 'spread';
export type MotionMode = 'off' | 'enter' | 'enter remote';
export type WheelScrollDetection = 'auto' | 'off';
export type PanelPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center-left' | 'center-right';
export type NodeResizerDefaults = {
  variant?: 'handles' | 'lines' | 'hover-corner';
  minWidth?: number; minHeight?: number; maxWidth?: number; maxHeight?: number;
  keepAspectRatio?: boolean;
};
```

`FitViewOptionsBase` is upstream's (`padding`, `includeHiddenNodes`, `minZoom`, `maxZoom`,
`duration`, `ease`, `interpolate`, `nodes`).

## Event details — `types/events.ts`

Every event is a `CustomEvent<Detail>` dispatched on the `<xy-flow>` host with
`bubbles: true, composed: true`. "Cancelable" events honour `preventDefault()` as described
in `04-flow-element.md` §Events.

```ts
export interface FlowEventMap<N extends Node = Node, E extends Edge = Edge> {
  'init': { instance: FlowInstance<N, E> };
  'nodes-change': { changes: NodeChange<N>[]; meta: ChangeMeta<N, E> };          // cancelable
  'edges-change': { changes: EdgeChange<E>[]; meta: ChangeMeta<N, E> };          // cancelable
  'connect': { connection: Connection; edge: E };                                // cancelable
  'connect-start': { event: MouseEvent | TouchEvent; nodeId: string | null; handleId: string | null; handleType: HandleType | null };
  'connect-end': { event: MouseEvent | TouchEvent; connectionState: FinalConnectionState<InternalNode<N>> };
  'click-connect-start': FlowEventMap<N, E>['connect-start'];
  'click-connect-end': FlowEventMap<N, E>['connect-end'];
  'reconnect': { oldEdge: E; newConnection: Connection; edge: E };               // cancelable
  'reconnect-start': { event: MouseEvent | TouchEvent; edge: E; handleType: HandleType };
  'reconnect-end': { event: MouseEvent | TouchEvent; edge: E; handleType: HandleType; connectionState: FinalConnectionState<InternalNode<N>> };
  'node-click': { event: MouseEvent; node: N };
  'node-double-click': { event: MouseEvent; node: N };
  'node-context-menu': { event: MouseEvent; node: N };
  'node-pointer-enter': { event: PointerEvent; node: N };
  'node-pointer-move': { event: PointerEvent; node: N };
  'node-pointer-leave': { event: PointerEvent; node: N };
  'node-drag-start': { event: MouseEvent; node: N; nodes: N[] };
  'node-drag': { event: MouseEvent; node: N; nodes: N[] };
  'node-drag-stop': { event: MouseEvent; node: N; nodes: N[] };
  'selection-drag-start': { event: MouseEvent; nodes: N[] };
  'selection-drag': { event: MouseEvent; nodes: N[] };
  'selection-drag-stop': { event: MouseEvent; nodes: N[] };
  'selection-start': { event: PointerEvent };
  'selection-end': { event: PointerEvent };
  'selection-click': { event: MouseEvent; nodes: N[] };
  'selection-context-menu': { event: MouseEvent; nodes: N[] };
  'selection-change': { nodes: N[]; edges: E[] };
  'edge-click': { event: MouseEvent; edge: E };
  'edge-double-click': { event: MouseEvent; edge: E };
  'edge-context-menu': { event: MouseEvent; edge: E };
  'edge-pointer-enter': { event: PointerEvent; edge: E };
  'edge-pointer-move': { event: PointerEvent; edge: E };
  'edge-pointer-leave': { event: PointerEvent; edge: E };
  'pane-click': { event: MouseEvent };
  'pane-context-menu': { event: MouseEvent };
  'pane-scroll': { event: WheelEvent };
  'pane-pointer-enter': { event: PointerEvent };
  'pane-pointer-move': { event: PointerEvent };
  'pane-pointer-leave': { event: PointerEvent };
  'move-start': { event: MouseEvent | TouchEvent | null; viewport: Viewport };
  'move': { event: MouseEvent | TouchEvent | null; viewport: Viewport };
  'move-end': { event: MouseEvent | TouchEvent | null; viewport: Viewport };
  'viewport-change': { viewport: Viewport };
  'delete': { nodes: N[]; edges: E[] };
  'nodes-delete': { nodes: N[] };
  'edges-delete': { edges: E[] };
  'nodes-initialized': { nodes: N[] };
  'render-complete': { revision: number; nodeCount: number; edgeCount: number; durationMs: number };
  'flow-error': { code: string; message: string };                                // cancelable
}

declare global {
  interface HTMLElementEventMap {
    // filled in by @xy-lit/flow define.ts for typed addEventListener on XyFlowElement
  }
}
```

`XyFlowElement` overrides `addEventListener<K extends keyof FlowEventMap>` overloads so
`flow.addEventListener('connect', (e) => e.detail.connection)` is typed.

## Function properties — `types/options.ts`

```ts
export type IsValidConnection<E extends Edge = Edge> = (edge: E | Connection) => boolean;
export type OnBeforeDelete<N extends Node = Node, E extends Edge = Edge> =
  (params: { nodes: N[]; edges: E[] }) => Promise<boolean | { nodes: N[]; edges: E[] }>;
export type OnBeforeConnect<E extends Edge = Edge> = (connection: Connection) => E | Connection | null | undefined | false;
export type OnBeforeReconnect<E extends Edge = Edge> = (newEdge: E, oldEdge: E) => E | null | undefined | false;
export type GetEdgeId = (connection: Connection) => string;   // default: upstream getEdgeId
```

## Instance — `types/instance.ts`

`FlowInstance<N, E>` is React's `ReactFlowInstance` (port
`.vendor/xyflow/packages/react/src/types/instance.ts`), with these members:

```ts
interface FlowInstance<N, E> {
  // graph
  getNodes(): N[]; setNodes(payload: N[] | ((nodes: N[]) => N[])): void; addNodes(payload: N | N[] | PlaceableNode<N> | PlaceableNode<N>[], options?: { placement?: PlacementOptions }): void;
  getNode(id: string): N | undefined; getInternalNode(id: string): InternalNode<N> | undefined;
  getEdges(): E[]; setEdges(payload: E[] | ((edges: E[]) => E[])): void; addEdges(payload: E | E[]): void;
  getEdge(id: string): E | undefined;
  toObject(): { nodes: N[]; edges: E[]; viewport: Viewport };
  deleteElements(params: { nodes?: { id: string }[]; edges?: { id: string }[] }): Promise<{ deletedNodes: N[]; deletedEdges: E[] }>;
  getIntersectingNodes(node: N | { id: string } | Rect, partially?: boolean, nodes?: N[]): N[];
  isNodeIntersecting(node: N | { id: string } | Rect, area: Rect, partially?: boolean): boolean;
  updateNode(id: string, update: Partial<N> | ((node: N) => Partial<N>), options?: { replace: boolean }): void;
  updateNodeData(id: string, update: Partial<N['data']> | ((node: N) => Partial<N['data']>), options?: { replace: boolean }): void;
  updateEdge(id: string, update: Partial<E> | ((edge: E) => Partial<E>), options?: { replace: boolean }): void;
  updateEdgeData(id: string, update: Partial<E['data']> | ((edge: E) => Partial<E['data']>), options?: { replace: boolean }): void;
  getNodesBounds(nodes: (N | InternalNode<N> | string)[]): Rect;
  getHandleConnections(p: { type: HandleType; nodeId: string; id?: string | null }): HandleConnection[];
  getNodeConnections(p: { type?: HandleType; handleId?: string | null; nodeId: string }): NodeConnection[];
  updateNodeInternals(ids: string | string[]): void;
  findFreePosition(size: Dimensions, options?: PlacementOptions): XYPosition;
  // viewport
  zoomIn(o?: ViewportHelperFunctionOptions): Promise<boolean>; zoomOut(o?): Promise<boolean>;
  zoomTo(zoom: number, o?): Promise<boolean>; getZoom(): number;
  setViewport(v: Viewport, o?): Promise<boolean>; getViewport(): Viewport;
  setCenter(x: number, y: number, o?: SetCenterOptions): Promise<boolean>;
  fitView(o?: FitViewOptions<N>): Promise<boolean>;
  fitBounds(bounds: Rect, o?: FitBoundsOptions): Promise<boolean>;
  screenToFlowPosition(p: XYPosition, o?: { snapToGrid?: boolean }): XYPosition;
  flowToScreenPosition(p: XYPosition): XYPosition;
  readonly viewportInitialized: boolean;
}
export type PlaceableNode<N extends Node> = Omit<N, 'position'> & { position?: XYPosition };
export type PlacementOptions = {
  around?: 'viewport-center' | 'pointer' | XYPosition;  // default 'viewport-center'
  gap?: number;          // spacing kept around existing nodes, default 20
  step?: number;         // spiral step, default snapGrid[0] ?? 20
  maxRings?: number;     // default 200
};
```

`'pointer'` uses the last pointer position over the pane, tracked by the pane controller in
flow coordinates (`store.lastPointerFlowPosition`); falls back to viewport centre.
