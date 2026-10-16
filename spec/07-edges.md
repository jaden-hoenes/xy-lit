# 07 · Edges

References: Svelte `components/EdgeWrapper/EdgeWrapper.svelte`, `components/edges/*`,
`components/EdgeLabel/EdgeLabel.svelte`, `container/EdgeRenderer/*`; React
`components/EdgeWrapper/index.tsx`, `components/Edges/*`.

## `EdgeRenderContext`

```ts
type EdgeRenderContext = {
  store: FlowStore; instance: FlowInstance; flowId: string; flow: XyFlowElement;
  edgeTypes: EdgeTypes;                 // built-ins merged with user types
  elementsSelectable: boolean; edgesFocusable: boolean;
  edgesReconnectable: boolean; reconnectRadius: number;
  disableKeyboardA11y: boolean; ariaLabelConfig: AriaLabelConfig;
  noPanClassName: string;
  listeners: ReadonlySet<string>;
  motion: MotionState;
};
```

## `<xy-edge>` — `elements/xy-edge.ts`

`XyEdgeElement extends LitElement`, light render root, host style `display: contents`
(set in the constructor: `this.style.display = 'contents'`). The host carries **no**
`data-id` (e2e locators `[data-id=…]` must match exactly one element: the `<g>`).

Properties: `edge: EdgeLayouted` and `ctx: EdgeRenderContext` (both `attribute: false`), and
state `reconnecting: boolean`. Provides `edgeIdContext`.

Derived:

```ts
selectable = edge.selectable ?? ctx.elementsSelectable;
focusable  = edge.focusable  ?? ctx.edgesFocusable;
reconnectable = edge.reconnectable ?? ctx.edgesReconnectable;
markerStartUrl = edge.markerStart ? getMarkerUrl(edge.markerStart, ctx.flowId) : undefined;
markerEndUrl   = edge.markerEnd   ? getMarkerUrl(edge.markerEnd, ctx.flowId)   : undefined;
def = ctx.edgeTypes[edge.type ?? 'default'] ?? ctx.edgeTypes.default;   // dev error 011 for unknown types
```

`render()`:

```ts
const result = def.render(props, ctx.instance);
this.publishLabels(result);           // §Labels
return html`<svg class="lit-flow__edge-wrapper" style="z-index:${edge.zIndex}" part="edge-svg">
  <g class=${classes} data-id=${edge.id} part="edge"
     role=${edge.ariaRole ?? (focusable ? 'group' : 'img')}
     aria-roledescription="edge"
     aria-label=${edge.ariaLabel === null ? nothing : edge.ariaLabel ?? `Edge from ${edge.source} to ${edge.target}`}
     aria-describedby=${focusable ? `${ARIA_EDGE_DESC_KEY}-${ctx.flowId}` : nothing}
     tabindex=${focusable ? 0 : nothing}
     ${spreadDomAttributes(edge.domAttributes)}
     @click=${this.onClick} @dblclick=${…} @contextmenu=${…}
     @pointerenter=${…} @pointermove=${…} @pointerleave=${…} @keydown=${focusable ? this.onKeyDown : nothing}>
    ${this.reconnecting ? nothing : result.path}
    ${reconnectable ? reconnectAnchors(this, edge) : nothing}
  </g>
</svg>`;
```

`classes` = `lit-flow__edge` + `edge.class` + `animated` + `selected` + `selectable` +
`inactive` (React: `!selectable && !ctx.listeners.has('edge-click')`) + `updating` while
reconnecting. `spreadDomAttributes` is a small directive that sets/removes allowed attributes
(02-types key rules) on the `<g>`.

`props: EdgeProps` = `{ ...edge without layout internals, id, source, target, type, data,
selected: !!edge.selected, animated: !!edge.animated, selectable, deletable: edge.deletable ?? true,
sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
sourceHandleId: edge.sourceHandle ?? null, targetHandleId: edge.targetHandle ?? null,
markerStart: markerStartUrl, markerEnd: markerEndUrl, offset: edge.resolvedOffset,
interactionWidth: edge.interactionWidth ?? 20, label, startLabel, endLabel, labelStyle, style }`.

Interaction:
- `click`: `const e = store.getState().edgeLookup.get(id)`; if `selectable` →
  `store.handleEdgeSelection(id)` (which handles the multi-selection key); emit `edge-click`.
- `keydown` (unless `disableKeyboardA11y`): `elementSelectionKeys` when selectable — Escape →
  `blur()` the `<g>` and `unselectNodesAndEdges({ edges: [edge] })`; else
  `addSelectedEdges([id])`.
- Other events emit `edge-*` with the user edge from `edgeLookup`, skipped when no listener.

`updated()`: tell the flow's `RenderCompleteController` this edge rendered (`flow.edgeRendered(id)`).
`disconnectedCallback`: `flow.removeEdgeLabels(id)`.

## Labels

Upstream renders HTML edge labels into `.edgelabel-renderer` through a portal. Here the edge
publishes label templates and the flow renders them (04 §Edge label layer).

```ts
publishLabels(r: EdgeRenderResult) {
  ctx.flow.setEdgeLabels(edge.id, [
    r.label && { key: `${edge.id}:center`, template: r.label },
    r.startLabel && { key: `${edge.id}:start`, template: r.startLabel },
    r.endLabel && { key: `${edge.id}:end`, template: r.endLabel },
  ].filter(Boolean));
}
```

`setEdgeLabels` stores the entries and schedules one rAF to re-render the label layer
(`requestUpdate` on the flow with a dedicated `labelsVersion` state). Hidden/removed edges
drop their entries.

### `edgeLabel()` — `edges/edge-text.ts`

The positioned wrapper every label goes through (Svelte `EdgeLabel`):

```ts
export function edgeLabel(flow: FlowInstance, o: { edgeId: string; x: number; y: number; zIndex?: number;
  class?: string; style?: string; selectEdgeOnClick?: boolean; transparent?: boolean; width?: number;
  height?: number }, content: unknown): TemplateResult
```

`zIndex` defaults to the edge's laid-out z-index (`store.getLayoutedEdges().get(edgeId)?.zIndex`).

renders

```html
<div class="lit-flow__edge-label ${transparent ? 'transparent' : ''} nopan ${class}" data-edge-id=${edgeId}
     style="transform:translate(-50%,-50%) translate(${x}px,${y}px);pointer-events:all;${zIndex != null ? `z-index:${zIndex};` : ''}${width ? `width:${width}px;` : ''}${height ? `height:${height}px;` : ''}${style ?? ''}"
     tabindex="-1" @click=${selectEdgeOnClick ? () => store.handleEdgeSelection(edgeId) : nothing}>${content}</div>
```

Helpers reach the store through an internal symbol on the instance
(`flow[STORE_SYMBOL]`, exported from `@xy-lit/store/internal`), so renderers only ever pass
the `flow` argument they were given.

`edgeText(flow, props, text, position)` = `edgeLabel(flow, { edgeId: props.id, ...position,
style: props.labelStyle, selectEdgeOnClick: true }, text)` where `text` is always rendered
as text content.

## Built-in edge types — `edges/builtin.ts`

Each is `defineEdgeType({ render })` porting the Svelte `*EdgeInternal.svelte` + `BaseEdge.svelte`:

```ts
export const bezierEdge = defineEdgeType({ render: (p, flow) => {
  const [path, labelX, labelY] = p.offset
    ? getOffsetBezierPath(p, p.offset, (p.pathOptions as BezierPathOptions)?.curvature)
    : getBezierPath({ ...positions(p), curvature: (p.pathOptions as BezierPathOptions)?.curvature });
  return withLabels(p, flow, baseEdge({ id: p.id, path, markerStart: p.markerStart, markerEnd: p.markerEnd,
    style: p.style, interactionWidth: p.interactionWidth }), labelX, labelY);
}});
```

- `default` = bezier; `simplebezier` (`getSimpleBezierPath`, ported from React);
  `straight` (`getStraightPath`; with offset: quadratic `M s Q c t` where `c` = midpoint +
  normal × 2·offset, label at the curve midpoint = midpoint + normal × offset);
  `step` (`getSmoothStepPath({ borderRadius: 0, offset: pathOptions?.offset })`);
  `smoothstep` (`getSmoothStepPath({ borderRadius, offset, stepPosition })`). For step and
  smoothstep, `p.offset` shifts `stepPosition`: `clamp(0.5 + p.offset / Math.max(|dx|, |dy|, 1), 0.1, 0.9)`
  (explicit `pathOptions.stepPosition` wins).
- `getOffsetBezierPath(p, offset, curvature)`: compute upstream control points for the same
  positions (port `getControlWithCurvature` logic from `system/src/utils/edges/bezier-edge.ts`
  into `edges/offset-bezier.ts`), translate both control points by `n × offset × 1.5`, where
  `n` is the unit normal of (target − source); label at the cubic's t = 0.5.
- `withLabels(p, flow, path, labelX, labelY)` returns `{ path, label: p.label ? edgeText(flow, p, p.label, { x: labelX, y: labelY }) : undefined,
  startLabel: p.startLabel ? edgeText(flow, p, p.startLabel, getEdgeEndLabelPosition(p, { end: 'source' })) : undefined,
  endLabel: … 'target' }`.

### `baseEdge()` — `edges/base-edge.ts`

```ts
export function baseEdge(o: { id?: string; path: string; markerStart?: string; markerEnd?: string;
  style?: string; class?: string; interactionWidth?: number }): SVGTemplateResult {
  return svg`<path id=${o.id ?? nothing} d=${o.path} fill="none" class="lit-flow__edge-path ${o.class ?? ''}"
      marker-start=${o.markerStart ?? nothing} marker-end=${o.markerEnd ?? nothing} style=${o.style ?? nothing}></path>
    ${(o.interactionWidth ?? 20) > 0 ? svg`<path d=${o.path} fill="none" stroke-opacity="0"
      stroke-width=${o.interactionWidth ?? 20} class="lit-flow__edge-interaction"></path>` : nothing}`;
}
```

## Markers — `edges/markers.ts`

`markerDefs(defs: MarkerDef[])` renders inside `<svg class="lit-flow__marker"><defs>`, keyed by
id (Svelte `Marker.svelte`):

```ts
svg`<marker class="lit-flow__arrowhead" id=${m.id} markerWidth=${`${m.width ?? 12.5}`} markerHeight=${`${m.height ?? 12.5}`}
     viewBox="-10 -10 20 20" markerUnits=${m.markerUnits ?? 'strokeWidth'} orient=${m.orient ?? 'auto-start-reverse'}
     refX=${m.refX ?? 0} refY=${m.refY ?? 0}>${shape(m)}</marker>`
```

- `arrow`: `<polyline class="arrow" style="stroke:${color}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width=${strokeWidth} points="-5,-4 0,0 -5,4">`
- `arrowclosed`: same with `class="arrowclosed"`, `fill:${color}` and points `-5,-4 0,0 -5,4 -5,-4`.
- `custom`: `<path d=${m.path} style="stroke:${color};fill:${fill === 'stroke' ? color : fill}" stroke-width=${strokeWidth}>`.
  `m.path` goes into an attribute binding, so it can't inject markup.

Because the defs live in the same shadow root as the edges, `url('#id')` resolves locally;
two flows on one page can both use id `1__type=arrow`.

## Edge toolbar — `edges/edge-toolbar.ts`

```ts
export function edgeToolbar(flow: FlowInstance, o: { edgeId: string; x: number; y: number;
  alignX?: 'left' | 'center' | 'right'; alignY?: 'top' | 'center' | 'bottom'; isVisible?: boolean;
  selected?: boolean; class?: string }, content: unknown): TemplateResult | typeof nothing
```

Visible when `o.isVisible ?? o.selected`. Renders `edgeLabel(flow, { edgeId, x: 0, y: 0, transparent: true }, html`<div class="lit-flow__edge-toolbar ${class}" data-id=${edgeId} style="position:absolute;transform:${getEdgeToolbarTransform(x, y, zoom, alignX, alignY)};transform-origin:0 0">${content}</div>`)`.
`zoom` comes from `flow.getZoom()`; the flow re-renders labels on zoom change while any edge
toolbar is registered (the label layer subscribes to `transform[2]` when a toolbar exists).
Use it inside an edge renderer's `label`.

## Defining custom edges

```ts
export const buttonEdge = defineEdgeType({
  render: (p, flow) => {
    const [path, x, y] = getBezierPath(p);
    return {
      path: baseEdge({ id: p.id, path, markerEnd: p.markerEnd, style: p.style }),
      label: edgeLabel(flow, { edgeId: p.id, x, y }, html`<button class="nodrag nopan"
        @click=${() => flow.deleteElements({ edges: [{ id: p.id }] })}>×</button>`),
    };
  },
});
```

## Tests

`xy-edge.browser.test.ts`: `<g>` attributes match the e2e expectations (class, `data-id`,
aria-label default text, z-index on the wrapper svg); marker urls exactly
`url('#1__type=arrowclosed')`; custom marker dedupe; labels rendered in the label layer and
removed with the edge; label text with `<img onerror>` renders as text; start/end label
positions for each handle side; parallel spread produces distinct paths for 2 and 3 edges and
for opposite directions; reconnect anchors only when enabled; animated class.
