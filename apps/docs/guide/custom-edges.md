# Custom edges

Edges are SVG paths with optional HTML labels. The built-in types are `default` (bezier), `straight`, `step`,
`smoothstep` and `simplebezier`; `defineEdgeType` adds your own.

<Demo name="custom-edges" :height="380" caption="A button edge with a delete label, start/centre/end labels, markers, a custom marker and three parallel edges." />

## `defineEdgeType`

A renderer receives the edge's props (the laid-out geometry: `sourceX`, `sourceY`, `targetX`, `targetY`,
`sourcePosition`, `targetPosition`, plus `id`, `data`, `selected`, `animated`, `markerStart`, `markerEnd` as ready
`url(#...)` strings, `style`, `interactionWidth`, `offset`) and the flow instance. It returns the SVG path and,
optionally, HTML labels.

```ts
import { html } from 'lit';
import { baseEdge, defineEdgeType, edgeLabel, getBezierPath } from '@xy-lit/flow';

const buttonEdge = defineEdgeType({
  render: (p, flow) => {
    const [path, labelX, labelY] = getBezierPath(p);
    return {
      path: baseEdge({ id: p.id, path, markerEnd: p.markerEnd, style: p.style, interactionWidth: p.interactionWidth }),
      label: edgeLabel(flow, { edgeId: p.id, x: labelX, y: labelY, transparent: true },
        html`<button class="nodrag nopan" @click=${() => flow.deleteElements({ edges: [{ id: p.id }] })}>&times;</button>`),
    };
  },
});

flow.edgeTypes = { button: buttonEdge };
flow.edges = [{ id: 'e1', source: 'a', target: 'b', type: 'button' }];
```

- **`baseEdge`** draws the visible path plus a wider, invisible one (`interactionWidth`, 20 px by default) that makes
  thin edges easy to hit.
- **Path helpers** come from the engine: `getBezierPath`, `getSmoothStepPath`, `getStraightPath`,
  `getSimpleBezierPath`, each returning `[path, labelX, labelY, offsetX, offsetY]`. The offset-aware variants
  `getOffsetBezierPath` and `getOffsetStraightPath` take `props.offset` for parallel edges.
- **Labels** are HTML in a layer above the edges, positioned in flow coordinates. `edgeLabel(flow, options, content)`
  is the wrapper (`x`, `y`, `transparent`, `selectEdgeOnClick`, `width`, `height`); `label`, `startLabel` and
  `endLabel` of the result each take one. Add `nodrag nopan` to interactive content so presses do not pan the pane.
- **`styles`** works as for nodes: a `css` result adopted into the flow.

For plain text, set `label`, `startLabel` and `endLabel` on the edge itself (the text is always rendered as text) and
`labelStyle` to style it. `edgeText()` renders such a label from your own renderer.

## Edge toolbars

`edgeToolbar(flow, { edgeId, x, y, selected }, content)` returns a toolbar to use as `label` of a custom edge type.
It keeps its size at any zoom through the `--xy-zoom` custom property the flow maintains on its edge-label layer, so
it follows zooming without re-rendering the edge.

## Markers

`markerStart` and `markerEnd` take a name (`'arrow'`, `'arrowclosed'`) or an object:

```ts
{ type: 'arrowclosed', color: '#6366f1', width: 14, height: 14 }
{ type: 'custom', path: 'M-5 -5 L5 0 L-5 5 L-2 0 Z', color: '#10b981', fill: 'stroke' }
```

A **custom marker** is an SVG path drawn in a 20x20 box centred on the origin and pointing towards +x
(`width`, `height`, `refX`, `refY`, `fill: 'stroke' | 'none' | <colour>`, `strokeWidth`, `orient`,
`markerUnits`). Use `color: 'var(--my-stroke)'` for theme-aware markers. Marker definitions are shared per flow
(`<defs>` is rendered once). `default-marker-color` sets the colour of markers without one.

## Parallel edges

Several edges between the same two handles overlap. `parallel-edges="spread"` fans them out by `parallel-edge-gap`
pixels (12 by default); an edge's own `offset` overrides it. The bezier, straight, step and smoothstep built-ins
honour the offset (`simplebezier` ignores it); custom types read `props.offset`.

## Reconnecting

With `edges-reconnectable` (or `reconnectable: true | 'source' | 'target'` on an edge) the ends of a selected edge
show anchors you can drag to another handle; see [handles and connections](/guide/handles-and-connections#reconnecting).

## Edge options

`Edge` also takes `animated`, `hidden`, `deletable`, `selectable`, `focusable`, `zIndex`, `class`, `style`,
`interactionWidth`, `ariaLabel`, `ariaRole`, `domAttributes` and `pathOptions` (`curvature` for beziers,
`borderRadius` and `offset` for smoothstep, `stepPosition`). `default-edge-options` (a property,
`defaultEdgeOptions`) merges defaults such as `type` or `markerEnd` into every edge.
