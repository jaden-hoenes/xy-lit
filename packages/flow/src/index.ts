/**
 * `@xy-lit/flow`: Lit web components for node-based editors, built on `@xyflow/system`.
 *
 * Importing this module does not register any element; import `@xy-lit/flow/define.js` for that.
 *
 * @packageDocumentation
 */

// elements ---------------------------------------------------------------------------------------
export { XyFlowElement } from './elements/xy-flow.js';
export { XyFlowProviderElement } from './elements/xy-flow-provider.js';
export { XyNodeElement } from './elements/xy-node.js';
export { XyHandleElement } from './elements/xy-handle.js';
export { XyEdgeElement } from './elements/xy-edge.js';

// plugins ----------------------------------------------------------------------------------------
export { FlowPluginElement, positionClasses } from './plugins/plugin-base.js';
export { XyPanelElement } from './plugins/xy-panel.js';
export { XyBackgroundElement } from './plugins/xy-background.js';
export type { BackgroundVariant } from './plugins/xy-background.js';
export { XyControlsElement } from './plugins/xy-controls.js';
export { XyControlButtonElement } from './plugins/xy-control-button.js';
export { XyMinimapElement, defaultMiniMapNode } from './plugins/xy-minimap.js';
export type {
  MiniMapNodeAttribute,
  MiniMapNodeProps,
  MiniMapNodeRenderer,
} from './plugins/xy-minimap.js';
export { XyResizeControlElement } from './plugins/xy-resize-control.js';
export type { ResizeControlVariant } from './plugins/xy-resize-control.js';
export { XyNodeResizerElement } from './plugins/xy-node-resizer.js';
export type { NodeResizerVariant } from './plugins/xy-node-resizer.js';
export { XyViewportPortalElement } from './plugins/xy-viewport-portal.js';

// contexts and controllers -----------------------------------------------------------------------
export { flowContext, nodeIdContext, nodeConnectableContext, edgeIdContext } from './context.js';
export type { FlowContextValue, FlowProvider } from './context.js';
export { StoreController } from './controllers/store-controller.js';
export type { StoreControllerOptions } from './controllers/store-controller.js';
export {
  ConnectionController,
  EdgesController,
  FlowInstanceController,
  InternalNodeController,
  NodeIdController,
  NodesController,
  NodesDataController,
  NodesInitializedController,
  StoreApiController,
  ViewportController,
} from './controllers/flow-controllers.js';
export type { ControllerHost, ControllerStoreOption } from './controllers/flow-controllers.js';
export {
  HandleConnectionsController,
  NodeConnectionsController,
} from './controllers/connections.js';
export type {
  HandleConnectionsOptions,
  NodeConnectionsOptions,
} from './controllers/connections.js';
export { OnSelectionChangeController, OnViewportChangeController } from './controllers/events.js';
export type { ViewportChangeCallbacks } from './controllers/events.js';
export { KeyPressController } from './controllers/key-press.js';
export type { KeyPressOptions } from './controllers/key-press.js';
export { ConnectionHub } from './elements/xy-flow/connection-hub.js';
export type { ConnectionHubState } from './elements/xy-flow/connection-hub.js';
export { MeasureController } from './elements/xy-flow/measure.js';
export { PanZoomController } from './elements/xy-flow/panzoom.js';
export { PaneController } from './elements/xy-flow/pane.js';
export type { PaneInteraction } from './elements/xy-flow/pane.js';
export { FlowKeysController } from './elements/xy-flow/keys.js';
export { RenderCompleteController } from './elements/xy-flow/render-complete.js';
export { ContainerSizeController } from './elements/xy-flow/container-size.js';
export {
  booleanAttr,
  numberAttr,
  numberPairAttr,
  panOnDragAttr,
  numberOrPairAttr,
  keyCodeAttr,
  enumAttr,
} from './elements/xy-flow/attributes.js';

// nodes ------------------------------------------------------------------------------------------
export { defineNodeType } from './nodes/define-node-type.js';
export type {
  NodeRenderer,
  NodeTypeDefinition,
  NodeTypeEntry,
  NodeTypes,
} from './nodes/define-node-type.js';
export { FlowNodeElement } from './nodes/flow-node-element.js';
export {
  defaultNode,
  inputNode,
  outputNode,
  groupNode,
  builtinNodeTypes,
} from './nodes/builtin.js';
export { nodeToolbar, activeToolbars } from './nodes/node-toolbar.js';
export type { NodeToolbarOptions, ToolbarEntry, ActiveToolbar } from './nodes/node-toolbar.js';
export { createDragStoreItems, handleNodeClick } from './drag.js';

// edges ------------------------------------------------------------------------------------------
export { defineEdgeType } from './edges/define-edge-type.js';
export type {
  EdgeRenderResult,
  EdgeRenderer,
  EdgeTypeDefinition,
  EdgeTypes,
} from './edges/define-edge-type.js';
export { baseEdge } from './edges/base-edge.js';
export type { BaseEdgeOptions } from './edges/base-edge.js';
export { edgeLabel, edgeText } from './edges/edge-text.js';
export type { EdgeLabelOptions } from './edges/edge-text.js';
export {
  bezierEdge,
  simpleBezierEdge,
  straightEdge,
  stepEdge,
  smoothStepEdge,
  builtinEdgeTypes,
} from './edges/builtin.js';
export {
  edgeNormal,
  getOffsetBezierPath,
  getOffsetStraightPath,
  offsetStepPosition,
} from './edges/offset-bezier.js';
export type { EdgeEnds } from './edges/offset-bezier.js';
export { getSimpleBezierPath } from './edges/simple-bezier.js';
export type { GetSimpleBezierPathParams } from './edges/simple-bezier.js';
export { edgeToolbar } from './edges/edge-toolbar.js';
export type { EdgeToolbarOptions } from './edges/edge-toolbar.js';
export { markerDefs } from './edges/markers.js';
export { reconnectAnchors, startReconnect } from './edges/reconnect-anchors.js';
export type {
  EdgeEnd,
  ReconnectAnchorsOptions,
  StartReconnectOptions,
} from './edges/reconnect-anchors.js';
export { connectionLine, getConnectionPath } from './connection-line.js';
export type {
  ConnectionLineOptions,
  ConnectionLineProps,
  ConnectionLineRenderer,
} from './connection-line.js';

// styles and types -------------------------------------------------------------------------------
export { adoptInto, baseSheets, defaultSheets, sheetOf } from './styles/sheets.js';
export { MOTION_OFF } from './types.js';
export type { EdgeRenderContext, LabelEntry, MotionState, NodeRenderContext } from './types.js';

// the store API, so applications need one import ----------------------------------------------------
export * from '@xy-lit/store';
