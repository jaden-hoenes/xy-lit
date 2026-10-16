import { ConnectionMode, SelectionMode, infiniteExtent, getEdgeId } from './engine.js';
import type { Dimensions, NodeOrigin, SnapGrid, ZIndexMode } from './engine.js';

/** Engine `lib` value. Produces the `lit-flow__*` class names the conformance suite expects. */
export const LIB = 'lit';
/** Human readable library name, used as the dev-warning prefix. */
export const LIB_NAME = 'XY Lit';
/** Documentation site, used in dev-warning help links. */
export const DOCS_URL = 'https://jaden-hoenes.github.io/xy-lit';
/** Id of the visually hidden node description element. */
export const ARIA_NODE_DESC_KEY = 'lit-flow__node-desc';
/** Id of the visually hidden edge description element. */
export const ARIA_EDGE_DESC_KEY = 'lit-flow__edge-desc';
/** Id of the aria-live region. */
export const ARIA_LIVE_MESSAGE = 'lit-flow__aria-live';
/** Size assumed for nodes without dimensions when placing new nodes. Placement fallback only. */
export const DEFAULT_NODE_SIZE: Readonly<Dimensions> = { width: 150, height: 40 };

/** Delay after which a queued `fitView` fits whatever is measured. Milliseconds. */
export const DEFAULT_FIT_VIEW_TIMEOUT = 400;

/** Default of every option (spec/03 §State). Applied by `createInitialState`. */
export const DEFAULTS = {
  flowId: '1',
  minZoom: 0.5,
  maxZoom: 2,
  translateExtent: infiniteExtent,
  nodeExtent: infiniteExtent,
  nodeOrigin: [0, 0] as NodeOrigin,
  nodeDragThreshold: 1,
  connectionDragThreshold: 1,
  nodesDraggable: true,
  nodesConnectable: true,
  nodesFocusable: true,
  edgesFocusable: true,
  elementsSelectable: true,
  edgesReconnectable: false,
  reconnectRadius: 10,
  elevateNodesOnSelect: true,
  elevateEdgesOnSelect: false,
  selectNodesOnDrag: true,
  autoPanOnNodeFocus: true,
  autoPanOnNodeDrag: true,
  autoPanOnConnect: true,
  autoPanOnSelection: true,
  autoPanSpeed: 15,
  snapToGrid: false,
  snapGrid: [15, 15] as SnapGrid,
  selectionMode: SelectionMode.Full,
  connectionMode: ConnectionMode.Strict,
  connectionRadius: 20,
  connectOnClick: true,
  defaultMarkerColor: '#b1b1b7' as string | null,
  parallelEdges: 'off' as 'off' | 'spread',
  parallelEdgeGap: 12,
  onlyRenderVisibleElements: false,
  zIndexMode: 'basic' as ZIndexMode,
  noDragClassName: 'nodrag',
  noWheelClassName: 'nowheel',
  noPanClassName: 'nopan',
  disableKeyboardA11y: false,
  debug: false,
  getEdgeId,
} as const;
