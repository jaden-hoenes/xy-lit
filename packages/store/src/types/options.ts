import type {
  AriaLabelConfig,
  Connection,
  ConnectionMode,
  CoordinateExtent,
  FitViewOptionsBase,
  NodeOrigin,
  SelectionMode,
  SnapGrid,
  ZIndexMode,
  GetEdgeIdBase,
} from '../engine.js';
import type { DefaultEdgeOptions, Edge } from './edges.js';
import type { Node } from './nodes.js';

/** Options for `fitView`: upstream's plus a measurement timeout. */
export type FitViewOptions<N extends Node = Node> = FitViewOptionsBase<N> & {
  /** XY Lit: give up waiting for measurement after this many ms and fit what is known. Default 400. */
  timeout?: number;
};

/** React semantics: `'Shift'`, `'Meta+s'`, `['Meta', 's']`. */
export type KeyCode = string | string[];
/** Colour scheme. `system` follows `prefers-color-scheme`. */
export type ColorMode = 'light' | 'dark' | 'system';
/** Where the flow renders: its own shadow root, or the surrounding document. */
export type RenderRoot = 'shadow' | 'light';
/** `spread` fans out edges that connect the same pair of handles. */
export type ParallelEdges = 'off' | 'spread';
/** Entrance motion mode. */
export type MotionMode = 'off' | 'enter' | 'enter remote';
/** Whether wheel events inside scrollable node content scroll the content instead of zooming. */
export type WheelScrollDetection = 'auto' | 'off';
/** Position of a `<xy-panel>`. */
export type PanelPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'center-left'
  | 'center-right';
/** Defaults for the resizer a node type opts into. */
export type NodeResizerDefaults = {
  /** Visual variant. */
  variant?: 'handles' | 'lines' | 'hover-corner';
  /** Minimum width in px. */
  minWidth?: number;
  /** Minimum height in px. */
  minHeight?: number;
  /** Maximum width in px. */
  maxWidth?: number;
  /** Maximum height in px. */
  maxHeight?: number;
  /** Keep the aspect ratio while resizing. */
  keepAspectRatio?: boolean;
};

/** Decides whether a connection (or edge) is valid. */
export type IsValidConnection<E extends Edge = Edge> = (edge: E | Connection) => boolean;
/** Called before deleting; return `false` to cancel, or the (possibly reduced) elements to delete. */
export type OnBeforeDelete<N extends Node = Node, E extends Edge = Edge> = (params: {
  nodes: N[];
  edges: E[];
}) => Promise<boolean | { nodes: N[]; edges: E[] }>;
/** Called before a connection is turned into an edge; return `false`/nullish to cancel. */
export type OnBeforeConnect<E extends Edge = Edge> = (
  connection: Connection,
) => E | Connection | null | undefined | false;
/** Called before an edge is reconnected; return `false`/nullish to cancel. */
export type OnBeforeReconnect<E extends Edge = Edge> = (
  newEdge: E,
  oldEdge: E,
) => E | null | undefined | false;
/** Produces the id of an edge created from a connection. */
export type GetEdgeId = GetEdgeIdBase;

/** Start handle of a click-to-connect interaction. */
export type ConnectionClickStartHandle = {
  nodeId: string;
  id: string | null;
  type: 'source' | 'target';
};

/**
 * Every option `new FlowStore(options)` and `store.setOptions(options)` accept. Mirrors the
 * option fields of `FlowState`; see spec/03 §State for defaults.
 */
export interface FlowOptions<N extends Node = Node, E extends Edge = Edge> {
  /** Initial nodes (constructor) or replacement nodes (`setOptions`, uncontrolled only). */
  nodes?: N[];
  /** Initial edges (constructor) or replacement edges (`setOptions`, uncontrolled only). */
  edges?: E[];
  /** Constructor only: queue an initial `fitView`. */
  fitView?: boolean;
  /** Options used by the initial and queued `fitView`. */
  fitViewOptions?: FitViewOptions<N>;
  /** Constructor only: initial wrapper width, lets the initial transform be fitted without DOM. */
  width?: number;
  /** Constructor only: initial wrapper height. */
  height?: number;
  /** `id` of the flow; used in marker ids. */
  flowId?: string;
  /** Minimum zoom. */
  minZoom?: number;
  /** Maximum zoom. */
  maxZoom?: number;
  /** Bounds of the pannable area. */
  translateExtent?: CoordinateExtent;
  /** Bounds nodes may be moved within. */
  nodeExtent?: CoordinateExtent;
  /** Anchor of a node's `position`: `[0, 0]` top-left, `[0.5, 0.5]` centre. */
  nodeOrigin?: NodeOrigin;
  /** Pixels a node must move before dragging starts. */
  nodeDragThreshold?: number;
  /** Pixels a connection drag must move before it starts. */
  connectionDragThreshold?: number;
  /** Whether nodes can be dragged by default. */
  nodesDraggable?: boolean;
  /** Whether nodes can be connected by default. */
  nodesConnectable?: boolean;
  /** Whether nodes can receive focus by default. */
  nodesFocusable?: boolean;
  /** Whether edges can receive focus by default. */
  edgesFocusable?: boolean;
  /** Whether nodes and edges can be selected by default. */
  elementsSelectable?: boolean;
  /** Whether edge ends can be dragged to reconnect (XY Lit default false). */
  edgesReconnectable?: boolean;
  /** Radius around a reconnect anchor in which a handle snaps. */
  reconnectRadius?: number;
  /** Raise selected nodes above the others. */
  elevateNodesOnSelect?: boolean;
  /** Raise selected edges above the others. */
  elevateEdgesOnSelect?: boolean;
  /** Select a node when a drag starts on it. */
  selectNodesOnDrag?: boolean;
  /** Pan the viewport to a focused node. */
  autoPanOnNodeFocus?: boolean;
  /** Pan the viewport while dragging a node near the edge. */
  autoPanOnNodeDrag?: boolean;
  /** Pan the viewport while dragging a connection near the edge. */
  autoPanOnConnect?: boolean;
  /** Pan the viewport while drawing a selection near the edge. */
  autoPanOnSelection?: boolean;
  /** Auto-pan speed. */
  autoPanSpeed?: number;
  /** Snap dragged nodes to the grid. */
  snapToGrid?: boolean;
  /** Grid size `[x, y]`. Setting it also enables `snapToGrid` unless given explicitly. */
  snapGrid?: SnapGrid;
  /** `full` or `partial` selection by rectangle. */
  selectionMode?: SelectionMode;
  /** `strict` connects source to target only; `loose` any handle to any handle. */
  connectionMode?: ConnectionMode;
  /** Radius around a handle in which a connection snaps. */
  connectionRadius?: number;
  /** Allow click-to-connect. */
  connectOnClick?: boolean;
  /** Defaults merged into every edge. */
  defaultEdgeOptions?: DefaultEdgeOptions;
  /** Colour of upstream markers that give none. `null` = `currentColor`-style default. */
  defaultMarkerColor?: string | null;
  /** Parallel edge handling. */
  parallelEdges?: ParallelEdges;
  /** Gap in px between spread parallel edges. */
  parallelEdgeGap?: number;
  /** Render only nodes and edges inside the viewport. */
  onlyRenderVisibleElements?: boolean;
  /** z-index strategy. */
  zIndexMode?: ZIndexMode;
  /** Class that stops dragging from starting on an element. */
  noDragClassName?: string;
  /** Class that stops wheel zoom/pan on an element. */
  noWheelClassName?: string;
  /** Class that stops panning from starting on an element. */
  noPanClassName?: string;
  /** Partial overrides of the ARIA label strings. */
  ariaLabelConfig?: Partial<AriaLabelConfig>;
  /** Disable keyboard interaction with nodes and edges. */
  disableKeyboardA11y?: boolean;
  /** Connection validator. */
  isValidConnection?: IsValidConnection<E>;
  /** Called before elements are deleted. */
  onBeforeDelete?: OnBeforeDelete<N, E>;
  /** Called before a connection becomes an edge. */
  onBeforeConnect?: OnBeforeConnect<E>;
  /** Called before an edge is reconnected. */
  onBeforeReconnect?: OnBeforeReconnect<E>;
  /** Edge id generator. */
  getEdgeId?: GetEdgeId;
  /** Log every change batch to the console. */
  debug?: boolean;
}
