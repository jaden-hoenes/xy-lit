/**
 * `@xy-lit/store`: the framework-free state container behind XY Lit flows, a port of React
 * Flow's zustand store plus the change pipeline, data sources and instance API.
 *
 * @packageDocumentation
 */

// store ------------------------------------------------------------------------------------------
export { FlowStore } from './flow-store.js';
export type { FlowHost, NodeChangeMiddleware, EdgeChangeMiddleware } from './flow-store.js';
export { createInitialState } from './state.js';
export type { FlowState, FitViewResolver, ActiveGesture } from './state.js';
export { ArraySource } from './sources/array-source.js';
export { createFlowInstance, getStoreOf } from './instance.js';
export { SetQueue, foldQueue } from './batch.js';
export type { QueueItem } from './batch.js';

// changes ----------------------------------------------------------------------------------------
export {
  applyNodeChanges,
  applyEdgeChanges,
  createSelectionChange,
  getSelectionChanges,
  getElementsDiffChanges,
  elementToRemoveChange,
} from './changes.js';

// visible elements, markers, placement, labels ------------------------------------------------------
export { getLayoutedEdges, getNodesInViewport } from './visible.js';
export type { EdgeLayoutOptions, EdgeLayoutResult, CullingViewport } from './visible.js';
export { assignParallelOffsets } from './edges/parallel.js';
export type { ParallelEdgeEnds } from './edges/parallel.js';
export { createMarkerDefs, getMarkerUrl, getCustomMarkerId, resolveMarkerId } from './markers.js';
export {
  NodeSpatialIndex,
  findFreePosition,
  findFreeRect,
  topLeftToPosition,
} from './placement.js';
export type { FindFreeInternals } from './placement.js';
export { getEdgeEndLabelPosition } from './edges/end-labels.js';
export { getSelected, sameSelection } from './selection.js';
export type { Selectable } from './selection.js';

// keyboard ---------------------------------------------------------------------------------------
export { parseKeyCode, PressedKeys, KeyCodeWatcher } from './keyboard/key-code.js';
export type { KeyEventLike, KeyCodeWatcherOptions } from './keyboard/key-code.js';
export { keyboardTracker } from './keyboard/key-tracker.js';
export type { KeyboardTracker } from './keyboard/key-tracker.js';

// helpers and constants ----------------------------------------------------------------------------
export {
  isNode,
  isEdge,
  addEdge,
  reconnectEdge,
  getIncomers,
  getOutgoers,
  getConnectedEdges,
  arrowKeyDiffs,
  shallow,
  toPx,
  createId,
} from './utils.js';
export { devWarn, isDev } from './dev.js';
export {
  LIB,
  LIB_NAME,
  DOCS_URL,
  ARIA_NODE_DESC_KEY,
  ARIA_EDGE_DESC_KEY,
  ARIA_LIVE_MESSAGE,
  DEFAULT_NODE_SIZE,
  DEFAULT_FIT_VIEW_TIMEOUT,
  DEFAULTS,
} from './constants.js';

// engine values users need -------------------------------------------------------------------------
export {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  getBezierEdgeCenter,
  getEdgeCenter,
  getViewportForBounds,
  getNodesBounds,
  Position,
  MarkerType,
  ConnectionMode,
  ConnectionLineType,
  PanOnScrollMode,
  SelectionMode,
  ResizeControlVariant,
} from './engine.js';

// types --------------------------------------------------------------------------------------------
export type * from './types/index.js';
export type {
  NodeBase,
  InternalNodeBase,
  EdgeBase,
  EdgePosition,
  Connection,
  ConnectionState,
  ConnectionInProgress,
  NoConnection,
  FinalConnectionState,
  Handle,
  HandleType,
  HandleConnection,
  NodeConnection,
  NodeHandle,
  NodeHandleBounds,
  NodeLookup,
  ParentLookup,
  ConnectionLookup,
  InternalNodeUpdate,
  NodeDragItem,
  ParentExpandChild,
  Transform,
  Viewport,
  XYPosition,
  XYZPosition,
  Rect,
  Box,
  Dimensions,
  CoordinateExtent,
  NodeOrigin,
  SnapGrid,
  Padding,
  PanZoomInstance,
  PanZoomParams,
  PanZoomUpdateOptions,
  XYDragInstance,
  XYMinimapInstance,
  XYResizerInstance,
  XYResizerChange,
  XYResizerChildChange,
  ControlPosition,
  ControlLinePosition,
  ResizeDragEvent,
  ShouldResize,
  OnResizeStart,
  OnResize,
  OnResizeEnd,
  AriaLabelConfig,
  ZIndexMode,
  SelectionRect,
  ViewportHelperFunctionOptions,
  SetCenterOptions,
  FitBoundsOptions,
  FitViewOptionsBase,
  MarkerProps,
  EdgeMarker,
  EdgeMarkerType,
  BezierPathOptions,
  SmoothStepPathOptions,
  StepPathOptions,
  OnError,
  PanBy,
  UpdateConnection,
  UpdateNodePositions,
  OnBeforeDeleteBase,
  OnConnectStartParams,
  OnMove,
  OnMoveStart,
  OnMoveEnd,
  OnViewportChange,
  AddEdgeOptions,
  ReconnectEdgeOptions,
  Align,
} from './engine.js';
