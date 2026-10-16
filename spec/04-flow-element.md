# 04 · `<xy-flow>`

`XyFlowElement extends LitElement` in `packages/flow/src/elements/xy-flow.ts`. It owns one
`FlowStore` (or borrows one from `<xy-flow-provider>`), provides context, renders every
layer, and wires the engine. References: Svelte `container/SvelteFlow/*`, `container/Zoom`,
`container/Pane`, `container/Viewport`; React `container/ReactFlow`, `container/ZoomPane`,
`container/Pane`, `container/FlowRenderer`.

## Host styles

```css
:host { display: block; position: relative; overflow: hidden; contain: layout paint; min-height: 0; }
:host([hidden]) { display: none; }
```

Like React Flow, the flow needs a sized container. In dev, if the host's `clientHeight` is 0
after first layout, report error `'004'` (upstream message) through `reportError`.

## Properties and attributes

Attribute names are given where one exists. "Prop" means property-only. Defaults are React
Flow's (00-decisions lists deviations). Boolean attributes defaulting to `true` use
`booleanAttr(true)` (`"false"` turns them off).

| Property | Attribute | Type | Default |
|---|---|---|---|
| `nodes` | prop | `N[]` | `[]` (getter returns `store.getState().nodes`) |
| `edges` | prop | `E[]` | `[]` |
| `source` | prop | `FlowDataSource \| null` | null (ArraySource) |
| `nodeTypes` / `edgeTypes` | prop | `NodeTypes` / `EdgeTypes` | built-ins (merged, user wins) |
| `defaultEdgeOptions` | prop | `DefaultEdgeOptions` | undefined |
| `flowId` | `id` | string | `id` attribute, else `'1'` (shadow) or `xy-flow-<n>` (light) |
| `fitView` | `fit-view` | boolean | false |
| `fitViewOptions` | prop | `FitViewOptions` | undefined |
| `minZoom` / `maxZoom` | `min-zoom` / `max-zoom` | number | 0.5 / 2 |
| `defaultViewport` | prop | Viewport | `{x:0,y:0,zoom:1}` |
| `viewport` | prop | Viewport \| undefined | controlled viewport (see §Controlled viewport) |
| `translateExtent` / `nodeExtent` | prop | CoordinateExtent | infinite |
| `nodeOrigin` | prop | NodeOrigin | `[0,0]` |
| `snapToGrid` | `snap-to-grid` | boolean | false |
| `snapGrid` | `snap-grid` ("15 15") | SnapGrid | `[15,15]` |
| `onlyRenderVisibleElements` | `only-render-visible-elements` | boolean | false |
| `nodesDraggable` | `nodes-draggable` | boolean | true |
| `nodesConnectable` | `nodes-connectable` | boolean | true |
| `nodesFocusable` | `nodes-focusable` | boolean | true |
| `edgesFocusable` | `edges-focusable` | boolean | true |
| `edgesReconnectable` | `edges-reconnectable` | boolean | **false** |
| `elementsSelectable` | `elements-selectable` | boolean | true |
| `selectNodesOnDrag` | `select-nodes-on-drag` | boolean | true |
| `elevateNodesOnSelect` / `elevateEdgesOnSelect` | `elevate-nodes-on-select` / `elevate-edges-on-select` | boolean | true / false |
| `autoPanOnNodeFocus` / `autoPanOnNodeDrag` / `autoPanOnConnect` / `autoPanOnSelection` | `auto-pan-on-…` | boolean | true |
| `autoPanSpeed` | `auto-pan-speed` | number | 15 |
| `panOnDrag` | `pan-on-drag` ("true" / "false" / "0,2") | `boolean \| number[]` | true |
| `panOnScroll` | `pan-on-scroll` | boolean | false |
| `panOnScrollSpeed` | `pan-on-scroll-speed` | number | 0.5 |
| `panOnScrollMode` | `pan-on-scroll-mode` | `'free' \| 'vertical' \| 'horizontal'` | free |
| `zoomOnScroll` / `zoomOnPinch` / `zoomOnDoubleClick` | `zoom-on-…` | boolean | true |
| `preventScrolling` | `prevent-scrolling` | boolean | true |
| `selectionOnDrag` | `selection-on-drag` | boolean | false |
| `selectionMode` | `selection-mode` | `'full' \| 'partial'` | full |
| `paneClickDistance` / `nodeClickDistance` | `pane-click-distance` / `node-click-distance` | number | 1 / 0 |
| `nodeDragThreshold` / `connectionDragThreshold` | `node-drag-threshold` / `connection-drag-threshold` | number | 1 / 1 |
| `connectionRadius` / `reconnectRadius` | `connection-radius` / `reconnect-radius` | number | 20 / 10 |
| `connectionMode` | `connection-mode` | `'strict' \| 'loose'` | strict |
| `connectionLineType` | `connection-line-type` | `'default' \| 'straight' \| 'step' \| 'smoothstep' \| 'simplebezier'` | default |
| `connectionLineStyle` / `connectionLineContainerStyle` | `connection-line-style` / `connection-line-container-style` | string | undefined |
| `connectionLineRenderer` | prop | ConnectionLineRenderer | undefined |
| `connectOnClick` | `connect-on-click` | boolean | true |
| `deleteKey` | `delete-key` | KeyCode \| null | `'Backspace'` |
| `selectionKey` | `selection-key` | KeyCode \| null | `'Shift'` |
| `multiSelectionKey` | `multi-selection-key` | KeyCode \| null | `'Meta'` on macOS else `'Control'` |
| `panActivationKey` | `pan-activation-key` | KeyCode \| null | `'Space'` |
| `zoomActivationKey` | `zoom-activation-key` | KeyCode \| null | `'Meta'` on macOS else `'Control'` |
| `colorMode` | `color-mode` | ColorMode | light |
| `defaultMarkerColor` | `default-marker-color` | string \| null | `#b1b1b7` |
| `noDragClassName` / `noWheelClassName` / `noPanClassName` | `no-drag-class-name` / … | string | nodrag / nowheel / nopan |
| `attributionPosition` | `attribution-position` | PanelPosition | bottom-right |
| `hideAttribution` | `hide-attribution` | boolean | false |
| `ariaLabelConfig` | prop | `Partial<AriaLabelConfig>` | upstream |
| `disableKeyboardA11y` | `disable-keyboard-a11y` | boolean | false |
| `zIndexMode` | `z-index-mode` | `'basic' \| 'auto' \| 'manual'` | basic |
| `renderRoot` | `render-root` | `'shadow' \| 'light'` | shadow (read once, before first render) |
| `unstyled` | `unstyled` | boolean | false (true = upstream `base.css` instead of `style.css`) |
| `parallelEdges` / `parallelEdgeGap` | `parallel-edges` / `parallel-edge-gap` | ParallelEdges / number | off / 12 |
| `motion` / `motionMaxNodes` | `motion` / `motion-max-nodes` | MotionMode / number | off / 300 |
| `wheelScrollDetection` | `wheel-scroll-detection` | WheelScrollDetection | auto |
| `noLoadingOverlay` / `loading` | `no-loading-overlay` / `loading` | boolean | false / false |
| `historyKeys` | `history-keys` | `'on' \| 'off'` | on |
| `debug` | `debug` | boolean | false |
| `isValidConnection`, `onBeforeDelete`, `onBeforeConnect`, `onBeforeReconnect`, `getEdgeId` | prop | functions | undefined |

Attribute converters (`elements/xy-flow/attributes.ts`): `booleanAttr(default)`,
`numberAttr`, `numberPairAttr` ("15 15" or "15,15"), `panOnDragAttr`, `keyCodeAttr`
(`"null"` or empty → null; contains `,` → array; else string; `"Space"` and `" "` both mean
space), `enumAttr(values, default)` (invalid → default + dev warning).

Enumerations accept upstream enum values (`ConnectionLineType.Bezier === 'default'`, etc.).

### `nodes` / `edges` / `source` setters

```ts
set nodes(v: N[]) {
  const src = this.store.source;
  if (src instanceof ArraySource) src.replaceNodes(v);
  else this.store.instance.setNodes(v);       // diff → replace/add/remove changes into the source
}
get nodes() { return this.store.getState().nodes; }
```

Same for `edges`. `source` setter calls `store.setSource(v)`.

**Upgrade safety:** in `connectedCallback`, for `nodes`, `edges`, `source`, `nodeTypes`,
`edgeTypes`, `viewport` and every function property: if
`Object.prototype.hasOwnProperty.call(this, key)`, read it, `delete this[key]`, and assign it
again so it goes through the accessor (properties set before the element upgraded).

### Options flow

`willUpdate(changed)` collects every changed option property into one object and calls
`store.setOptions(options)`. Name mapping: element property → store field is 1:1 except
`noDragClassName → noDragClassName` (same), `flowId → flowId`, `snapToGrid`/`snapGrid` as
in `03-store.md`. Key properties go to `FlowKeysController`, pan/zoom properties to
`PanZoomController.update()`. `colorMode` resolves through `matchMedia('(prefers-color-scheme: dark)')`
when `system` (listener added in connectedCallback, removed in disconnectedCallback; this is
a `MediaQueryList` listener, not a document listener).

## Events

All event names and details are in `02-types.md` §Event details. Dispatch through
`store.emit` (the element implements `FlowHost.emit`):

```ts
emit(type, detail, cancelable = false) {
  const ev = new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable });
  return this.dispatchEvent(ev);   // false when prevented
}
```

Default actions of cancelable events:

| Event | Default action when not prevented |
|---|---|
| `nodes-change` / `edges-change` | source applies the changes |
| `connect` | `edge = onBeforeConnect?.(connection) ?? connection`; if falsy, stop; otherwise add `{ id: getEdgeId(connection), ...defaultEdgeOptions, ...edge }` through `triggerEdgeChanges([{type:'add', item}], { phase: 'discrete', origin: 'connect' })` |
| `reconnect` | `newEdge = onBeforeReconnect?.({ ...oldEdge, ...connection }, oldEdge) ?? merged`; if truthy, `replace` change with `origin: 'reconnect'` |
| `flow-error` | `console.warn` (dev builds only; `import.meta.env.DEV` or `process.env.NODE_ENV !== 'production'`) |

The `connect` detail includes the `edge` that would be added, so a controlled app can
`preventDefault()` and add `e.detail.edge` itself (equivalent to React's `addEdge(connection)`).

## Methods

`XyFlowElement` implements every `FlowInstance` method (02-types) by forwarding to
`this.store.instance`, plus:

- `get instance(): FlowInstance` — the stable instance object.
- `get store(): FlowStore` — escape hatch.
- `adoptStyles(...sheets: (CSSStyleSheet | CSSResult)[]): void` — appended to the render
  root's `adoptedStyleSheets` (dedupe by identity).
- `whenRendered(): Promise<FlowEventMap['render-complete']>` — resolves on the next
  `render-complete` (or immediately with the last detail if the current revision is complete).

## Lifecycle

`constructor`: create `ContextConsumer` for `flowContext` (from a provider ancestor) with
`subscribe: false`; create controllers (below); set defaults.

`connectedCallback`:
1. `super.connectedCallback()`; upgrade properties.
2. If no provider answered, `this.store = new FlowStore(initialOptionsFromProperties)`.
   With a provider, `this.store = provided.store` and `store.setOptions(...)`.
3. `store.setHost(this)`; create `ContextProvider(this, { context: flowContext, initialValue: { store, instance } })`.
4. Register styles for node/edge types (§Styles).

`createRenderRoot()`: `renderRoot === 'light'` → return `this` and adopt base sheets into
`this.getRootNode()` (`document` or enclosing shadow root) once per root; else
`this.attachShadow({ mode: 'open' })` and adopt base sheets + type sheets.

`firstUpdated()`:
1. `store.setState({ domNode: this.wrapperEl })`.
2. `PanZoomController.init(this.zoomEl)` (§Pan/zoom).
3. `MeasureController.start()`; `ContainerSizeController.observe(this.wrapperEl)`.
4. Dev check for missing height.

`disconnectedCallback`: destroy XYPanZoom, disconnect observers, unsubscribe keyboard,
`store.setHost(null)` (provider-owned store) or `store.setSource(null)`'s old source
`detach()` (own store). Re-connecting (moving the element) must work: `connectedCallback`
re-creates what `disconnectedCallback` destroyed; `firstUpdated` logic runs again through a
`#needsInit` flag checked in `updated()`.

## Render tree

`render()` returns (shadow mode; light mode identical, classes unchanged):

```html
<div class="lit-flow lit-flow__container xy-flow ${colorModeClass}"   ← wrapperEl, store.domNode
     data-testid="rf__wrapper" role="application"
     aria-roledescription=${ariaLabelConfig['…'] ?? nothing}
     @scroll=${resetScroll}>
  <div class="lit-flow__renderer lit-flow__zoom lit-flow__container">  ← zoomEl: XYPanZoom domNode
    <div class="lit-flow__pane lit-flow__container ${paneClasses}"     ← paneEl: PaneController
         part="pane">
      <div class="lit-flow__viewport xyflow__viewport lit-flow__container" part="viewport">  ← viewportEl
        <div class="lit-flow__viewport-back lit-flow__container"><slot name="viewport-back"></slot></div>
        ${edgesLayer()}            <div class="lit-flow__edges lit-flow__container">…</div>
        ${edgeLabelLayer()}        <div class="lit-flow__edgelabel-renderer">…</div>
        ${connectionLine()}        <svg class="lit-flow__connectionline lit-flow__container">…</svg>
        ${nodesLayer()}            <div class="lit-flow__nodes">…</div>
        ${nodesSelection()}        <div class="lit-flow__nodesselection lit-flow__container nopan">…</div>
        <div class="lit-flow__viewport-front lit-flow__container"><slot name="viewport-front"></slot></div>
      </div>
      ${userSelectionRect()}       <div class="lit-flow__selection lit-flow__container">
    </div>
  </div>
  ${nodeToolbarLayer()}            <div class="lit-flow__node-toolbars">…</div>
  ${a11yDescriptions()}
  ${attribution()}
  ${loadingOverlay()}
  <slot></slot>                     ← <xy-background>, <xy-controls>, <xy-minimap>, <xy-panel>, …
</div>
```

`resetScroll(e)`: `e.currentTarget.scrollTo({ top: 0, left: 0 })` (Svelte Wrapper behaviour:
focusing an off-screen node must not scroll the wrapper).

**The viewport transform is never a template binding.** `PanZoomController` writes
`viewportEl.style.transform = translate(${x}px, ${y}px) scale(${zoom})` directly on every
`onTransformChange`, and once in `firstUpdated` from the initial viewport. This keeps panning
out of Lit's update cycle.

Each layer is a separate method in `elements/xy-flow/templates.ts`, and each layer's data comes
from `StoreController`s owned by `<xy-flow>` with these selectors (equality in brackets):

| Controller | Selector | Equality |
|---|---|---|
| `visibleNodes` | `s => store.getVisibleNodes()` | `===` (memoised array) |
| `layoutedEdges` | `s => store.getLayoutedEdges()` | `===` |
| `markers` | `s => store.getMarkerDefs()` | `===` |
| `nodeRenderCtx` | builds `NodeRenderContext` (05) from flags | shallow |
| `edgeRenderCtx` | builds `EdgeRenderContext` (07) | shallow |
| `connection` | `s => s.connection` | `===` |
| `selection` | `s => [s.userSelectionActive, s.userSelectionRect, s.nodesSelectionActive, s.lookupVersion]` | shallow |
| `viewportForToolbars` | `s => s.transform` | `===` (only subscribed while any toolbar is registered) |
| `a11y` | `s => [s.ariaLabelConfig, s.ariaLiveMessage, s.disableKeyboardA11y, s.flowId]` | shallow |
| `colorMode` | resolved color mode | `===` |

Lit re-renders the element when any of them changes; each layer template is cheap when its
inputs are unchanged because `repeat()` diffs by key and child elements receive identical
values.

### Nodes layer

```ts
html`<div class="lit-flow__nodes">${repeat(visibleNodes, (n) => n.id, (n) => html`
  <xy-node .node=${n} .px=${n.internals.positionAbsolute.x} .py=${n.internals.positionAbsolute.y}
           .z=${n.internals.z} .ctx=${nodeRenderCtx}></xy-node>`)}</div>`
```

`px`, `py`, `z` are separate primitives because the engine sometimes mutates
`internals.positionAbsolute`/`z` in place (see 03-store §Visible elements).

### Edges layer

```ts
html`<div class="lit-flow__edges lit-flow__container">
  <svg class="lit-flow__marker"><defs>${markerDefs(markers)}</defs></svg>
  ${repeat(layoutedEdges.values(), (e) => e.id, (e) => html`<xy-edge .edge=${e} .ctx=${edgeRenderCtx}></xy-edge>`)}
</div>`
```

### Edge label layer

`<xy-edge>` does not render HTML labels itself. Each `<xy-edge>` publishes its
`EdgeRenderResult` labels to `store.edgeLabels: Map<edgeId, LabelEntry>` (a plain map on the
flow element, not store state) and calls `this.requestLabelLayerUpdate()` on the flow (rAF
coalesced). The label layer renders:

```ts
html`<div class="lit-flow__edgelabel-renderer">${repeat(labelEntries, (l) => l.key, (l) => l.template)}</div>`
```

`LabelEntry = { key: `${edgeId}:${'center'|'start'|'end'}`, template: TemplateResult }`.
Built-in label templates position themselves with `transform: translate(-50%, -50%)
translate(${x}px, ${y}px)` (see 07). On edge removal, `<xy-edge>.disconnectedCallback`
deletes its entries.

### Connection line, selection, toolbars, a11y, attribution, loading

- Connection line: `06-handles-connections.md` §Connection line.
- User selection rect: rendered when `userSelectionActive && userSelectionRect`:
  `<div class="lit-flow__selection lit-flow__container" style="width:…;height:…;transform:translate(x,y)">`.
- Nodes selection (React `NodesSelection`): when `nodesSelectionActive` and selected-node bounds
  (`getInternalNodesBounds(nodeLookup, { filter: n => !!n.selected })`) have positive size:
  outer `div.lit-flow__nodesselection.lit-flow__container.${noPanClassName}` with
  `transform: translate(${x}px,${y}px)`; inner `div.lit-flow__nodesselection-rect` with width/height,
  `tabindex=-1` (unless keyboard a11y disabled), keydown → arrows call `moveSelectedNodes`,
  click → `selection-click`, contextmenu → `selection-context-menu`. An `XYDrag` instance is
  attached to the inner rect in `updated()` (same params as nodes but no `nodeId`), destroyed
  when the rect unmounts. Focus the rect (`preventScroll`) when it appears and a11y is on.
- Node toolbar layer: `05-nodes.md` §Node toolbar.
- A11y descriptions (React `A11yDescriptions`): two hidden divs with ids
  `${ARIA_NODE_DESC_KEY}-${flowId}` and `${ARIA_EDGE_DESC_KEY}-${flowId}` and the
  `aria-live="assertive"` region `${ARIA_LIVE_MESSAGE}-${flowId}` showing `ariaLiveMessage`.
- Attribution unless `hideAttribution`: `<div class="lit-flow__panel lit-flow__attribution ${pos}">`
  `<a href="https://xyflow.com" target="_blank" rel="noopener noreferrer">XY Lit · xyflow</a></div>`.
- Loading overlay: `10-styles-theming.md` §Loading overlay; visible while
  `!noLoadingOverlay && (loading || !firstRenderComplete)`.

## Controllers owned by `<xy-flow>`

All live in `elements/xy-flow/` and implement `ReactiveController`.

### `PanZoomController` (Svelte `actions/zoom` + React `ZoomPane`)

`init(zoomEl)`:

```ts
const { minZoom, maxZoom, translateExtent } = store.getState();
const initial = host.viewport ?? host.defaultViewport ?? { x: 0, y: 0, zoom: 1 };
this.panZoom = XYPanZoom({
  domNode: zoomEl, minZoom, maxZoom, translateExtent, viewport: initial,
  onDraggingChange: (paneDragging) => store.setState({ paneDragging }),
  onPanZoomStart: (event, viewport) => host.emit('move-start', { event, viewport }),
  onPanZoom: (event, viewport) => host.emit('move', { event, viewport }),
  onPanZoomEnd: (event, viewport) => host.emit('move-end', { event, viewport }),
});
const vp = this.panZoom.getViewport();
this.applyTransform(vp);
store.setState({ panZoom: this.panZoom, transform: [vp.x, vp.y, vp.zoom] });
this.update();                       // pushes PanZoomUpdateOptions
host.emit('init', { instance: store.instance });   // once per element lifetime
if (state.fitViewQueued && state.nodesInitialized) store.resolveFitView();
```

`update()` runs from `hostUpdated()` and whenever key-activation flags change. It calls
`panZoom.update({...})` with exactly the Svelte zoom-action parameters:
`noWheelClassName, noPanClassName, onPaneContextMenu: undefined, preventScrolling, panOnScroll: panOnScroll || panActivationKeyPressed,
panOnDrag: panOnDrag || panActivationKeyPressed, panOnScrollMode, panOnScrollSpeed, userSelectionActive,
zoomOnPinch, zoomOnScroll, zoomOnDoubleClick, zoomActivationKeyPressed, lib: 'lit', onTransformChange,
connectionInProgress: state.connection.inProgress, paneClickDistance, selectionOnDrag`.

`onTransformChange(t)`: `applyTransform({x:t[0], y:t[1], zoom:t[2]})` (direct style write),
`store.setViewportFromPanZoom(...)`, and if `viewport` is controlled, emit
`viewport-change` with the new viewport.

### Controlled viewport

If the app sets `.viewport`, `PanZoomController` calls `panZoom.syncViewport(viewport)` when it
differs from the current transform (port `useViewportSync.ts`). The app keeps it in sync by
listening to `viewport-change`. Without `.viewport`, the element is uncontrolled and
`viewport` returns the current transform as a Viewport.

### `PaneController` (Svelte `container/Pane/Pane.svelte`; React `container/Pane`)

Port Svelte's Pane logic onto `paneEl`, with listeners added via Lit `@event` bindings on the
pane div in the template (no `addEventListener` on document). Behaviour to preserve:

- Touch pointerdown passes through to panning unless the selection key is held.
- `selectionOnDrag`/selection key start the user selection; distance threshold
  `paneClickDistance` (0 with the selection key).
- User selection rect stored in flow coordinates (`startX/startY` via `pointToRendererPoint`)
  so it stays fixed during auto-pan; auto-pan with `calcAutoPan` + `store.panBy` in a rAF
  loop when `autoPanOnSelection`.
- Selected nodes from `getNodesInside(..., selectionMode === 'partial', true)`; selected edges are
  those connected to selected nodes via `connectionLookup` and selectable. Emit selection
  changes via `triggerNodeChanges(getSelectionChanges(nodeLookup, ids, true))` and
  `triggerEdgeChanges(getSelectionChanges(edgeLookup, edgeIds))` only when the id sets
  changed (React behaviour; do not map arrays directly as Svelte does).
- On end: `nodesSelectionActive = selectedNodeIds.size > 0`, `selection-end` event.
- Click on the pane (target is the pane itself) without a selection in progress and without a
  connection that ended on the pane: emit `pane-click`, `resetSelectedElements()`,
  `nodesSelectionActive = false`.
- Context menu on the pane: if `panOnDrag` includes 2, `preventDefault()`; else emit
  `pane-context-menu`.
- `wheel` on the pane → `pane-scroll`; pointer enter/move/leave → `pane-pointer-*` events
  (only when a listener exists — track with `XyFlowElement.hasListener(type)` which overrides
  `addEventListener`/`removeEventListener` to count listeners per type).
- `pointermove` updates `store.lastPointerFlowPosition` (throttled to rAF).
- `paneClasses`: `draggable` when panOnDrag is true or includes 0; `dragging` when
  `paneDragging`; `selection` while selecting.

### `FlowKeysController`

Subscribes to `keyboardTracker`. On each key event recompute, with `parseKeyCode` on the
element's key properties:

- `selectionKeyPressed`, `multiSelectionActive`, `panActivationKeyPressed`,
  `zoomActivationKeyPressed` → `store.setState(...)` (only when changed) and
  `PanZoomController.update()`.
- Delete: on keydown matching `deleteKey`, if `keyboardTracker.activeFlow === host`, the event
  is not from an input (`isInputDOMNode`), and no Ctrl/Meta/Shift modifier is held: call
  `instance.deleteElements({ nodes: selected, edges: selected })` and
  `setState({ nodesSelectionActive: false })`.
- On tracker reset (window blur/contextmenu): clear all four flags and `userSelectionRect`.
- Undo/redo: when `store.history` exists and this flow is active and the event isn't from an
  input: `Mod+z` → `history.undo()`; `Mod+Shift+z` and `Mod+y` → `history.redo()`;
  `preventDefault()` when handled. `Mod` = Meta on macOS, Control elsewhere. Disabled with
  `history-keys="off"` (attribute on `<xy-flow>`, default `on`).

The host sets `keyboardTracker.activeFlow = this` on its own `pointerdown` (capture) and
`focusin` listeners (attached to the host element, not document).

### `MeasureController`

Owns one `ResizeObserver` for all `<xy-node>`s of this flow:

```ts
observe(el: XyNodeElement); unobserve(el);
requestMeasure(ids: string[], force = true);   // used by handles and instance.updateNodeInternals
```

RO callback and `requestMeasure` collect `Map<id, { id, nodeElement, force }>` into a pending
map; one `requestAnimationFrame` flushes it via `store.updateNodeInternals(pending)`. Exception:
the very first batch after a structure revision flushes synchronously inside the RO callback
(it already runs after layout) to avoid a frame of hidden nodes. Sets
`store.requestNodeMeasure = (ids) => this.requestMeasure(ids)`.

### `ContainerSizeController`

A second `ResizeObserver` on `wrapperEl` → `store.setState({ width, height })` with
`clientWidth/clientHeight`; if a fitView is queued and size became non-zero,
`store.resolveFitView()`.

### `RenderCompleteController`

Tracks `structureRevision`. When it changes, records `t0 = performance.now()` and arms. On each
host update while armed, it checks `nodesInitialized` (every non-hidden node measured with
`handleBounds`) and that every `<xy-edge>` for the current layouted edges has rendered
(the edges layer sets `renderedEdgeCount` in `updated()`). When both hold, it waits two
`requestAnimationFrame`s; if the revision is still the same, it emits
`render-complete` with `{ revision, nodeCount, edgeCount, durationMs }` and sets
`firstRenderComplete = true` (hides the loading overlay). A newer revision cancels the pending
emit. An empty graph completes immediately (two rAFs after the revision).

## `<xy-flow-provider>` (React `ReactFlowProvider`)

`XyFlowProviderElement extends LitElement`, light DOM (`display: contents`). Creates a
`FlowStore` and provides `flowContext`. A descendant `<xy-flow>` consumes it instead of
creating its own store; controllers placed anywhere under the provider (outside the flow)
can read the store. One provider supports one flow at a time (dev error if two flows attach).

## Dev checks (`dev.ts`, stripped in production via `import.meta.env.DEV` guard)

- Missing container height → `'004'`.
- A node type name that isn't registered → `'003'`, falls back to `default`.
- A `.lit-flow__handle` found inside a nested shadow root of a node (walk once per node after
  first measure) → `'XYL02'` "Handles inside nested shadow roots are not supported."
- `domAttributes` key rejected → `'XYL01'`.

## Tests (`packages/flow/test/xy-flow.browser.test.ts`)

Mount with `document.body.append(flow)` and await `flow.whenRendered()`:
attribute→option mapping for every row of the table; default-true booleans with `"false"`;
upgrade of properties set before definition; uncontrolled add via `connect`; controlled mode
(prevented `nodes-change` leaves nodes unchanged until reassigned); `render-complete` fires once
per revision and after edges render; loading overlay hidden after it; two flows on one page have
independent selection and the delete key only affects the active flow; moving the element to a
new parent keeps working; `viewport` controlled sync; color-mode system follows `matchMedia`.
