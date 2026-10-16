# 08 · Plugins

Plugins are light-DOM children of `<xy-flow>`, projected through its default `<slot>`.
Except where noted they use **their own shadow root**, adopt the shared base stylesheet
(`styles/sheets.ts` → `baseSheets`), and set `:host { display: contents; }` so their inner
`.lit-flow__panel` etc. are positioned against the flow wrapper. CSS custom properties
(`--xy-*`, including the dark-mode values set on `.lit-flow.dark`) inherit through the slot.

They read the store through `flowContext` (`StoreController`). A plugin outside any flow or
provider renders nothing and warns once in dev.

## `<xy-panel>` — `plugins/xy-panel.ts` (React `Panel`)

| Property | Attribute | Default |
|---|---|---|
| `position` | `position` | `top-right` |

Renders `<div class="lit-flow__panel ${positionClasses}" part="panel"><slot></slot></div>` where
`positionClasses = position.split('-').join(' ')` (React adds `center` handling the same way).

## `<xy-background>` — `plugins/xy-background.ts` (React `Background`)

| Property | Attribute | Type | Default |
|---|---|---|---|
| `bgId` | `bg-id` | string | `''` (React `id`; can't use `id` on the host meaningfully) |
| `variant` | `variant` | `'dots' \| 'lines' \| 'cross'` | dots |
| `gap` | `gap` ("20" or "20 10") | `number \| [number, number]` | 20 |
| `size` | `size` | number | dots 1, lines 1, cross 6 |
| `lineWidth` | `line-width` | number | 1 |
| `offset` | `offset` ("2" or "2 4") | `number \| [number, number]` | 0 |
| `color` | `color` | string | undefined |
| `bgColor` | `bg-color` | string | undefined |
| `patternClass` | `pattern-class` | string | undefined |

Port React's maths exactly (the conformance test checks
`patternTransform="translate(-10,-10)"` for defaults and `translate(-52,-52)` for `gap=100
offset=2` at zoom 1):

```ts
const [tx, ty, zoom] = transform;
const gapXY = Array.isArray(gap) ? gap : [gap, gap];
const scaledGap = [gapXY[0] * zoom || 1, gapXY[1] * zoom || 1];
const scaledSize = (size ?? defaultSize[variant]) * zoom;
const offsetXY = Array.isArray(offset) ? offset : [offset, offset];
const patternDimensions = variant === 'cross' ? [scaledSize, scaledSize] : scaledGap;
const scaledOffset = [offsetXY[0] * zoom + patternDimensions[0] / 2, offsetXY[1] * zoom + patternDimensions[1] / 2];
const patternId = `pattern-${flowId}${bgId}`;
```

```html
<svg class="lit-flow__background lit-flow__container" data-testid="rf__background" part="background"
     style="--xy-background-color-props:${bgColor};--xy-background-pattern-color-props:${color}">
  <pattern id=${patternId} x=${tx % scaledGap[0]} y=${ty % scaledGap[1]} width=${scaledGap[0]} height=${scaledGap[1]}
           patternUnits="userSpaceOnUse" patternTransform="translate(-${scaledOffset[0]},-${scaledOffset[1]})">
    ${dots ? svg`<circle cx=${scaledSize/2} cy=${scaledSize/2} r=${scaledSize/2} class="lit-flow__background-pattern dots ${patternClass}"/>`
           : svg`<path stroke-width=${lineWidth} d=${linePath} class="lit-flow__background-pattern ${variant} ${patternClass}"/>`}
  </pattern>
  <rect x="0" y="0" width="100%" height="100%" fill="url(#${patternId})"/>
</svg>
```

`linePath` ports React `LinePattern` (`M${w/2} 0 V${h} M0 ${h/2} H${w}`). Selector:
`transform` + `flowId` (re-renders on every pan frame; cheap).

## `<xy-controls>` and `<xy-control-button>` — (React `Controls`, `ControlButton`)

`<xy-controls>` properties: `position` (`bottom-left`), `orientation` (`vertical` |
`horizontal`), `showZoom`/`showFitView`/`showInteractive` (`show-zoom`… booleanAttr(true)),
`fitViewOptions` (prop). Renders inside a panel div
`<div class="lit-flow__panel lit-flow__controls ${orientation} ${positionClasses}" data-testid="rf__controls" aria-label=${ariaLabelConfig['controls.ariaLabel']}>`:
`<slot name="before">`, zoom in/out buttons (disabled at max/min zoom), fit view, lock toggle,
`<slot>`, `<slot name="after">`. Buttons are `<button type="button" class="lit-flow__controls-button lit-flow__controls-zoomin" title=… aria-label=…>`
with inline SVG icons ported from React `Controls/Icons/*` (Plus, Minus, FitView, Lock,
Unlock). Lock toggles `nodesDraggable`, `nodesConnectable`, `elementsSelectable` together
through `store.setOptions` **and** reflects them back to the flow element's properties
(`flow.nodesDraggable = …`) so attribute state stays consistent. Emits bubbling events
`zoom-in`, `zoom-out`, `fit-view`, `interactive-change` (`{ interactive }`) from the
controls element.

`<xy-control-button>`: a styled `<button class="lit-flow__controls-button" part="button"><slot></slot></button>`
for custom buttons placed in `<xy-controls>`.

## `<xy-minimap>` — `plugins/xy-minimap.ts` (React `MiniMap`, Svelte `Minimap`)

| Property | Attribute | Default |
|---|---|---|
| `position` | `position` | `bottom-right` |
| `width` / `height` | `width` / `height` | 200 / 150 |
| `pannable` / `zoomable` | `pannable` / `zoomable` | false / false (React defaults) |
| `inversePan` | `inverse-pan` | false |
| `zoomStep` | `zoom-step` | 10 |
| `offsetScale` | `offset-scale` | 5 |
| `nodeColor` / `nodeStrokeColor` / `nodeClass` | prop or attribute (string or `(node) => string`) | undefined / transparent / '' |
| `nodeBorderRadius` / `nodeStrokeWidth` | attributes | 5 / 2 |
| `maskColor` / `maskStrokeColor` / `maskStrokeWidth` / `bgColor` | attributes | undefined |
| `ariaLabel` | `aria-label` | `ariaLabelConfig['minimap.ariaLabel']` |
| `nodeRenderer` | prop: `(p: MiniMapNodeProps) => SVGTemplateResult` | rect |

Port React's view-box maths (`viewBB`, `boundingRect` via `getBoundsOfRects(getInternalNodesBounds(nodeLookup, { filter: n => !n.hidden }), viewBB)`,
`viewScale`, `offset = offsetScale * viewScale`, mask path with `fill-rule="evenodd"`). Node
rects use `getNodeDimensions` and `internals.positionAbsolute`, `class="lit-flow__minimap-node ${selected ? 'selected' : ''} ${nodeClass}"`.
`shape-rendering` = `crispEdges` on Chromium (`'chrome' in window`) else `geometricPrecision`.
Wire `XYMinimap({ domNode: svgEl, panZoom, getTransform, getViewScale })` in `firstUpdated`
(after the store has `panZoom`; if not yet, wait for it via the controller), call
`minimap.update({ translateExtent, width: flowWidth, height: flowHeight, inversePan, zoomStep, pannable, zoomable })`
in `updated()`, `destroy()` on disconnect. Emits `minimap-click` (`{ event, position }`) and
`minimap-node-click` (`{ event, node }`) when those have listeners.

Rendering cost: the minimap re-renders on node changes and on viewport changes; node rects use
`repeat` keyed by id so only changed rects update.

## `<xy-node-resizer>` and `<xy-resize-control>` (React `NodeResizer`, `NodeResizeControl`)

**Light render root** (they live inside a node, so their divs must be in the flow's shadow
root for `node-resizer.css` and so XYResizer can measure).

`<xy-resize-control>` properties: `nodeId` (`node-id`, default from `nodeIdContext`),
`position` (ControlPosition; default `bottom-right`, or `right` for the line variant),
`variant` (`handle` | `line`), `color`, `minWidth`/`minHeight` (10), `maxWidth`/`maxHeight`
(`Number.MAX_VALUE`), `keepAspectRatio`, `resizeDirection` (`horizontal` | `vertical` | undefined),
`autoScale` (true), `shouldResize`/`onResizeStart`/`onResize`/`onResizeEnd` (function props).

It renders one div: `class="lit-flow__resize-control ${noDragClassName} ${positionClasses} ${variant}"`,
border/background colour as in Svelte, `scale: max(1/zoom, 1)` for the handle variant when
`autoScale` (subscribes to `transform[2]`). In `firstUpdated` it creates
`XYResizer({ domNode: div, nodeId, getStoreItems: () => ({ nodeLookup, transform, snapGrid, snapToGrid, nodeOrigin, paneDomNode: domNode }), onChange, onEnd })`
and calls `resizer.update({ controlPosition, boundaries, keepAspectRatio, resizeDirection, onResizeStart, onResize, onResizeEnd, shouldResize })`
in every `updated()`. `onChange`/`onEnd` port React `NodeResizeControl` (above) exactly, with
`ChangeMeta`:

- XY Lit wraps `onResizeStart` to set `store.state.activeGesture = { kind: 'resize', id }` and
  the first `onChange` of a gesture uses `phase: 'start'`, later ones `'live'`;
- `onEnd` sends the `dimensions` change with `resizing: false` and `phase: 'end'`, then clears
  `activeGesture`. Origin is `'resize'`.

`<xy-node-resizer>` properties: `nodeId`, `color`, `handleClass`, `handleStyle`, `lineClass`,
`lineStyle`, `isVisible` (default: node selected), `minWidth`, `minHeight`, `maxWidth`,
`maxHeight`, `keepAspectRatio`, `autoScale`, `shouldResize`, callbacks, and XY Lit's
`variant`: `handles` (default: 4 line controls + 4 handle controls, upstream) | `lines`
(lines only) | `hover-corner` (one `bottom-right` handle control, shown on node hover via the
CSS in `extra.css.ts`: `.lit-flow__node:not(:hover) > xy-node-resizer[variant=hover-corner] .lit-flow__resize-control { opacity: 0; }`,
visible regardless of selection). `.options` (object) sets all of them at once (used by
`NodeTypeDefinition.resizer`).

## `<xy-viewport-portal>` (React `ViewportPortal`)

Light DOM, `display: contents`. `target` attribute (`front` | `back`, default front). In
`connectedCallback` it sets its own `slot` attribute to `viewport-front` / `viewport-back`, so
the flow projects it into the viewport layer (transformed with pan/zoom). Only works as a
direct child of `<xy-flow>`; dev warning otherwise.

## Tests

`plugins.browser.test.ts`: background pattern ids and transforms (the two conformance
values plus cross/lines sizes); controls zoom/fit/lock reflect into flow properties and disable
at extents; minimap view box for a known graph, pan/zoom via XYMinimap, custom node renderer;
resizer changes (`setAttributes`, `resizing` start/end, phases, keepAspectRatio, child nodes
compensated) and the hover-corner variant visibility; viewport portal content moves with pan.
