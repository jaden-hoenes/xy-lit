// Ported from xyflow (MIT) packages/react/src/store/initialState.ts@3d35b57
import { DEFAULTS } from './constants.js';
import { initialConnection, mergeAriaLabelConfig } from './engine.js';
import type {
  AriaLabelConfig,
  ConnectionLookup,
  ConnectionMode,
  ConnectionState,
  CoordinateExtent,
  NodeLookup,
  NodeOrigin,
  PanZoomInstance,
  ParentLookup,
  SelectionMode,
  SelectionRect,
  SnapGrid,
  Transform,
  XYPosition,
  ZIndexMode,
} from './engine.js';
import type { DefaultEdgeOptions, Edge, EdgeLookup } from './types/edges.js';
import type { InternalNode, Node } from './types/nodes.js';
import type {
  ConnectionClickStartHandle,
  FitViewOptions,
  GetEdgeId,
  IsValidConnection,
  OnBeforeConnect,
  OnBeforeDelete,
  OnBeforeReconnect,
  ParallelEdges,
  FlowOptions,
} from './types/options.js';

/** A promise with its resolvers, as used for the pending `fitView` result. */
export type FitViewResolver = {
  promise: Promise<boolean>;
  resolve: (value: boolean | PromiseLike<boolean>) => void;
  reject: (reason?: unknown) => void;
};

/** The gesture currently in progress, used to infer change phases and group history. */
export type ActiveGesture = { kind: 'drag' | 'resize'; id: string };

/**
 * All state of a flow. Fields marked "option" are settable through `store.setOptions()`.
 * See spec/03 §State for defaults and the React field each one ports from.
 */
export interface FlowState<N extends Node = Node, E extends Edge = Edge> {
  /** `id` of the flow (React `rfId`). Option. */
  flowId: string;
  /** Mirror of the source's nodes. */
  nodes: N[];
  /** Mirror of the source's edges. */
  edges: E[];
  /** Engine-owned node lookup, mutated in place. */
  nodeLookup: NodeLookup<InternalNode<N>>;
  /** Engine-owned parent to children lookup, mutated in place. */
  parentLookup: ParentLookup<InternalNode<N>>;
  /** Edge id to edge, mutated in place. */
  edgeLookup: EdgeLookup<E>;
  /** Connections per node/handle, mutated in place. */
  connectionLookup: ConnectionLookup;
  /** True once every node has dimensions (from `adoptUserNodes`). */
  nodesInitialized: boolean;
  /** True when at least one node is selected (from `adoptUserNodes`). */
  hasSelectedNodes: boolean;
  /** Incremented whenever `nodeLookup` content changes (memo key). */
  lookupVersion: number;
  /** Incremented when node or edge id sets change, or a source is attached. */
  structureRevision: number;
  /** The `.lit-flow` wrapper inside the render root. */
  domNode: HTMLDivElement | null;
  /** Wrapper client width. */
  width: number;
  /** Wrapper client height. */
  height: number;
  /** Viewport transform `[x, y, zoom]`. */
  transform: Transform;
  /** The attached pan/zoom engine. */
  panZoom: PanZoomInstance | null;
  /** Option. */
  minZoom: number;
  /** Option. */
  maxZoom: number;
  /** Option. */
  translateExtent: CoordinateExtent;
  /** Option. */
  nodeExtent: CoordinateExtent;
  /** Option. */
  nodeOrigin: NodeOrigin;
  /** Option. */
  nodeDragThreshold: number;
  /** Option. */
  connectionDragThreshold: number;
  /** Whether the pane is being dragged (XYPanZoom `onDraggingChange`). */
  paneDragging: boolean;
  /** Option. */
  nodesDraggable: boolean;
  /** Option. */
  nodesConnectable: boolean;
  /** Option. */
  nodesFocusable: boolean;
  /** Option. */
  edgesFocusable: boolean;
  /** Option. */
  elementsSelectable: boolean;
  /** Option (XY Lit default false). */
  edgesReconnectable: boolean;
  /** Option. */
  reconnectRadius: number;
  /** Option. */
  elevateNodesOnSelect: boolean;
  /** Option. */
  elevateEdgesOnSelect: boolean;
  /** Option. */
  selectNodesOnDrag: boolean;
  /** Option. */
  autoPanOnNodeFocus: boolean;
  /** Option. */
  autoPanOnNodeDrag: boolean;
  /** Option. */
  autoPanOnConnect: boolean;
  /** Option. */
  autoPanOnSelection: boolean;
  /** Option. */
  autoPanSpeed: number;
  /** Option. */
  snapToGrid: boolean;
  /** Option. */
  snapGrid: SnapGrid;
  /** Whether the selected-nodes box is visible. */
  nodesSelectionActive: boolean;
  /** Whether a selection rectangle is being drawn. */
  userSelectionActive: boolean;
  /** The rectangle being drawn. */
  userSelectionRect: SelectionRect | null;
  /** Option. */
  selectionMode: SelectionMode;
  /** Multi-selection key state (from the keyboard tracker). */
  multiSelectionActive: boolean;
  /** Selection key state. */
  selectionKeyPressed: boolean;
  /** Pan activation key state. */
  panActivationKeyPressed: boolean;
  /** Zoom activation key state. */
  zoomActivationKeyPressed: boolean;
  /** The connection in progress (screen to flow conversion is done by XYHandle). */
  connection: ConnectionState<InternalNode<N>>;
  /** Option. */
  connectionMode: ConnectionMode;
  /** Option. */
  connectionRadius: number;
  /** Start handle of a click-to-connect interaction. */
  connectionClickStartHandle: ConnectionClickStartHandle | null;
  /** Option. */
  connectOnClick: boolean;
  /** Option. */
  defaultEdgeOptions: DefaultEdgeOptions | undefined;
  /** Option. */
  defaultMarkerColor: string | null;
  /** Option (XY Lit). */
  parallelEdges: ParallelEdges;
  /** Option (XY Lit). */
  parallelEdgeGap: number;
  /** Option. */
  onlyRenderVisibleElements: boolean;
  /** Option. */
  zIndexMode: ZIndexMode;
  /** Option. */
  noDragClassName: string;
  /** Option. */
  noWheelClassName: string;
  /** Option. */
  noPanClassName: string;
  /** A `fitView` is waiting for measurement / pan-zoom. */
  fitViewQueued: boolean;
  /** Options of the queued `fitView`. */
  fitViewOptions: FitViewOptions<N> | undefined;
  /** Resolver of the promise returned by the pending `fitView`. */
  fitViewResolver: FitViewResolver | null;
  /** Option (merged with the defaults). */
  ariaLabelConfig: AriaLabelConfig;
  /** Text of the aria-live region. */
  ariaLiveMessage: string;
  /** Option. */
  disableKeyboardA11y: boolean;
  /** Option. */
  isValidConnection: IsValidConnection<E> | undefined;
  /** Option. */
  onBeforeDelete: OnBeforeDelete<N, E> | undefined;
  /** Option. */
  onBeforeConnect: OnBeforeConnect<E> | undefined;
  /** Option. */
  onBeforeReconnect: OnBeforeReconnect<E> | undefined;
  /** Option. */
  getEdgeId: GetEdgeId;
  /** Gesture in progress (phase tracking). */
  activeGesture: ActiveGesture | null;
  /** Last pointer position over the pane, in flow coordinates. */
  lastPointerFlowPosition: XYPosition | null;
  /** Option: log every change batch. */
  debug: boolean;
}

/** `FlowOptions` keys that are not state fields of the same name. */
const NON_STATE_OPTIONS: ReadonlySet<string> = new Set([
  'nodes',
  'edges',
  'fitView',
  'ariaLabelConfig',
]);

/**
 * Create the initial state: `DEFAULTS` merged with the option fields in `options`. The element
 * data (`nodes`, `edges`, lookups, `fitViewQueued`, initial transform) is handled by the
 * `FlowStore` constructor, which runs it through the same code paths as later updates.
 *
 * @param options - Option fields to override. Unset and `undefined` fields keep their default.
 */
export function createInitialState<N extends Node = Node, E extends Edge = Edge>(
  options: Partial<FlowOptions<N, E>> = {},
): FlowState<N, E> {
  const optionState = Object.fromEntries(
    Object.entries(options).filter(
      ([key, value]) => value !== undefined && !NON_STATE_OPTIONS.has(key),
    ),
  ) as Partial<FlowState<N, E>>;
  return {
    ...DEFAULTS,
    nodes: [],
    edges: [],
    nodeLookup: new Map(),
    parentLookup: new Map(),
    edgeLookup: new Map(),
    connectionLookup: new Map(),
    nodesInitialized: false,
    hasSelectedNodes: false,
    lookupVersion: 0,
    structureRevision: 0,
    domNode: null,
    width: 0,
    height: 0,
    transform: [0, 0, 1],
    panZoom: null,
    paneDragging: false,
    nodesSelectionActive: false,
    userSelectionActive: false,
    userSelectionRect: null,
    multiSelectionActive: false,
    selectionKeyPressed: false,
    panActivationKeyPressed: false,
    zoomActivationKeyPressed: false,
    connection: { ...initialConnection },
    connectionClickStartHandle: null,
    defaultEdgeOptions: undefined,
    fitViewQueued: false,
    fitViewOptions: undefined,
    fitViewResolver: null,
    ariaLiveMessage: '',
    isValidConnection: undefined,
    onBeforeDelete: undefined,
    onBeforeConnect: undefined,
    onBeforeReconnect: undefined,
    activeGesture: null,
    lastPointerFlowPosition: null,
    ...optionState,
    ariaLabelConfig: mergeAriaLabelConfig(options.ariaLabelConfig),
  };
}
