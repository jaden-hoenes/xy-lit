# Migrating from React Flow

XY Lit runs the same engine (`@xyflow/system`) as React Flow and Svelte Flow, and follows React Flow's behaviour wherever
the spec was silent. The vocabulary (nodes, edges, handles, viewport, change objects) is the same; what changes is how you
talk to it: props become attributes and properties, callbacks become events, hooks become controllers.

<Demo name="events" :height="340" caption="Interact with the flow: each event is shown with the React Flow prop it replaces and a summary of its detail." />

## The shape of the API

| React Flow | XY Lit |
|---|---|
| `<ReactFlow nodes={nodes} edges={edges} />` | `<xy-flow>` with `flow.nodes = nodes; flow.edges = edges` |
| scalar props (`fitView`, `minZoom`, `snapToGrid`) | attribute (`fit-view`, `min-zoom`, `snap-to-grid`) **and** property (`fitView`, `minZoom`, `snapToGrid`) |
| object and function props | properties only |
| `onSomething={(event, node) => ...}` | `addEventListener('something', (e) => e.detail.node)`; the event object is `detail.event` |
| `useNodesState` / `useEdgesState` | none: assign once (uncontrolled), or `applyNodeChanges` in a `nodes-change` handler |
| `defaultNodes` / `defaultEdges` | assign `nodes` / `edges` once: the flow owns them afterwards |
| `className`, `style` | `class` and `style` on the element |
| children (`<Background />`, `<Controls />`) | child elements (`<xy-background>`, `<xy-controls>`) |
| hooks | [reactive controllers](/guide/custom-nodes#controllers), or methods on the element |
| `className="nodrag"` and friends | the same classes: `nodrag`, `nopan`, `nowheel` |

## Props to attributes, properties and events

Property names match React's unless noted. Attribute names are kebab-case.

### Data and instance

| React Flow | XY Lit |
|---|---|
| `nodes`, `edges` | properties `nodes`, `edges` |
| `onNodesChange`, `onEdgesChange` | events `nodes-change`, `edges-change` (cancelable: call `preventDefault()` and apply the changes yourself; `detail: { changes, meta }`) |
| `onConnect` | event `connect` (`detail: { connection, edge }`, cancelable; the default action adds the edge) |
| `defaultEdgeOptions` | property `defaultEdgeOptions` |
| `nodeTypes`, `edgeTypes` | properties; entries are `defineNodeType(...)`, `defineEdgeType(...)`, a `FlowNodeElement` class or a tag name |
| `onInit` | event `init` (`detail.instance`) |
| `useReactFlow()` | the element itself (it implements `FlowInstance`) or `flow.instance` |
| `id` | attribute `id` |

### Viewport

| React Flow | XY Lit |
|---|---|
| `fitView`, `fitViewOptions` | attribute `fit-view`; property `fitViewOptions` (also `timeout`) |
| `minZoom`, `maxZoom` | `min-zoom` (0.5), `max-zoom` (2) |
| `defaultViewport`, `viewport` | properties `defaultViewport`, `viewport` |
| `onViewportChange` | event `viewport-change` |
| `onMoveStart`, `onMove`, `onMoveEnd` | events `move-start`, `move`, `move-end` |
| `translateExtent`, `nodeExtent`, `nodeOrigin` | properties of the same names |
| `snapToGrid`, `snapGrid` | `snap-to-grid`, `snap-grid` (`"15 15"`) |
| `onlyRenderVisibleElements` | `only-render-visible-elements` |
| `autoPanOnNodeFocus`, `autoPanOnNodeDrag`, `autoPanOnConnect`, `autoPanSpeed` | `auto-pan-on-node-focus`, `auto-pan-on-node-drag`, `auto-pan-on-connect`, `auto-pan-speed` |
| (none) | `auto-pan-on-selection`: pan while drawing a selection rectangle near the edge |

### Interaction

| React Flow | XY Lit |
|---|---|
| `nodesDraggable`, `nodesConnectable`, `nodesFocusable`, `edgesFocusable`, `elementsSelectable` | `nodes-draggable`, `nodes-connectable`, `nodes-focusable`, `edges-focusable`, `elements-selectable` |
| `edgesReconnectable` | `edges-reconnectable` (**default `false`**) |
| `selectNodesOnDrag` | `select-nodes-on-drag` |
| `elevateNodesOnSelect`, `elevateEdgesOnSelect` | `elevate-nodes-on-select`, `elevate-edges-on-select` |
| `panOnDrag`, `panOnScroll`, `panOnScrollSpeed`, `panOnScrollMode` | `pan-on-drag` (`"true"`, `"false"`, `"0,2"`), `pan-on-scroll`, `pan-on-scroll-speed`, `pan-on-scroll-mode` |
| `zoomOnScroll`, `zoomOnPinch`, `zoomOnDoubleClick` | `zoom-on-scroll`, `zoom-on-pinch`, `zoom-on-double-click` |
| `preventScrolling` | `prevent-scrolling` |
| `selectionOnDrag`, `selectionMode` | `selection-on-drag`, `selection-mode` |
| `paneClickDistance`, `nodeClickDistance`, `nodeDragThreshold`, `connectionDragThreshold` | `pane-click-distance`, `node-click-distance`, `node-drag-threshold`, `connection-drag-threshold` |
| `deleteKeyCode`, `selectionKeyCode`, `multiSelectionKeyCode`, `panActivationKeyCode`, `zoomActivationKeyCode` | `delete-key`, `selection-key`, `multi-selection-key`, `pan-activation-key`, `zoom-activation-key` (`"null"` disables) |
| `noDragClassName`, `noWheelClassName`, `noPanClassName` | `no-drag-class-name`, `no-wheel-class-name`, `no-pan-class-name` |
| `disableKeyboardA11y` | `disable-keyboard-a11y` |

### Connections

| React Flow | XY Lit |
|---|---|
| `connectionMode`, `connectionRadius`, `reconnectRadius`, `connectOnClick` | `connection-mode`, `connection-radius`, `reconnect-radius`, `connect-on-click` |
| `connectionLineType`, `connectionLineStyle`, `connectionLineContainerStyle` | `connection-line-type`, `connection-line-style`, `connection-line-container-style` (CSS strings) |
| `connectionLineComponent` | property `connectionLineRenderer` (a function returning an SVG template) |
| `isValidConnection` | property `isValidConnection` |
| `onConnectStart`, `onConnectEnd` | events `connect-start`, `connect-end` |
| `onClickConnectStart`, `onClickConnectEnd` | events `click-connect-start`, `click-connect-end` |
| `onReconnect`, `onReconnectStart`, `onReconnectEnd` | events `reconnect` (cancelable), `reconnect-start`, `reconnect-end` |
| `onBeforeDelete`, (`onBeforeConnect`) | properties `onBeforeDelete`, `onBeforeConnect`, `onBeforeReconnect` |

### Events

| React Flow | XY Lit event | `detail` |
|---|---|---|
| `onNodeClick`, `onNodeDoubleClick`, `onNodeContextMenu` | `node-click`, `node-double-click`, `node-context-menu` | `{ event, node }` |
| `onNodeMouseEnter`, `onNodeMouseMove`, `onNodeMouseLeave` | `node-pointer-enter`, `node-pointer-move`, `node-pointer-leave` | `{ event: PointerEvent, node }` |
| `onNodeDragStart`, `onNodeDrag`, `onNodeDragStop` | `node-drag-start`, `node-drag`, `node-drag-stop` | `{ event, node, nodes }` |
| `onSelectionDragStart`, `onSelectionDrag`, `onSelectionDragStop` | `selection-drag-start`, `selection-drag`, `selection-drag-stop` | `{ event, nodes }` |
| `onSelectionStart`, `onSelectionEnd` | `selection-start`, `selection-end` | `{ event }` |
| `onSelectionContextMenu`, (selection click) | `selection-context-menu`, `selection-click` | `{ event, nodes }` |
| `onSelectionChange` | `selection-change` | `{ nodes, edges }` |
| `onEdgeClick`, `onEdgeDoubleClick`, `onEdgeContextMenu` | `edge-click`, `edge-double-click`, `edge-context-menu` | `{ event, edge }` |
| `onEdgeMouseEnter`, `onEdgeMouseMove`, `onEdgeMouseLeave` | `edge-pointer-enter`, `edge-pointer-move`, `edge-pointer-leave` | `{ event, edge }` |
| `onPaneClick`, `onPaneContextMenu`, `onPaneScroll` | `pane-click`, `pane-context-menu`, `pane-scroll` | `{ event }` |
| `onPaneMouseEnter`, `onPaneMouseMove`, `onPaneMouseLeave` | `pane-pointer-enter`, `pane-pointer-move`, `pane-pointer-leave` | `{ event }` |
| `onNodesDelete`, `onEdgesDelete`, `onDelete` | `nodes-delete`, `edges-delete`, `delete` | `{ nodes }`, `{ edges }`, `{ nodes, edges }` |
| `onError` | `flow-error` | `{ code, message }` (cancelable) |
| `useNodesInitialized()` | event `nodes-initialized`, or `NodesInitializedController` | `{ nodes }` |
| (none) | `render-complete`, `flow.whenRendered()` | `{ revision, nodeCount, edgeCount, durationMs }` |

Mouse events on nodes, edges and the pane are **pointer** events here (`*-pointer-*`). The flow only does the work for a
pointer or move event when someone listens.

### Appearance and misc

| React Flow | XY Lit |
|---|---|
| `colorMode` | `color-mode` (`light`, `dark`, `system`) |
| `defaultMarkerColor` | `default-marker-color` |
| `proOptions.hideAttribution` | `hide-attribution` (please keep the attribution if you can); `attribution-position` |
| `ariaLabelConfig` | property `ariaLabelConfig` |
| `zIndexMode`, `elevateEdgesOnSelect` | `z-index-mode`, `elevate-edges-on-select` |
| (none) | `unstyled`, `render-root`, `motion`, `motion-max-nodes`, `parallel-edges`, `parallel-edge-gap`, `loading`, `no-loading-overlay`, `history-keys`, `wheel-scroll-detection`, `debug` |

## Components and hooks

| React Flow | XY Lit |
|---|---|
| `<Background>` | `<xy-background variant="dots">` |
| `<Controls>` | `<xy-controls>`, with `<xy-control-button slot="after">` |
| `<MiniMap>` | `<xy-minimap pannable zoomable>`; `.nodeColor`, `.nodeRenderer` |
| `<Panel position>` | `<xy-panel position>` (default `top-right`, not `top-left`) |
| `<Handle>` | `<xy-handle type position handle-id>` |
| `<NodeToolbar>` | `nodeToolbar(options, content)` directive |
| `<NodeResizer>`, `<NodeResizeControl>` | `<xy-node-resizer>`, `<xy-resize-control>`; `defineNodeType({ resizer })` |
| `<EdgeLabelRenderer>` | `edgeLabel(flow, options, content)` returned as the edge's `label` |
| `<BaseEdge>`, `EdgeText` | `baseEdge(options)`, `edgeText(...)` |
| `<ViewportPortal>` | `<xy-viewport-portal target="front">` |
| `<ReactFlowProvider>` | `<xy-flow-provider>` |
| `useReactFlow` | the element, `FlowInstanceController` |
| `useNodes`, `useEdges`, `useViewport` | `NodesController`, `EdgesController`, `ViewportController` |
| `useStore`, `useStoreApi` | `StoreController`, `StoreApiController` |
| `useNodeId` | `NodeIdController`, or `this.nodeId` in a `FlowNodeElement` |
| `useNodeConnections`, `useHandleConnections` | `NodeConnectionsController`, `HandleConnectionsController` |
| `useNodesData`, `useInternalNode` | `NodesDataController`, `InternalNodeController` |
| `useConnection` | `ConnectionController` |
| `useKeyPress` | `KeyPressController` |
| `useOnSelectionChange`, `useOnViewportChange` | `OnSelectionChangeController`, `OnViewportChangeController` |
| `useUpdateNodeInternals` | `flow.updateNodeInternals(ids)` |
| `applyNodeChanges`, `applyEdgeChanges`, `addEdge`, `reconnectEdge`, `getIncomers`, `getOutgoers`, `getConnectedEdges`, `getBezierPath`, ... | the same functions, from `@xy-lit/flow` |

## Differences worth knowing

- **Rendering a node.** A node type is a Lit render function or a custom element, not a React component. Everything
  renders in one shadow tree: page CSS does not reach nodes, use `styles`, `adoptStyles()` or CSS variables
  ([theming](/guide/theming)). Custom node types draw their own border and background.
- **`node.style` and `edge.style` are CSS strings**, `class` replaces `className`.
- **`edge.label` is text.** For markup use a custom edge with `edgeLabel`. Edges also have `startLabel` and `endLabel`, and
  custom markers (`{ type: 'custom', path }`).
- **Controlled mode uses a cancelable event**, not a callback that replaces state: call `preventDefault()` in
  `nodes-change` and `edges-change`, and apply `dimensions` changes.
- **Dimensions.** Measurement lives in `node.measured`, as in React Flow 12.
- **Defaults that differ**: `<xy-panel>` is `top-right`; `edges-reconnectable` is `false`; `<xy-node-resizer>` shows only
  while the node is selected (unless `is-visible`); the attribution link is darker for contrast.
- **Extras**: `render-complete` and `whenRendered()`, `motion`, `parallel-edges`, a loading overlay, `addNodes` with
  automatic placement, Mod+Z undo hooks, light render root, `adoptStyles`, collaboration through `flow.source`.
- **Keyboard**: Escape on a focused edge unselects only that edge (React also unselects every node).
- **Reconnect anchors work with touch**; React's are mouse-only.
- **Not ported**: server-side rendering of flows, the `@xyflow/react` `proOptions` licence switch, React-specific
  `ReactFlowProvider` initial state props (use `<xy-flow-provider>`), and the Svelte stores.
