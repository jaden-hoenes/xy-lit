import { ContextProvider } from '@lit/context';
import { LitElement, html, nothing } from 'lit';
import type { CSSResult, CSSResultGroup, PropertyValues, TemplateResult } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import {
  ArraySource,
  ConnectionLineType,
  ConnectionMode,
  DEFAULTS,
  FlowStore,
  PanOnScrollMode,
  SelectionMode,
  addEdge,
  keyboardTracker,
  shallow,
} from '@xy-lit/store';
import { errorMessages, infiniteExtent } from '@xy-lit/store/internal';
import type {
  AriaLabelConfig,
  Connection,
  CoordinateExtent,
  DefaultEdgeOptions,
  Edge,
  EdgeLayouted,
  FitViewOptions,
  FlowDataSource,
  FlowEventMap,
  FlowHost,
  FlowInstance,
  FlowOptions,
  GetEdgeId,
  InternalNode,
  IsValidConnection,
  KeyCode,
  MarkerDef,
  MotionMode,
  Node,
  NodeOrigin,
  OnBeforeConnect,
  OnBeforeDelete,
  OnBeforeReconnect,
  PanelPosition,
  ParallelEdges,
  RenderRoot,
  SnapGrid,
  Viewport,
  WheelScrollDetection,
  ZIndexMode,
  ColorMode,
  ConnectionState,
  SelectionRect,
} from '@xy-lit/store';
import { StoreController } from '../controllers/store-controller.js';
import { FlowContextRequestEvent, flowContext } from '../context.js';
import type { FlowContextValue, FlowProvider } from '../context.js';
import type { ConnectionLineRenderer } from '../connection-line.js';
import { builtinEdgeTypes } from '../edges/builtin.js';
import type { EdgeTypes } from '../edges/define-edge-type.js';
import { builtinNodeTypes } from '../nodes/builtin.js';
import type { NodeTypes } from '../nodes/define-node-type.js';
import type { ToolbarEntry } from '../nodes/node-toolbar.js';
import { adoptInto, baseSheets, defaultSheets, sheetOf } from '../styles/sheets.js';
import type { EdgeRenderContext, LabelEntry, NodeRenderContext } from '../types.js';
import {
  booleanAttr,
  enumAttr,
  keyCodeAttr,
  numberAttr,
  numberPairAttr,
  panOnDragAttr,
} from './xy-flow/attributes.js';
import { ConnectionHub } from './xy-flow/connection-hub.js';
import { ContainerSizeController } from './xy-flow/container-size.js';
import { FlowKeysController } from './xy-flow/keys.js';
import { LightSlotProjector } from './xy-flow/light-slots.js';
import { MeasureController } from './xy-flow/measure.js';
import { MotionController } from './xy-flow/motion.js';
import { PanZoomController } from './xy-flow/panzoom.js';
import { PaneController } from './xy-flow/pane.js';
import { RenderCompleteController } from './xy-flow/render-complete.js';
import { attachWheelDetection } from './xy-flow/wheel.js';
import {
  a11yDescriptions,
  attribution,
  connectionLineLayer,
  edgeLabelLayer,
  edgesLayer,
  loadingOverlay,
  nodeToolbarLayer,
  nodesLayer,
  nodesSelection,
  slotFor,
  userSelectionRect,
} from './xy-flow/templates.js';

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform);
const SELECTION_MODES = [SelectionMode.Full, SelectionMode.Partial] as const;
const CONNECTION_MODES = [ConnectionMode.Strict, ConnectionMode.Loose] as const;
const LINE_TYPES = Object.values(ConnectionLineType);
const SCROLL_MODES = Object.values(PanOnScrollMode);

/** Element properties that map 1:1 onto `FlowOptions` fields of the store. */
const STORE_OPTION_KEYS = [
  'flowId',
  'minZoom',
  'maxZoom',
  'translateExtent',
  'nodeExtent',
  'nodeOrigin',
  'nodeDragThreshold',
  'connectionDragThreshold',
  'nodesDraggable',
  'nodesConnectable',
  'nodesFocusable',
  'edgesFocusable',
  'elementsSelectable',
  'edgesReconnectable',
  'reconnectRadius',
  'elevateNodesOnSelect',
  'elevateEdgesOnSelect',
  'selectNodesOnDrag',
  'autoPanOnNodeFocus',
  'autoPanOnNodeDrag',
  'autoPanOnConnect',
  'autoPanOnSelection',
  'autoPanSpeed',
  'snapToGrid',
  'snapGrid',
  'selectionMode',
  'connectionMode',
  'connectionRadius',
  'connectOnClick',
  'defaultEdgeOptions',
  'defaultMarkerColor',
  'parallelEdges',
  'parallelEdgeGap',
  'onlyRenderVisibleElements',
  'zIndexMode',
  'noDragClassName',
  'noWheelClassName',
  'noPanClassName',
  'ariaLabelConfig',
  'disableKeyboardA11y',
  'isValidConnection',
  'onBeforeDelete',
  'onBeforeConnect',
  'onBeforeReconnect',
  'getEdgeId',
  'debug',
  'fitViewOptions',
] as const;

/** Properties that feed `FlowKeysController`. */
const KEY_PROPS = [
  'deleteKey',
  'selectionKey',
  'multiSelectionKey',
  'panActivationKey',
  'zoomActivationKey',
  'historyKeys',
] as const;

/** Properties that need `PanZoomController.update()` (it re-reads them from the host). */
const PANZOOM_PROPS = [
  'panOnDrag',
  'panOnScroll',
  'panOnScrollSpeed',
  'panOnScrollMode',
  'zoomOnScroll',
  'zoomOnPinch',
  'zoomOnDoubleClick',
  'preventScrolling',
  'paneClickDistance',
  'selectionOnDrag',
] as const;

let lightFlowCounter = 0;

const resetScroll = (e: Event): void => {
  (e.currentTarget as HTMLElement).scrollTo({ top: 0, left: 0 });
};

/**
 * The flow element: owns (or borrows) a `FlowStore`, provides it through `flowContext`, renders
 * every layer (edges, edge labels, connection line, nodes, selection, toolbars, accessibility,
 * attribution, loading overlay) and wires the engine (pan/zoom, measuring, container size).
 *
 * Nodes, handles and edges render into the light DOM of their parent elements, i.e. into this
 * element's single shadow root (or the document with `render-root="light"`).
 *
 * @slot - Plugins: `<xy-background>`, `<xy-controls>`, `<xy-minimap>`, `<xy-panel>`.
 * @slot viewport-back - Content in flow coordinates, behind edges and nodes.
 * @slot viewport-front - Content in flow coordinates, in front of nodes.
 * @slot loading - Replaces the spinner of the loading overlay.
 * @csspart pane - The pane element.
 * @csspart viewport - The transformed viewport element.
 * @csspart node - Every `<xy-node>`.
 * @csspart edge - Every edge `<g>`.
 * @csspart edge-svg - Every edge `<svg>`.
 * @csspart handle - Every `<xy-handle>`.
 * @csspart loading - The loading overlay.
 * @fires init - The flow is ready; the instance can be used. `detail` is `{ instance: FlowInstance }`.
 * @fires nodes-change - Node changes about to be applied. Cancelable: the app then owns state. `detail` is `{ changes: NodeChange[]; meta: ChangeMeta }`.
 * @fires edges-change - Edge changes about to be applied. Cancelable: the app then owns state. `detail` is `{ changes: EdgeChange[]; meta: ChangeMeta }`.
 * @fires connect - A connection was completed. Cancelable; the default action adds `edge`. `detail` is `{ connection: Connection; edge: Edge }`.
 * @fires connect-start - A connection drag started. `detail` is `{ event: MouseEvent | TouchEvent; nodeId: string | null; handleId: string | null; handleType: HandleType | null; }`.
 * @fires connect-end - A connection drag ended. `detail` is `{ event: MouseEvent | TouchEvent; connectionState: FinalConnectionState<InternalNode>; }`.
 * @fires click-connect-start - Click-to-connect started. `detail` is the same as for `connect-start`.
 * @fires click-connect-end - Click-to-connect ended. `detail` is the same as for `connect-end`.
 * @fires reconnect - An edge was reconnected. Cancelable; the default action replaces the edge. `detail` is `{ oldEdge: Edge; newConnection: Connection; edge: Edge }`.
 * @fires reconnect-start - An edge end drag started. `detail` is `{ event: MouseEvent | TouchEvent; edge: Edge; handleType: HandleType }`.
 * @fires reconnect-end - An edge end drag ended. `detail` is `{ event: MouseEvent | TouchEvent; edge: Edge; handleType: HandleType; connectionState: FinalConnectionState<InternalNode>; }`.
 * @fires node-click - A node was clicked. `detail` is `{ event: MouseEvent; node: Node }`.
 * @fires node-double-click - A node was double-clicked. `detail` is `{ event: MouseEvent; node: Node }`.
 * @fires node-context-menu - The context menu was requested on a node. `detail` is `{ event: MouseEvent; node: Node }`.
 * @fires node-pointer-enter - The pointer entered a node. `detail` is `{ event: PointerEvent; node: Node }`.
 * @fires node-pointer-move - The pointer moved over a node. `detail` is `{ event: PointerEvent; node: Node }`.
 * @fires node-pointer-leave - The pointer left a node. `detail` is `{ event: PointerEvent; node: Node }`.
 * @fires node-drag-start - A node drag started. `detail` is `{ event: MouseEvent; node: Node; nodes: Node[] }`.
 * @fires node-drag - A node is being dragged. `detail` is `{ event: MouseEvent; node: Node; nodes: Node[] }`.
 * @fires node-drag-stop - A node drag ended. `detail` is `{ event: MouseEvent; node: Node; nodes: Node[] }`.
 * @fires selection-drag-start - A selection drag started. `detail` is `{ event: MouseEvent; nodes: Node[] }`.
 * @fires selection-drag - A selection is being dragged. `detail` is `{ event: MouseEvent; nodes: Node[] }`.
 * @fires selection-drag-stop - A selection drag ended. `detail` is `{ event: MouseEvent; nodes: Node[] }`.
 * @fires selection-start - Drawing a selection rectangle started. `detail` is `{ event: PointerEvent }`.
 * @fires selection-end - Drawing a selection rectangle ended. `detail` is `{ event: PointerEvent }`.
 * @fires selection-click - The selected-nodes box was clicked. `detail` is `{ event: MouseEvent; nodes: Node[] }`.
 * @fires selection-context-menu - The context menu was requested on the selected-nodes box. `detail` is `{ event: MouseEvent; nodes: Node[] }`.
 * @fires selection-change - The set of selected nodes or edges changed. `detail` is `{ nodes: Node[]; edges: Edge[] }`.
 * @fires edge-click - An edge was clicked. `detail` is `{ event: MouseEvent; edge: Edge }`.
 * @fires edge-double-click - An edge was double-clicked. `detail` is `{ event: MouseEvent; edge: Edge }`.
 * @fires edge-context-menu - The context menu was requested on an edge. `detail` is `{ event: MouseEvent; edge: Edge }`.
 * @fires edge-pointer-enter - The pointer entered an edge. `detail` is `{ event: PointerEvent; edge: Edge }`.
 * @fires edge-pointer-move - The pointer moved over an edge. `detail` is `{ event: PointerEvent; edge: Edge }`.
 * @fires edge-pointer-leave - The pointer left an edge. `detail` is `{ event: PointerEvent; edge: Edge }`.
 * @fires pane-click - The pane was clicked. `detail` is `{ event: MouseEvent }`.
 * @fires pane-context-menu - The context menu was requested on the pane. `detail` is `{ event: MouseEvent }`.
 * @fires pane-scroll - The pane was scrolled. `detail` is `{ event: WheelEvent }`.
 * @fires pane-pointer-enter - The pointer entered the pane. `detail` is `{ event: PointerEvent }`.
 * @fires pane-pointer-move - The pointer moved over the pane. `detail` is `{ event: PointerEvent }`.
 * @fires pane-pointer-leave - The pointer left the pane. `detail` is `{ event: PointerEvent }`.
 * @fires move-start - A pan/zoom gesture started. `detail` is `{ event: MouseEvent | TouchEvent | null; viewport: Viewport }`.
 * @fires move - The viewport is moving. `detail` is `{ event: MouseEvent | TouchEvent | null; viewport: Viewport }`.
 * @fires move-end - A pan/zoom gesture ended. `detail` is `{ event: MouseEvent | TouchEvent | null; viewport: Viewport }`.
 * @fires viewport-change - The viewport changed. `detail` is `{ viewport: Viewport }`.
 * @fires delete - Elements were deleted. `detail` is `{ nodes: Node[]; edges: Edge[] }`.
 * @fires nodes-delete - Nodes are being deleted. `detail` is `{ nodes: Node[] }`.
 * @fires edges-delete - Edges are being deleted. `detail` is `{ edges: Edge[] }`.
 * @fires nodes-initialized - All nodes have been measured (fires once per false to true flip). `detail` is `{ nodes: Node[] }`.
 * @fires render-complete - The current revision has been fully rendered. `detail` is `{ revision: number; nodeCount: number; edgeCount: number; durationMs: number }`.
 * @fires flow-error - A recoverable error. Cancelable; the default action is `console.warn` in dev. `detail` is `{ code: string; message: string }`.
 * @cssprop --xy-background-color - Canvas background (default `transparent`, dark `#141414`).
 * @cssprop --xy-background-pattern-color - Colour of the `<xy-background>` pattern for every variant. The variant-specific `--xy-background-pattern-dots-color`, `-lines-color` and `-cross-color` default to `#91919a`, `#eee` and `#e2e2e2` (dark `#555`, `#333`, `#333`).
 * @cssprop --xy-node-color - Text colour of the built-in nodes (default `inherit`, dark `#f8f8f8`).
 * @cssprop --xy-node-border - Border of the built-in nodes (default `1px solid #1a192b`, dark `1px solid #3c3c3c`).
 * @cssprop --xy-node-background-color - Background of the built-in nodes (default `#fff`, dark `#1e1e1e`).
 * @cssprop --xy-node-group-background-color - Background of `group` nodes (default `rgba(240, 240, 240, 0.25)`).
 * @cssprop --xy-node-boxshadow-hover - Box shadow of a hovered built-in node.
 * @cssprop --xy-node-boxshadow-selected - Box shadow of a selected or focused built-in node.
 * @cssprop --xy-node-border-radius - Border radius of the built-in nodes (default `3px`).
 * @cssprop --xy-handle-background-color - Handle fill (default `#1a192b`, dark `#bebebe`).
 * @cssprop --xy-handle-border-color - Handle border colour (default `#fff`, dark `#1e1e1e`).
 * @cssprop --xy-edge-stroke - Edge stroke (default `#b1b1b7`, dark `#3e3e3e`).
 * @cssprop --xy-edge-stroke-width - Edge stroke width (default `1`).
 * @cssprop --xy-edge-stroke-selected - Stroke of a selected edge (default `#555`, dark `#727272`).
 * @cssprop --xy-edge-label-color - Colour of edge labels (default `inherit`).
 * @cssprop --xy-edge-label-background-color - Background of edge labels (default `#ffffff`, dark `#141414`).
 * @cssprop --xy-connectionline-stroke - Stroke of the connection line while connecting (default `#b1b1b7`).
 * @cssprop --xy-connectionline-stroke-width - Width of the connection line (default `1`).
 * @cssprop --xy-selection-background-color - Background of the selection rectangle and the selected-nodes box.
 * @cssprop --xy-selection-border - Border of the selection rectangle and the selected-nodes box.
 * @cssprop --xy-controls-button-background-color - `<xy-controls>` button background (default `#fefefe`).
 * @cssprop --xy-controls-button-background-color-hover - `<xy-controls>` button background on hover (default `#f4f4f4`).
 * @cssprop --xy-controls-button-color - `<xy-controls>` button icon colour.
 * @cssprop --xy-controls-button-color-hover - `<xy-controls>` button icon colour on hover.
 * @cssprop --xy-controls-button-border-color - `<xy-controls>` button border colour (default `#eee`).
 * @cssprop --xy-controls-box-shadow - Box shadow of the `<xy-controls>` panel.
 * @cssprop --xy-minimap-background-color - `<xy-minimap>` background (default `#fff`, dark `#141414`).
 * @cssprop --xy-minimap-mask-background-color - Colour of the area outside the viewport in the mini map.
 * @cssprop --xy-minimap-mask-stroke-color - Stroke of the mini map viewport mask (default `transparent`).
 * @cssprop --xy-minimap-mask-stroke-width - Stroke width of the mini map viewport mask (default `1`).
 * @cssprop --xy-minimap-node-background-color - Fill of mini map nodes (default `#e2e2e2`, dark `#2b2b2b`).
 * @cssprop --xy-minimap-node-stroke-color - Stroke of mini map nodes (default `transparent`).
 * @cssprop --xy-minimap-node-stroke-width - Stroke width of mini map nodes (default `2`).
 * @cssprop --xy-resize-background-color - Colour of `<xy-node-resizer>` handles and lines (default `#3367d9`).
 * @cssprop --xy-attribution-color - Colour of the attribution link (default `#5f5f5f`, dark `#b4b4b4`).
 * @cssprop --xy-attribution-background-color - Background of the attribution panel.
 * @cssprop --xy-loading-background - Background of the loading overlay (default the flow background).
 * @cssprop --xy-loading-color - Colour of the loading spinner (default `#555`).
 * @cssprop --xy-loading-track - Track colour of the loading spinner (default `rgba(0, 0, 0, 0.12)`).
 * @cssprop --xy-remote-color - Colour of a remote user's highlight; `<xy-node>` sets it from presence.
 * @cssprop --xy-enter-duration - Duration of the `motion="enter"` animation (default `260ms`).
 * @cssprop --xy-enter-stagger - Delay between consecutive entering nodes (default `18ms`).
 * @cssprop --xy-enter-easing - Easing of the entrance animation (default `cubic-bezier(.2, .8, .2, 1)`).
 * @tag xy-flow
 */
export class XyFlowElement extends LitElement implements FlowHost {
  static override properties = {
    // elements and types (nodes/edges/source are accessors, see below)
    nodeTypes: { attribute: false },
    edgeTypes: { attribute: false },
    defaultEdgeOptions: { attribute: false },
    flowId: { attribute: 'id' },
    fitViewOnInit: { attribute: 'fit-view', converter: booleanAttr(false) },
    fitViewOptions: { attribute: false },
    // viewport
    minZoom: { attribute: 'min-zoom', converter: numberAttr(DEFAULTS.minZoom) },
    maxZoom: { attribute: 'max-zoom', converter: numberAttr(DEFAULTS.maxZoom) },
    defaultViewport: { attribute: false },
    viewport: { attribute: false, noAccessor: true },
    translateExtent: { attribute: false },
    nodeExtent: { attribute: false },
    nodeOrigin: { attribute: false },
    // grid
    snapToGrid: { attribute: 'snap-to-grid', converter: booleanAttr(false) },
    snapGrid: { attribute: 'snap-grid', converter: numberPairAttr(DEFAULTS.snapGrid) },
    onlyRenderVisibleElements: {
      attribute: 'only-render-visible-elements',
      converter: booleanAttr(false),
    },
    // interactivity defaults
    nodesDraggable: { attribute: 'nodes-draggable', converter: booleanAttr(true) },
    nodesConnectable: { attribute: 'nodes-connectable', converter: booleanAttr(true) },
    nodesFocusable: { attribute: 'nodes-focusable', converter: booleanAttr(true) },
    edgesFocusable: { attribute: 'edges-focusable', converter: booleanAttr(true) },
    edgesReconnectable: { attribute: 'edges-reconnectable', converter: booleanAttr(false) },
    elementsSelectable: { attribute: 'elements-selectable', converter: booleanAttr(true) },
    selectNodesOnDrag: { attribute: 'select-nodes-on-drag', converter: booleanAttr(true) },
    elevateNodesOnSelect: { attribute: 'elevate-nodes-on-select', converter: booleanAttr(true) },
    elevateEdgesOnSelect: { attribute: 'elevate-edges-on-select', converter: booleanAttr(false) },
    autoPanOnNodeFocus: { attribute: 'auto-pan-on-node-focus', converter: booleanAttr(true) },
    autoPanOnNodeDrag: { attribute: 'auto-pan-on-node-drag', converter: booleanAttr(true) },
    autoPanOnConnect: { attribute: 'auto-pan-on-connect', converter: booleanAttr(true) },
    autoPanOnSelection: { attribute: 'auto-pan-on-selection', converter: booleanAttr(true) },
    autoPanSpeed: { attribute: 'auto-pan-speed', converter: numberAttr(DEFAULTS.autoPanSpeed) },
    // pan and zoom
    panOnDrag: { attribute: 'pan-on-drag', converter: panOnDragAttr },
    panOnScroll: { attribute: 'pan-on-scroll', converter: booleanAttr(false) },
    panOnScrollSpeed: { attribute: 'pan-on-scroll-speed', converter: numberAttr(0.5) },
    panOnScrollMode: {
      attribute: 'pan-on-scroll-mode',
      converter: enumAttr(SCROLL_MODES, PanOnScrollMode.Free),
    },
    zoomOnScroll: { attribute: 'zoom-on-scroll', converter: booleanAttr(true) },
    zoomOnPinch: { attribute: 'zoom-on-pinch', converter: booleanAttr(true) },
    zoomOnDoubleClick: { attribute: 'zoom-on-double-click', converter: booleanAttr(true) },
    preventScrolling: { attribute: 'prevent-scrolling', converter: booleanAttr(true) },
    // selection
    selectionOnDrag: { attribute: 'selection-on-drag', converter: booleanAttr(false) },
    selectionMode: {
      attribute: 'selection-mode',
      converter: enumAttr(SELECTION_MODES, SelectionMode.Full),
    },
    // thresholds
    paneClickDistance: { attribute: 'pane-click-distance', converter: numberAttr(1) },
    nodeClickDistance: { attribute: 'node-click-distance', converter: numberAttr(0) },
    nodeDragThreshold: { attribute: 'node-drag-threshold', converter: numberAttr(1) },
    connectionDragThreshold: { attribute: 'connection-drag-threshold', converter: numberAttr(1) },
    // connections
    connectionRadius: { attribute: 'connection-radius', converter: numberAttr(20) },
    reconnectRadius: { attribute: 'reconnect-radius', converter: numberAttr(10) },
    connectionMode: {
      attribute: 'connection-mode',
      converter: enumAttr(CONNECTION_MODES, ConnectionMode.Strict),
    },
    connectionLineType: {
      attribute: 'connection-line-type',
      converter: enumAttr(LINE_TYPES, ConnectionLineType.Bezier),
    },
    connectionLineStyle: { attribute: 'connection-line-style' },
    connectionLineContainerStyle: { attribute: 'connection-line-container-style' },
    connectionLineRenderer: { attribute: false },
    connectOnClick: { attribute: 'connect-on-click', converter: booleanAttr(true) },
    // keys
    deleteKey: { attribute: 'delete-key', converter: keyCodeAttr('Backspace') },
    selectionKey: { attribute: 'selection-key', converter: keyCodeAttr('Shift') },
    multiSelectionKey: {
      attribute: 'multi-selection-key',
      converter: keyCodeAttr(MAC ? 'Meta' : 'Control'),
    },
    panActivationKey: { attribute: 'pan-activation-key', converter: keyCodeAttr('Space') },
    zoomActivationKey: {
      attribute: 'zoom-activation-key',
      converter: keyCodeAttr(MAC ? 'Meta' : 'Control'),
    },
    historyKeys: { attribute: 'history-keys', converter: enumAttr(['on', 'off'] as const, 'on') },
    // appearance
    colorMode: {
      attribute: 'color-mode',
      converter: enumAttr(['light', 'dark', 'system'] as const, 'light'),
    },
    defaultMarkerColor: { attribute: 'default-marker-color' },
    noDragClassName: { attribute: 'no-drag-class-name' },
    noWheelClassName: { attribute: 'no-wheel-class-name' },
    noPanClassName: { attribute: 'no-pan-class-name' },
    attributionPosition: { attribute: 'attribution-position' },
    hideAttribution: { attribute: 'hide-attribution', converter: booleanAttr(false) },
    unstyled: { attribute: 'unstyled', converter: booleanAttr(false) },
    renderRootMode: {
      attribute: 'render-root',
      converter: enumAttr(['shadow', 'light'] as const, 'shadow'),
    },
    // accessibility
    ariaLabelConfig: { attribute: false },
    disableKeyboardA11y: { attribute: 'disable-keyboard-a11y', converter: booleanAttr(false) },
    zIndexMode: {
      attribute: 'z-index-mode',
      converter: enumAttr(['basic', 'auto', 'manual'] as const, 'basic'),
    },
    // XY Lit additions
    parallelEdges: {
      attribute: 'parallel-edges',
      converter: enumAttr(['off', 'spread'] as const, 'off'),
    },
    parallelEdgeGap: { attribute: 'parallel-edge-gap', converter: numberAttr(12) },
    motion: {
      attribute: 'motion',
      converter: enumAttr(['off', 'enter', 'enter remote'] as const, 'off'),
    },
    motionMaxNodes: { attribute: 'motion-max-nodes', converter: numberAttr(300) },
    wheelScrollDetection: {
      attribute: 'wheel-scroll-detection',
      converter: enumAttr(['auto', 'off'] as const, 'auto'),
    },
    noLoadingOverlay: { attribute: 'no-loading-overlay', converter: booleanAttr(false) },
    loading: { attribute: 'loading', converter: booleanAttr(false) },
    debug: { attribute: 'debug', converter: booleanAttr(false) },
    // functions
    isValidConnection: { attribute: false },
    onBeforeDelete: { attribute: false },
    onBeforeConnect: { attribute: false },
    onBeforeReconnect: { attribute: false },
    getEdgeId: { attribute: false },
    // internal render triggers
    labelsVersion: { state: true },
    firstRenderComplete: { state: true },
  };

  // --- elements and types
  /** Node type renderers by `node.type`; merged over the built-in types. */
  declare nodeTypes: NodeTypes | undefined;
  /** Edge type renderers by `edge.type`; merged over the built-in types. */
  declare edgeTypes: EdgeTypes | undefined;
  /** Defaults merged into every edge. */
  declare defaultEdgeOptions: DefaultEdgeOptions | undefined;
  /** Id of the flow (the `id` attribute). Default `'1'` (`xy-flow-<n>` in light mode). */
  declare flowId: string | undefined;
  /** Fit the viewport to the nodes on load (`fit-view` attribute; the `fitView` property accepts a boolean too). */
  declare fitViewOnInit: boolean;
  /** Options for the initial and queued `fitView`. */
  declare fitViewOptions: FitViewOptions | undefined;
  // --- viewport
  /** Minimum zoom. */
  declare minZoom: number;
  /** Maximum zoom. */
  declare maxZoom: number;
  /** Viewport at start (uncontrolled). */
  declare defaultViewport: Viewport | undefined;
  /** Bounds of the pannable area. */
  declare translateExtent: CoordinateExtent;
  /** Bounds nodes may be moved within. */
  declare nodeExtent: CoordinateExtent;
  /** Anchor of a node's position. */
  declare nodeOrigin: NodeOrigin;
  // --- grid
  /** Snap dragged nodes to the grid. */
  declare snapToGrid: boolean;
  /** Grid size. */
  declare snapGrid: SnapGrid;
  /** Render only nodes and edges inside the viewport. */
  declare onlyRenderVisibleElements: boolean;
  // --- interactivity
  /** Nodes can be dragged unless they say otherwise. */
  declare nodesDraggable: boolean;
  /** Nodes can be connected unless they say otherwise. */
  declare nodesConnectable: boolean;
  /** Nodes can be focused unless they say otherwise. */
  declare nodesFocusable: boolean;
  /** Edges can be focused unless they say otherwise. */
  declare edgesFocusable: boolean;
  /** Edge ends can be dragged to reconnect (default false). */
  declare edgesReconnectable: boolean;
  /** Elements can be selected unless they say otherwise. */
  declare elementsSelectable: boolean;
  /** Select a node when a drag starts on it. */
  declare selectNodesOnDrag: boolean;
  /** Raise selected nodes. */
  declare elevateNodesOnSelect: boolean;
  /** Raise selected edges. */
  declare elevateEdgesOnSelect: boolean;
  /** Pan to a focused node outside the viewport. */
  declare autoPanOnNodeFocus: boolean;
  /** Pan while dragging a node near the edge. */
  declare autoPanOnNodeDrag: boolean;
  /** Pan while dragging a connection near the edge. */
  declare autoPanOnConnect: boolean;
  /** Pan while drawing a selection near the edge. */
  declare autoPanOnSelection: boolean;
  /** Auto-pan speed. */
  declare autoPanSpeed: number;
  // --- pan and zoom
  /** Pan by dragging the pane: `true`, `false` or the allowed mouse buttons. */
  declare panOnDrag: boolean | number[];
  /** Pan with the wheel instead of zooming. */
  declare panOnScroll: boolean;
  /** Speed of wheel panning. */
  declare panOnScrollSpeed: number;
  /** Direction of wheel panning. */
  declare panOnScrollMode: `${PanOnScrollMode}`;
  /** Zoom with the wheel. */
  declare zoomOnScroll: boolean;
  /** Zoom with pinch gestures. */
  declare zoomOnPinch: boolean;
  /** Zoom on double click. */
  declare zoomOnDoubleClick: boolean;
  /** Prevent the page from scrolling over the flow. */
  declare preventScrolling: boolean;
  // --- selection
  /** Draw a selection rectangle by dragging the pane. */
  declare selectionOnDrag: boolean;
  /** `full` or `partial` selection by rectangle. */
  declare selectionMode: `${SelectionMode}`;
  // --- thresholds
  /** Pixels a pane press may move to still count as a click. */
  declare paneClickDistance: number;
  /** Pixels a node press may move to still count as a click. */
  declare nodeClickDistance: number;
  /** Pixels before a node drag starts. */
  declare nodeDragThreshold: number;
  /** Pixels before a connection drag starts. */
  declare connectionDragThreshold: number;
  // --- connections
  /** Radius in which a connection snaps to a handle. */
  declare connectionRadius: number;
  /** Radius of the reconnect anchors. */
  declare reconnectRadius: number;
  /** `strict` or `loose`. */
  declare connectionMode: `${ConnectionMode}`;
  /** Shape of the connection line. */
  declare connectionLineType: `${ConnectionLineType}`;
  /** Inline style of the connection line path. */
  declare connectionLineStyle: string | undefined;
  /** Inline style of the connection line `<svg>`. */
  declare connectionLineContainerStyle: string | undefined;
  /** Custom connection line. */
  declare connectionLineRenderer: ConnectionLineRenderer | undefined;
  /** Allow click-to-connect. */
  declare connectOnClick: boolean;
  // --- keys
  /** Key(s) that delete the selection. `null` disables. */
  declare deleteKey: KeyCode | null;
  /** Key(s) that hold the selection mode. */
  declare selectionKey: KeyCode | null;
  /** Key(s) that add to the selection. */
  declare multiSelectionKey: KeyCode | null;
  /** Key(s) that make dragging pan the pane. */
  declare panActivationKey: KeyCode | null;
  /** Key(s) that make the wheel zoom. */
  declare zoomActivationKey: KeyCode | null;
  /** Bind undo/redo keys to the history. */
  declare historyKeys: 'on' | 'off';
  // --- appearance
  /** Colour scheme. */
  declare colorMode: ColorMode;
  /** Colour of upstream markers without one. */
  declare defaultMarkerColor: string | null;
  /** Class that stops a drag from starting. */
  declare noDragClassName: string;
  /** Class that stops wheel zoom. */
  declare noWheelClassName: string;
  /** Class that stops panning. */
  declare noPanClassName: string;
  /** Where the attribution sits. */
  declare attributionPosition: PanelPosition;
  /** Hide the attribution. */
  declare hideAttribution: boolean;
  /** Use `base.css` instead of `style.css`. */
  declare unstyled: boolean;
  /** `shadow` (default) or `light`; read once, before the first render (`render-root` attribute). */
  declare renderRootMode: RenderRoot;
  // --- accessibility
  /** Overrides for the ARIA label strings. */
  declare ariaLabelConfig: Partial<AriaLabelConfig> | undefined;
  /** Turn keyboard interaction with nodes and edges off. */
  declare disableKeyboardA11y: boolean;
  /** z-index strategy. */
  declare zIndexMode: ZIndexMode;
  // --- XY Lit
  /** `spread` fans out parallel edges. */
  declare parallelEdges: ParallelEdges;
  /** Gap between spread edges. */
  declare parallelEdgeGap: number;
  /** Entrance motion. */
  declare motion: MotionMode;
  /** Node count above which entrance motion is skipped. */
  declare motionMaxNodes: number;
  /** Whether wheel events over scrollable node content scroll that content. */
  declare wheelScrollDetection: WheelScrollDetection;
  /** Never show the loading overlay. */
  declare noLoadingOverlay: boolean;
  /** Force the loading overlay. */
  declare loading: boolean;
  /** Log change batches. */
  declare debug: boolean;
  // --- functions
  /** Connection validator. */
  declare isValidConnection: IsValidConnection | undefined;
  /** Called before elements are deleted. */
  declare onBeforeDelete: OnBeforeDelete | undefined;
  /** Called before a connection becomes an edge. */
  declare onBeforeConnect: OnBeforeConnect | undefined;
  /** Called before an edge is reconnected. */
  declare onBeforeReconnect: OnBeforeReconnect | undefined;
  /** Edge id generator. */
  declare getEdgeId: GetEdgeId | undefined;
  /** @internal Bumped to re-render the edge label layer. */
  declare labelsVersion: number;
  /** @internal Set by the render-complete controller; hides the loading overlay. */
  declare firstRenderComplete: boolean;

  // --- internals ---------------------------------------------------------------------------------
  #store: FlowStore | null = null;
  #ownsStore = true;
  #provided: FlowContextValue | undefined;
  #provider: FlowProvider | undefined;
  #providerValue: ContextProvider<typeof flowContext, XyFlowElement>;
  #initialNodes: Node[] = [];
  #initialEdges: Edge[] = [];
  #pendingSource: FlowDataSource | null = null;
  #controlledViewport: Viewport | undefined;
  #needsInit = true;
  #everInitialized = false;
  #systemDark = false;
  #mql: MediaQueryList | null = null;
  #mergedNodeTypes: NodeTypes = builtinNodeTypes;
  #mergedEdgeTypes: EdgeTypes = builtinEdgeTypes;
  #typeSheets: CSSStyleSheet[] = [];
  #userSheets: CSSStyleSheet[] = [];
  #nodeCtx: NodeRenderContext | null = null;
  #edgeCtx: EdgeRenderContext | null = null;
  #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  #listenerTypes: ReadonlySet<string> = new Set();
  readonly #edgeLabels = new Map<string, LabelEntry[]>();
  readonly #toolbars = new Map<number, ToolbarEntry>();

  /** @internal Measures the flow's nodes. */
  readonly measure = new MeasureController();
  /** @internal Highlights handles during connections. */
  readonly hub = new ConnectionHub();
  /** @internal */
  readonly containerSize = new ContainerSizeController();
  /** @internal */
  readonly panZoomCtl: PanZoomController;
  /** @internal */
  readonly pane: PaneController;
  /** @internal */
  readonly keys: FlowKeysController;
  /** @internal */
  readonly renderComplete: RenderCompleteController;
  /** @internal Entrance motion state, computed before every render. */
  readonly motionCtl: MotionController;

  /** @internal The `.lit-flow` wrapper (`store.domNode`). */
  readonly wrapperRef = createRef<HTMLDivElement>();
  /** @internal The element XYPanZoom listens on. */
  readonly zoomRef = createRef<HTMLDivElement>();
  /** @internal The pane element. */
  readonly paneRef = createRef<HTMLDivElement>();
  /** @internal The transformed viewport element. */
  readonly viewportRef = createRef<HTMLDivElement>();
  /** @internal The `.lit-flow__nodes` container (wheel detection listens here). */
  readonly nodesRef = createRef<HTMLDivElement>();
  readonly #lightSlots = new LightSlotProjector(this);
  #wheelCleanup: (() => void) | null = null;
  #wheelTarget: HTMLElement | null = null;

  /** @internal Controllers feeding the layers (see spec/04 §Render tree). */
  readonly visibleNodes: StoreController<InternalNode[]>;
  /** @internal Laid-out edges (positions, handles) for the edge layer. */
  readonly layoutedEdges: StoreController<Map<string, EdgeLayouted>>;
  /** @internal Marker definitions rendered into the shared `<defs>`. */
  readonly markers: StoreController<MarkerDef[]>;
  /** @internal The connection in progress, for the connection line. */
  readonly connection: StoreController<ConnectionState<InternalNode>>;
  /** @internal Selection rectangle state for the pane layer. */
  readonly selection: StoreController<readonly [boolean, SelectionRect | null, boolean, number]>;
  /** @internal Accessibility labels and live-region state. */
  readonly a11y: StoreController<readonly [AriaLabelConfig, string, boolean, string]>;
  /** @internal Interaction flags that re-render the host. */
  readonly interaction: StoreController<unknown>;
  /** @internal Re-renders the node layer when node-level state changes. */
  readonly nodeState: StoreController<unknown>;
  /** @internal Re-renders the edge layer when edge-level state changes. */
  readonly edgeState: StoreController<unknown>;
  /** @internal Set by the toolbar layer: a toolbar is shown, so the viewport transform matters. */
  toolbarsActive = false;
  /** @internal Follows the viewport transform, but only while a node toolbar is shown. */
  readonly toolbarViewport: StoreController<unknown>;

  constructor() {
    super();
    this.nodeTypes = undefined;
    this.edgeTypes = undefined;
    this.defaultEdgeOptions = undefined;
    this.flowId = undefined;
    this.fitViewOnInit = false;
    this.fitViewOptions = undefined;
    this.minZoom = DEFAULTS.minZoom;
    this.maxZoom = DEFAULTS.maxZoom;
    this.defaultViewport = undefined;
    this.translateExtent = infiniteExtent;
    this.nodeExtent = infiniteExtent;
    this.nodeOrigin = DEFAULTS.nodeOrigin;
    this.snapToGrid = DEFAULTS.snapToGrid;
    this.snapGrid = DEFAULTS.snapGrid;
    this.onlyRenderVisibleElements = DEFAULTS.onlyRenderVisibleElements;
    this.nodesDraggable = DEFAULTS.nodesDraggable;
    this.nodesConnectable = DEFAULTS.nodesConnectable;
    this.nodesFocusable = DEFAULTS.nodesFocusable;
    this.edgesFocusable = DEFAULTS.edgesFocusable;
    this.edgesReconnectable = DEFAULTS.edgesReconnectable;
    this.elementsSelectable = DEFAULTS.elementsSelectable;
    this.selectNodesOnDrag = DEFAULTS.selectNodesOnDrag;
    this.elevateNodesOnSelect = DEFAULTS.elevateNodesOnSelect;
    this.elevateEdgesOnSelect = DEFAULTS.elevateEdgesOnSelect;
    this.autoPanOnNodeFocus = DEFAULTS.autoPanOnNodeFocus;
    this.autoPanOnNodeDrag = DEFAULTS.autoPanOnNodeDrag;
    this.autoPanOnConnect = DEFAULTS.autoPanOnConnect;
    this.autoPanOnSelection = DEFAULTS.autoPanOnSelection;
    this.autoPanSpeed = DEFAULTS.autoPanSpeed;
    this.panOnDrag = true;
    this.panOnScroll = false;
    this.panOnScrollSpeed = 0.5;
    this.panOnScrollMode = PanOnScrollMode.Free;
    this.zoomOnScroll = true;
    this.zoomOnPinch = true;
    this.zoomOnDoubleClick = true;
    this.preventScrolling = true;
    this.selectionOnDrag = false;
    this.selectionMode = DEFAULTS.selectionMode;
    this.paneClickDistance = 1;
    this.nodeClickDistance = 0;
    this.nodeDragThreshold = DEFAULTS.nodeDragThreshold;
    this.connectionDragThreshold = DEFAULTS.connectionDragThreshold;
    this.connectionRadius = DEFAULTS.connectionRadius;
    this.reconnectRadius = DEFAULTS.reconnectRadius;
    this.connectionMode = DEFAULTS.connectionMode;
    this.connectionLineType = ConnectionLineType.Bezier;
    this.connectionLineStyle = undefined;
    this.connectionLineContainerStyle = undefined;
    this.connectionLineRenderer = undefined;
    this.connectOnClick = DEFAULTS.connectOnClick;
    this.deleteKey = 'Backspace';
    this.selectionKey = 'Shift';
    this.multiSelectionKey = MAC ? 'Meta' : 'Control';
    this.panActivationKey = 'Space';
    this.zoomActivationKey = MAC ? 'Meta' : 'Control';
    this.historyKeys = 'on';
    this.colorMode = 'light';
    this.defaultMarkerColor = DEFAULTS.defaultMarkerColor;
    this.noDragClassName = DEFAULTS.noDragClassName;
    this.noWheelClassName = DEFAULTS.noWheelClassName;
    this.noPanClassName = DEFAULTS.noPanClassName;
    this.attributionPosition = 'bottom-right';
    this.hideAttribution = false;
    this.unstyled = false;
    this.renderRootMode = 'shadow';
    this.ariaLabelConfig = undefined;
    this.disableKeyboardA11y = DEFAULTS.disableKeyboardA11y;
    this.zIndexMode = DEFAULTS.zIndexMode;
    this.parallelEdges = DEFAULTS.parallelEdges;
    this.parallelEdgeGap = DEFAULTS.parallelEdgeGap;
    this.motion = 'off';
    this.motionMaxNodes = 300;
    this.wheelScrollDetection = 'auto';
    this.noLoadingOverlay = false;
    this.loading = false;
    this.debug = DEFAULTS.debug;
    this.isValidConnection = undefined;
    this.onBeforeDelete = undefined;
    this.onBeforeConnect = undefined;
    this.onBeforeReconnect = undefined;
    this.getEdgeId = undefined;
    this.labelsVersion = 0;
    this.firstRenderComplete = false;

    this.#providerValue = new ContextProvider(this, { context: flowContext });

    this.panZoomCtl = new PanZoomController(this);
    this.pane = new PaneController(this);
    this.keys = new FlowKeysController(this);
    this.renderComplete = new RenderCompleteController(this);
    this.motionCtl = new MotionController(this);

    const own = { store: null } as const;
    this.visibleNodes = new StoreController(
      this,
      (_s, store) => store.getVisibleNodes(),
      Object.is,
      own,
    );
    this.layoutedEdges = new StoreController(
      this,
      (_s, store) => store.getLayoutedEdges(),
      Object.is,
      own,
    );
    this.markers = new StoreController(this, (_s, store) => store.getMarkerDefs(), Object.is, own);
    this.connection = new StoreController(this, (s) => s.connection, Object.is, own);
    this.selection = new StoreController(
      this,
      (s) =>
        [
          s.userSelectionActive,
          s.userSelectionRect,
          s.nodesSelectionActive,
          s.lookupVersion,
        ] as const,
      shallow,
      own,
    );
    this.a11y = new StoreController(
      this,
      (s) => [s.ariaLabelConfig, s.ariaLiveMessage, s.disableKeyboardA11y, s.flowId] as const,
      shallow,
      own,
    );
    this.interaction = new StoreController<unknown>(
      this,
      (s) =>
        [
          s.panActivationKeyPressed,
          s.zoomActivationKeyPressed,
          s.selectionKeyPressed,
          s.userSelectionActive,
          s.connection.inProgress,
          s.paneDragging,
          s.nodesConnectable,
        ] as const,
      shallow,
      own,
    );
    this.nodeState = new StoreController<unknown>(
      this,
      (s) =>
        [
          s.nodesDraggable,
          s.nodesConnectable,
          s.nodesFocusable,
          s.elementsSelectable,
          s.selectNodesOnDrag,
          s.nodeDragThreshold,
          s.noDragClassName,
          s.noPanClassName,
          s.disableKeyboardA11y,
          s.autoPanOnNodeFocus,
          s.ariaLabelConfig,
          s.flowId,
        ] as const,
      shallow,
      own,
    );
    this.toolbarViewport = new StoreController<unknown>(
      this,
      (s) => (this.toolbarsActive ? s.transform : null),
      Object.is,
      own,
    );
    this.edgeState = new StoreController<unknown>(
      this,
      (s) =>
        [
          s.elementsSelectable,
          s.edgesFocusable,
          s.edgesReconnectable,
          s.reconnectRadius,
          s.disableKeyboardA11y,
          s.ariaLabelConfig,
          s.noPanClassName,
          s.flowId,
        ] as const,
      shallow,
      own,
    );

    // the active flow receives the delete key: the one with focus, else the last one pressed
    this.addEventListener(
      'pointerdown',
      () => {
        keyboardTracker.activeFlow = this;
      },
      { capture: true },
    );
    this.addEventListener('focusin', () => {
      keyboardTracker.activeFlow = this;
    });
  }

  // --- store access ------------------------------------------------------------------------------

  /** Whether the store exists (after the element connected for the first time). */
  get hasStore(): boolean {
    return this.#store !== null;
  }

  /**
   * The flow's state container: escape hatch for tools and plugins.
   *
   * @throws When the element has never been connected.
   */
  get store(): FlowStore {
    if (!this.#store) {
      throw new Error('XY Lit: <xy-flow> has no store yet; add it to the document first.');
    }
    return this.#store;
  }

  /** The stable imperative API of the flow (same object as the `init` event's `instance`). */
  get instance(): FlowInstance {
    return this.store.instance;
  }

  // --- data ----------------------------------------------------------------------------------------

  /** The nodes. Assigning replaces them (diffed into changes; honours controlled mode). */
  get nodes(): Node[] {
    return this.#store ? this.#store.getState().nodes : this.#initialNodes;
  }
  set nodes(nodes: Node[]) {
    if (this.#store) this.#store.setOptions({ nodes });
    else this.#initialNodes = nodes;
  }

  /** The edges. Assigning replaces them. */
  get edges(): Edge[] {
    return this.#store ? this.#store.getState().edges : this.#initialEdges;
  }
  set edges(edges: Edge[]) {
    if (this.#store) this.#store.setOptions({ edges });
    else this.#initialEdges = edges;
  }

  /** An external data source (e.g. Yjs), or `null` for the built-in in-memory source. */
  get source(): FlowDataSource | null {
    if (!this.#store) return this.#pendingSource;
    const source = this.#store.source;
    return source instanceof ArraySource ? null : source;
  }
  set source(source: FlowDataSource | null) {
    if (this.#store) {
      this.#store.setSource(source);
      // a new source brings a new first render: show the loading overlay again
      this.firstRenderComplete = false;
      this.renderComplete.reset();
      this.motionCtl.reset();
      if (!source) this.#store.setOptions({ nodes: this.#initialNodes, edges: this.#initialEdges });
    } else {
      this.#pendingSource = source;
    }
  }

  /**
   * The viewport. Setting it makes the viewport controlled (keep it in sync by listening to
   * `viewport-change`); setting `undefined` makes it uncontrolled again. Reading returns the
   * controlled value, else the current transform.
   */
  get viewport(): Viewport | undefined {
    if (this.#controlledViewport) return this.#controlledViewport;
    if (!this.#store) return undefined;
    const [x, y, zoom] = this.#store.getState().transform;
    return { x, y, zoom };
  }
  set viewport(viewport: Viewport | undefined) {
    const old = this.#controlledViewport;
    this.#controlledViewport = viewport;
    this.requestUpdate('viewport', old);
  }

  /** The controlled viewport, or `undefined` when the viewport is uncontrolled. */
  get controlledViewport(): Viewport | undefined {
    return this.#controlledViewport;
  }

  /**
   * `fitView` is both the `fit-view` boolean property of the spec (assign `true`/`false` to fit on
   * load) and the {@link FlowInstance} method: reading it returns the method.
   */
  get fitView(): (options?: FitViewOptions) => Promise<boolean> {
    return (options) => this.store.fitView(options);
  }
  set fitView(value: boolean) {
    this.fitViewOnInit = !!value;
  }

  // --- events --------------------------------------------------------------------------------------

  /**
   * Dispatch a flow event (`bubbles`, `composed`).
   *
   * @param type - Event name (see `FlowEventMap`).
   * @param detail - Event detail.
   * @param cancelable - Whether `preventDefault()` is honoured.
   * @returns False when a listener prevented the default action.
   */
  emit<K extends keyof FlowEventMap>(
    type: K,
    detail: FlowEventMap[K],
    cancelable = false,
  ): boolean {
    const event = new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable });
    return this.dispatchEvent(event);
  }

  /**
   * Whether anything listens for an event type on this element (cheap guard for events that fire
   * on every pointer move).
   *
   * @param type - Event name.
   */
  hasListener(type: string): boolean {
    return this.#listenerTypes.has(type);
  }

  /** The set of event types with at least one listener (identity changes when it does). */
  get listenerTypes(): ReadonlySet<string> {
    return this.#listenerTypes;
  }

  override addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: XyFlowElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener<K extends keyof FlowEventMap>(
    type: K,
    listener: (this: XyFlowElement, ev: CustomEvent<FlowEventMap[K]>) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  override addEventListener(
    type: string,
    listener: unknown,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (!listener) return;
    const fn = listener as EventListenerOrEventListenerObject;
    super.addEventListener(type, fn, options);
    let set = this.#listeners.get(type);
    if (!set) {
      set = new Set();
      this.#listeners.set(type, set);
      this.#updateListenerTypes();
    }
    set.add(fn);
    if (typeof options === 'object' && options.signal) {
      options.signal.addEventListener('abort', () => {
        this.removeEventListener(type, fn, options);
      });
    }
  }

  override removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: XyFlowElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  override removeEventListener(
    type: string,
    listener: unknown,
    options?: boolean | EventListenerOptions,
  ): void {
    if (!listener) return;
    const fn = listener as EventListenerOrEventListenerObject;
    super.removeEventListener(type, fn, options);
    const set = this.#listeners.get(type);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) {
      this.#listeners.delete(type);
      this.#updateListenerTypes();
    }
  }

  #updateListenerTypes(): void {
    this.#listenerTypes = new Set(this.#listeners.keys());
    this.requestUpdate();
  }

  // --- connect -------------------------------------------------------------------------------------

  /**
   * Turn a completed connection into an edge: `onBeforeConnect`, then a cancelable `connect`
   * event whose default action adds the edge (skipped when the same connection already exists).
   *
   * @param connection - The completed connection.
   */
  handleConnect(connection: Connection): void {
    const { store } = this;
    const s = store.getState();
    const before = s.onBeforeConnect ? s.onBeforeConnect(connection) : connection;
    if (!before) return;
    const edge = { id: s.getEdgeId(connection), ...s.defaultEdgeOptions, ...before } as Edge;
    if (!this.emit('connect', { connection, edge }, true)) return;
    // upstream addEdge ignores duplicates and edges without source/target
    const next = addEdge(edge, store.getState().edges, { onError: store.onError });
    if (next === store.getState().edges) return;
    store.triggerEdgeChanges([{ type: 'add', item: edge }], {
      phase: 'discrete',
      origin: 'connect',
    });
  }

  /**
   * Turn a completed reconnect drag into an edge update: `onBeforeReconnect`, then a cancelable
   * `reconnect` event whose default action replaces the old edge (same id) with the old edge
   * merged with the new connection.
   *
   * @param oldEdge - The edge being reconnected.
   * @param connection - The new source/target and handles.
   */
  handleReconnect(oldEdge: Edge, connection: Connection): void {
    const { store } = this;
    const s = store.getState();
    const merged = { ...oldEdge, ...connection } as Edge;
    const next = s.onBeforeReconnect ? s.onBeforeReconnect(merged, oldEdge) : merged;
    if (!next) return;
    if (!this.emit('reconnect', { oldEdge, newConnection: connection, edge: next }, true)) return;
    store.triggerEdgeChanges([{ type: 'replace', id: oldEdge.id, item: next }], {
      phase: 'discrete',
      origin: 'reconnect',
    });
  }

  // --- FlowInstance --------------------------------------------------------------------------------

  /** See {@link FlowInstance.getNodes}. */
  getNodes: FlowInstance['getNodes'] = () => this.instance.getNodes();
  /** See {@link FlowInstance.setNodes}. */
  setNodes: FlowInstance['setNodes'] = (payload) => {
    this.instance.setNodes(payload);
  };
  /** See {@link FlowInstance.addNodes}. */
  addNodes: FlowInstance['addNodes'] = (payload, options) => {
    this.instance.addNodes(payload, options);
  };
  /** See {@link FlowInstance.getNode}. */
  getNode: FlowInstance['getNode'] = (id) => this.instance.getNode(id);
  /** See {@link FlowInstance.getInternalNode}. */
  getInternalNode: FlowInstance['getInternalNode'] = (id) => this.instance.getInternalNode(id);
  /** See {@link FlowInstance.getEdges}. */
  getEdges: FlowInstance['getEdges'] = () => this.instance.getEdges();
  /** See {@link FlowInstance.setEdges}. */
  setEdges: FlowInstance['setEdges'] = (payload) => {
    this.instance.setEdges(payload);
  };
  /** See {@link FlowInstance.addEdges}. */
  addEdges: FlowInstance['addEdges'] = (payload) => {
    this.instance.addEdges(payload);
  };
  /** See {@link FlowInstance.getEdge}. */
  getEdge: FlowInstance['getEdge'] = (id) => this.instance.getEdge(id);
  /** See {@link FlowInstance.toObject}. */
  toObject: FlowInstance['toObject'] = () => this.instance.toObject();
  /** See {@link FlowInstance.deleteElements}. */
  deleteElements: FlowInstance['deleteElements'] = (params) => this.instance.deleteElements(params);
  /** See {@link FlowInstance.getIntersectingNodes}. */
  getIntersectingNodes: FlowInstance['getIntersectingNodes'] = (node, partially, nodes) =>
    this.instance.getIntersectingNodes(node, partially, nodes);
  /** See {@link FlowInstance.isNodeIntersecting}. */
  isNodeIntersecting: FlowInstance['isNodeIntersecting'] = (node, area, partially) =>
    this.instance.isNodeIntersecting(node, area, partially);
  /** See {@link FlowInstance.updateNode}. */
  updateNode: FlowInstance['updateNode'] = (id, update, options) => {
    this.instance.updateNode(id, update, options);
  };
  /** See {@link FlowInstance.updateNodeData}. */
  updateNodeData: FlowInstance['updateNodeData'] = (id, update, options) => {
    this.instance.updateNodeData(id, update, options);
  };
  /** See {@link FlowInstance.updateEdge}. */
  updateEdge: FlowInstance['updateEdge'] = (id, update, options) => {
    this.instance.updateEdge(id, update, options);
  };
  /** See {@link FlowInstance.updateEdgeData}. */
  updateEdgeData: FlowInstance['updateEdgeData'] = (id, update, options) => {
    this.instance.updateEdgeData(id, update, options);
  };
  /** See {@link FlowInstance.getNodesBounds}. */
  getNodesBounds: FlowInstance['getNodesBounds'] = (nodes) => this.instance.getNodesBounds(nodes);
  /** See {@link FlowInstance.getHandleConnections}. */
  getHandleConnections: FlowInstance['getHandleConnections'] = (p) =>
    this.instance.getHandleConnections(p);
  /** See {@link FlowInstance.getNodeConnections}. */
  getNodeConnections: FlowInstance['getNodeConnections'] = (p) =>
    this.instance.getNodeConnections(p);
  /** See {@link FlowInstance.updateNodeInternals}. */
  updateNodeInternals: FlowInstance['updateNodeInternals'] = (ids) => {
    this.instance.updateNodeInternals(ids);
  };
  /** See {@link FlowInstance.findFreePosition}. */
  findFreePosition: FlowInstance['findFreePosition'] = (size, options) =>
    this.instance.findFreePosition(size, options);
  /** See {@link FlowInstance.zoomIn}. */
  zoomIn: FlowInstance['zoomIn'] = (o) => this.instance.zoomIn(o);
  /** See {@link FlowInstance.zoomOut}. */
  zoomOut: FlowInstance['zoomOut'] = (o) => this.instance.zoomOut(o);
  /** See {@link FlowInstance.zoomTo}. */
  zoomTo: FlowInstance['zoomTo'] = (zoom, o) => this.instance.zoomTo(zoom, o);
  /** See {@link FlowInstance.getZoom}. */
  getZoom: FlowInstance['getZoom'] = () => this.instance.getZoom();
  /** See {@link FlowInstance.setViewport}. */
  setViewport: FlowInstance['setViewport'] = (v, o) => this.instance.setViewport(v, o);
  /** See {@link FlowInstance.getViewport}. */
  getViewport: FlowInstance['getViewport'] = () => this.instance.getViewport();
  /** See {@link FlowInstance.setCenter}. */
  setCenter: FlowInstance['setCenter'] = (x, y, o) => this.instance.setCenter(x, y, o);
  /** See {@link FlowInstance.fitBounds}. */
  fitBounds: FlowInstance['fitBounds'] = (bounds, o) => this.instance.fitBounds(bounds, o);
  /** See {@link FlowInstance.screenToFlowPosition}. */
  screenToFlowPosition: FlowInstance['screenToFlowPosition'] = (p, o) =>
    this.instance.screenToFlowPosition(p, o);
  /** See {@link FlowInstance.flowToScreenPosition}. */
  flowToScreenPosition: FlowInstance['flowToScreenPosition'] = (p) =>
    this.instance.flowToScreenPosition(p);
  /** True once the pan/zoom engine is attached. */
  get viewportInitialized(): boolean {
    return this.#store ? this.#store.instance.viewportInitialized : false;
  }

  // --- styles --------------------------------------------------------------------------------------

  /**
   * Add stylesheets to the render root (for example a compiled Tailwind sheet), after the base
   * and node/edge type sheets. Deduplicated by identity.
   *
   * @param sheets - Constructable stylesheets or Lit `css` results.
   */
  adoptStyles(...sheets: (CSSStyleSheet | CSSResult)[]): void {
    for (const sheet of sheets) {
      const resolved = sheet instanceof CSSStyleSheet ? sheet : sheetOf(sheet);
      if (!this.#userSheets.includes(resolved)) this.#userSheets.push(resolved);
    }
    this.#applyStyles();
  }

  #collectTypeSheets(): CSSStyleSheet[] {
    const out = new Set<CSSStyleSheet>();
    const add = (styles: CSSResultGroup | undefined): void => {
      if (!styles) return;
      if (Array.isArray(styles)) {
        for (const item of styles as CSSResultGroup[]) add(item);
      } else if (styles instanceof CSSStyleSheet) {
        out.add(styles);
      } else if ('cssText' in styles) {
        out.add(sheetOf(styles));
      }
    };
    for (const entry of Object.values(this.nodeTypes ?? {})) {
      if (typeof entry === 'string') {
        add((customElements.get(entry) as { styles?: CSSResultGroup } | undefined)?.styles);
      } else if (typeof entry === 'function') {
        add((entry as unknown as { styles?: CSSResultGroup }).styles);
      } else {
        add(entry.styles);
      }
    }
    for (const def of Object.values(this.edgeTypes ?? {})) add(def.styles);
    return [...out];
  }

  #applyStyles(): void {
    const root = this.renderRoot as Document | ShadowRoot | HTMLElement | undefined;
    if (!root) return;
    const sheets = [
      ...(this.unstyled ? baseSheets : defaultSheets),
      ...this.#typeSheets,
      ...this.#userSheets,
    ];
    const unique = [...new Set(sheets)];
    if (this.renderRootMode === 'light') {
      adoptInto(this.getRootNode() as Document | ShadowRoot, unique);
    } else {
      (root as ShadowRoot).adoptedStyleSheets = unique;
    }
  }

  // --- types and contexts --------------------------------------------------------------------------

  /** @internal Built-in node types merged with the user's. */
  get mergedNodeTypes(): NodeTypes {
    return this.#mergedNodeTypes;
  }

  /** @internal Built-in edge types merged with the user's. */
  get mergedEdgeTypes(): EdgeTypes {
    return this.#mergedEdgeTypes;
  }

  /** @internal The context passed to every `<xy-node>`; stable until a field changes. */
  get nodeContext(): NodeRenderContext {
    const store = this.store;
    const s = store.getState();
    const next: NodeRenderContext = {
      store,
      instance: store.instance,
      flow: this,
      flowId: s.flowId,
      nodeTypes: this.#mergedNodeTypes,
      nodesDraggable: s.nodesDraggable,
      nodesConnectable: s.nodesConnectable,
      nodesFocusable: s.nodesFocusable,
      elementsSelectable: s.elementsSelectable,
      selectNodesOnDrag: s.selectNodesOnDrag,
      nodeDragThreshold: s.nodeDragThreshold,
      nodeClickDistance: this.nodeClickDistance,
      noDragClassName: s.noDragClassName,
      noPanClassName: s.noPanClassName,
      disableKeyboardA11y: s.disableKeyboardA11y,
      autoPanOnNodeFocus: s.autoPanOnNodeFocus,
      ariaLabelConfig: s.ariaLabelConfig,
      measure: this.measure,
      motion: this.motionCtl.state,
      listeners: this.#listenerTypes,
    };
    if (this.#nodeCtx && shallow(this.#nodeCtx, next)) return this.#nodeCtx;
    this.#nodeCtx = next;
    return next;
  }

  /** @internal The context passed to every `<xy-edge>`; stable until a field changes. */
  get edgeContext(): EdgeRenderContext {
    const store = this.store;
    const s = store.getState();
    const next: EdgeRenderContext = {
      store,
      instance: store.instance,
      flowId: s.flowId,
      flow: this,
      edgeTypes: this.#mergedEdgeTypes,
      elementsSelectable: s.elementsSelectable,
      edgesFocusable: s.edgesFocusable,
      edgesReconnectable: s.edgesReconnectable,
      reconnectRadius: s.reconnectRadius,
      disableKeyboardA11y: s.disableKeyboardA11y,
      ariaLabelConfig: s.ariaLabelConfig,
      noPanClassName: s.noPanClassName,
      listeners: this.#listenerTypes,
      motion: this.motionCtl.state,
    };
    if (this.#edgeCtx && shallow(this.#edgeCtx, next)) return this.#edgeCtx;
    this.#edgeCtx = next;
    return next;
  }

  // --- edge labels and render bookkeeping --------------------------------------------------------

  /**
   * Publish the HTML labels of an edge (called by `<xy-edge>` on every render).
   *
   * @param edgeId - Edge id.
   * @param entries - The edge's labels.
   */
  setEdgeLabels(edgeId: string, entries: LabelEntry[]): void {
    if (entries.length === 0) {
      this.removeEdgeLabels(edgeId);
      return;
    }
    this.#edgeLabels.set(edgeId, entries);
    this.requestLabelLayerUpdate();
  }

  /**
   * Remove the labels of an edge.
   *
   * @param edgeId - Edge id.
   */
  removeEdgeLabels(edgeId: string): void {
    if (this.#edgeLabels.delete(edgeId)) this.requestLabelLayerUpdate();
  }

  /**
   * Drop the labels of an edge whose element was disconnected. This runs inside the flow's own
   * render when the edge element leaves the DOM, so the label layer is only re-rendered (in a later
   * microtask, never as a change-in-update) while the edge is still laid out; a deleted edge is
   * already gone from {@link labelEntries}.
   *
   * @param edgeId - Edge id.
   * @internal
   */
  releaseEdgeLabels(edgeId: string): void {
    if (!this.#edgeLabels.delete(edgeId)) return;
    if (!this.layoutedEdges.value.has(edgeId)) return;
    queueMicrotask(() => this.requestLabelLayerUpdate());
  }

  /** Re-render the label layer (coalesced with other updates in the same microtask). */
  requestLabelLayerUpdate(): void {
    this.labelsVersion++;
  }

  /** @internal All published labels, in edge order. */
  labelEntries(): LabelEntry[] {
    const out: LabelEntry[] = [];
    for (const id of this.layoutedEdges.value.keys()) {
      const entries = this.#edgeLabels.get(id);
      if (entries) out.push(...entries);
    }
    return out;
  }

  /** @internal The node toolbars registered by {@link nodeToolbar} directives, by directive key. */
  get toolbars(): ReadonlyMap<number, ToolbarEntry> {
    return this.#toolbars;
  }

  /**
   * Register or update a node toolbar (called by the `nodeToolbar` directive on every render).
   *
   * @param entry - The toolbar.
   */
  setToolbar(entry: ToolbarEntry): void {
    this.#toolbars.set(entry.key, entry);
    this.requestUpdate();
  }

  /**
   * Remove a node toolbar.
   *
   * @param key - Key of the directive instance.
   */
  removeToolbar(key: number): void {
    if (this.#toolbars.delete(key)) this.requestUpdate();
  }

  /** Called by `<xy-edge>` after it rendered (feeds render-complete). */
  edgeRendered(edgeId: string): void {
    this.renderComplete.edgeRendered(edgeId);
  }

  /** Called by `<xy-edge>` when it is removed. */
  edgeRemoved(edgeId: string): void {
    this.renderComplete.edgeRemoved(edgeId);
  }

  /** @internal Called by the render-complete controller. */
  setFirstRenderComplete(): void {
    if (!this.firstRenderComplete) this.firstRenderComplete = true;
  }

  /**
   * Resolves when the flow has rendered everything it knows about: nodes measured and edges
   * rendered (immediately when that is already the case).
   */
  whenRendered(): Promise<FlowEventMap['render-complete']> {
    return this.renderComplete.whenRendered();
  }

  /** @internal The color mode with `system` resolved. */
  get resolvedColorMode(): 'light' | 'dark' {
    if (this.colorMode === 'system') return this.#systemDark ? 'dark' : 'light';
    return this.colorMode;
  }

  // --- lifecycle -----------------------------------------------------------------------------------

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    if (this.renderRootMode === 'light') {
      this.#typeSheets = this.#collectTypeSheets();
      adoptInto(this.getRootNode() as Document | ShadowRoot, [
        ...(this.unstyled ? baseSheets : defaultSheets),
        ...this.#typeSheets,
        ...this.#userSheets,
      ]);
      return this;
    }
    const root = super.createRenderRoot() as ShadowRoot;
    this.#typeSheets = this.#collectTypeSheets();
    root.adoptedStyleSheets = [
      ...new Set([
        ...(this.unstyled ? baseSheets : defaultSheets),
        ...this.#typeSheets,
        ...this.#userSheets,
      ]),
    ];
    return root;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // properties set on the element before it was upgraded shadow our accessors
    const own = this as unknown as Record<string, unknown>;
    for (const key of ['nodes', 'edges', 'source', 'fitView']) {
      if (Object.prototype.hasOwnProperty.call(own, key)) {
        const value = own[key];
        delete own[key];
        own[key] = value;
      }
    }
    this.#ensureStore();
    if (this.renderRootMode === 'light') this.#lightSlots.connect();
    this.#watchColorScheme();
    this.#needsInit = true;
    if (this.hasUpdated) this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#mql?.removeEventListener('change', this.#onColorScheme);
    this.#mql = null;
    this.#wheelCleanup?.();
    this.#wheelCleanup = null;
    this.#wheelTarget = null;
    this.#lightSlots.disconnect();
    this.measure.stop();
    this.containerSize.disconnect();
    this.hub.detach();
    const store = this.#store;
    if (store) {
      store.setState({ domNode: null });
      store.source.detach?.();
      if (!this.#ownsStore) store.setHost(null);
    }
    this.#provider?.detachFlow(this);
    this.#provider = undefined;
    this.#provided = undefined;
    this.#needsInit = true;
  }

  /**
   * Ask the ancestors for a provider (`<xy-flow-provider>`) right now. A `ContextConsumer` would
   * only answer the first connection, but a moved flow has to find its provider again (or notice
   * that there is none any more).
   */
  #requestProvider(): FlowContextValue | undefined {
    let found: FlowContextValue | undefined;
    this.dispatchEvent(
      new FlowContextRequestEvent(flowContext, this, (value) => {
        found = value;
      }),
    );
    return found;
  }

  #ensureStore(): void {
    this.#provided = this.#requestProvider();
    const provided = this.#provided;
    // a provider owns the store and we configure it; a second flow under it keeps its own
    const provider = provided?.provider;
    const useProvided = !!provided?.store && (!provider || provider.attachFlow(this));
    if (useProvided && provided) {
      if (this.#store !== provided.store) {
        this.#store = provided.store;
        this.#ownsStore = false;
      }
      this.#provider = provider;
      const options = this.#collectOptions();
      // data given to the element goes into the shared store (an empty assignment changes nothing)
      if (this.#initialNodes.length > 0) options.nodes = this.#initialNodes;
      if (this.#initialEdges.length > 0) options.edges = this.#initialEdges;
      this.#store.setOptions(options);
      if (this.#pendingSource) {
        this.#store.setSource(this.#pendingSource);
        this.#pendingSource = null;
      }
      if (this.fitViewOnInit) void this.#store.fitView(this.fitViewOptions);
    } else if (!this.#store || !this.#ownsStore) {
      const options = this.#collectOptions();
      this.#store = new FlowStore({
        ...options,
        nodes: this.#initialNodes,
        edges: this.#initialEdges,
        fitView: this.fitViewOnInit,
      });
      this.#ownsStore = true;
      if (this.#pendingSource) {
        this.#store.setSource(this.#pendingSource);
        this.#pendingSource = null;
      }
    } else {
      // reconnecting with our own store
      this.#store.source.attach?.(this.#store);
    }
    const store = this.#store;
    store.setHost(this);
    for (const controller of this.#controllers()) controller.setStore(store);
    this.hub.attach(store);
    this.renderComplete.attach(store);
    this.#providerValue.setValue({
      store,
      instance: store.instance,
      flow: this,
      hub: this.hub,
      measure: this.measure,
    });
    this.#refreshTypes();
  }

  #controllers(): StoreController<unknown>[] {
    return [
      this.visibleNodes,
      this.layoutedEdges,
      this.markers,
      this.connection,
      this.selection,
      this.a11y,
      this.interaction,
      this.nodeState,
      this.edgeState,
      this.toolbarViewport,
    ] as StoreController<unknown>[];
  }

  /** Current values of the properties that map 1:1 onto store options. */
  #collectOptions(keys: readonly string[] = STORE_OPTION_KEYS): Partial<FlowOptions> {
    const source = this as unknown as Record<string, unknown>;
    const options: Record<string, unknown> = {};
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined) options[key] = value;
    }
    if (options.flowId === undefined) {
      options.flowId =
        this.renderRootMode === 'light' ? `xy-flow-${++lightFlowCounter}` : DEFAULTS.flowId;
    }
    if ('snapGrid' in options) options.snapToGrid = this.snapToGrid;
    return options;
  }

  #refreshTypes(): void {
    this.#mergedNodeTypes = { ...builtinNodeTypes, ...this.nodeTypes };
    this.#mergedEdgeTypes = { ...builtinEdgeTypes, ...this.edgeTypes };
    this.#typeSheets = this.#collectTypeSheets();
    this.#applyStyles();
  }

  #watchColorScheme(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    this.#mql?.removeEventListener('change', this.#onColorScheme);
    this.#mql = window.matchMedia('(prefers-color-scheme: dark)');
    this.#systemDark = this.#mql.matches;
    this.#mql.addEventListener('change', this.#onColorScheme);
  }

  readonly #onColorScheme = (event: MediaQueryListEvent): void => {
    this.#systemDark = event.matches;
    this.requestUpdate();
  };

  protected override willUpdate(changed: PropertyValues<this>): void {
    const store = this.#store;
    if (!store) return;

    if (changed.has('nodeTypes') || changed.has('edgeTypes')) this.#refreshTypes();
    else if (changed.has('unstyled')) this.#applyStyles();

    // also runs on the first update, where properties set before the element was upgraded arrive
    const keys = STORE_OPTION_KEYS.filter((key) => (changed as Map<PropertyKey, unknown>).has(key));
    if (keys.length > 0) store.setOptions(this.#collectOptions(keys));

    if (changed.has('viewport') && this.#controlledViewport) {
      this.panZoomCtl.syncViewport(this.#controlledViewport);
    }
    if (KEY_PROPS.some((key) => changed.has(key))) this.keys.update();
  }

  /** Attach or detach the wheel-scroll listener according to `wheel-scroll-detection`. */
  #syncWheel(): void {
    const target = this.wheelScrollDetection === 'off' ? null : (this.nodesRef.value ?? null);
    if (target === this.#wheelTarget) return;
    this.#wheelCleanup?.();
    this.#wheelCleanup = target ? attachWheelDetection(target) : null;
    this.#wheelTarget = target;
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.#syncWheel();
    if (this.renderRootMode === 'light') this.#lightSlots.project();
    if (this.#needsInit) {
      this.#needsInit = false;
      this.#init();
    } else if (PANZOOM_PROPS.some((key) => changed.has(key))) {
      this.panZoomCtl.update();
    }
  }

  #init(): void {
    const store = this.#store;
    const wrapper = this.wrapperRef.value;
    const zoom = this.zoomRef.value;
    const viewport = this.viewportRef.value;
    if (!store || !wrapper || !zoom || !viewport) return;
    store.setState({ domNode: wrapper });
    this.measure.start(store);
    this.containerSize.observe(store, wrapper);
    this.panZoomCtl.init(zoom, viewport);
    this.#everInitialized = true;
    if (!wrapper.clientHeight) {
      store.reportError('004', errorMessages.error004());
    }
  }

  /** @internal Viewport to start the pan/zoom engine with. */
  get initialViewport(): Viewport {
    if (this.#controlledViewport) return this.#controlledViewport;
    if (this.#everInitialized && this.#store) {
      const [x, y, zoom] = this.#store.getState().transform;
      return { x, y, zoom };
    }
    return this.defaultViewport ?? { x: 0, y: 0, zoom: 1 };
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.#store) return nothing;
    // touch the controllers whose values are only used for their update trigger
    void this.interaction.value;
    void this.nodeState.value;
    void this.edgeState.value;
    void this.toolbarViewport.value;
    void this.labelsVersion;
    const classes = this.pane.paneClasses;
    return html`<div
      ${ref(this.wrapperRef)}
      class="lit-flow lit-flow__container xy-flow ${this.resolvedColorMode}"
      data-testid="rf__wrapper"
      role="application"
      @scroll=${resetScroll}
    >
      <div ${ref(this.zoomRef)} class="lit-flow__renderer lit-flow__zoom lit-flow__container">
        <div
          ${ref(this.paneRef)}
          class="lit-flow__pane lit-flow__container ${classes}"
          part="pane"
          @pointerdown=${this.pane.onPointerDownCapture}
          @pointermove=${this.pane.onPointerMove}
          @pointerup=${this.pane.onPointerUp}
          @pointercancel=${this.pane.onPointerCancel}
          @click=${this.pane.onClick}
          @contextmenu=${this.pane.onContextMenu}
          @wheel=${this.pane.onWheel}
          @pointerenter=${this.pane.onPointerEnter}
          @pointerleave=${this.pane.onPointerLeave}
        >
          <div
            ${ref(this.viewportRef)}
            class="lit-flow__viewport xyflow__viewport lit-flow__container"
            part="viewport"
          >
            <div class="lit-flow__viewport-back lit-flow__container">
              ${slotFor(this, 'viewport-back')}
            </div>
            ${edgesLayer(this)} ${edgeLabelLayer(this)} ${connectionLineLayer(this)}
            ${nodesLayer(this)} ${nodesSelection(this)}
            <div class="lit-flow__viewport-front lit-flow__container">
              ${slotFor(this, 'viewport-front')}
            </div>
          </div>
          ${userSelectionRect(this)}
        </div>
      </div>
      ${nodeToolbarLayer(this)} ${a11yDescriptions(this)} ${attribution(this)}
      ${loadingOverlay(this)} ${slotFor(this)}
    </div>`;
  }
}
