# UI components

`@xy-lit/ui` collects the pieces most editors rebuild: a node card, handles with labels and buttons, ready-made
nodes and edges, zoom controls, node search and devtools. Colours derive from the flow's own `--xy-node-*` tokens, so
everything follows `color-mode` without dark-mode selectors of its own.

```sh
pnpm add @xy-lit/ui
```

```ts
import '@xy-lit/ui/define.js'; // registers the elements; also imports @xy-lit/flow/define.js
import { uiNodeTypes, uiEdgeTypes } from '@xy-lit/ui';

flow.nodeTypes = { ...uiNodeTypes }; // databaseSchema, shape, placeholder, labeledGroup
flow.edgeTypes = { ...uiEdgeTypes }; // button, data, animatedSvg
```

<Demo name="ui" :height="440" caption="A status card (press Run, hover for the tooltip), a database schema node, a diamond shape, a placeholder, a button edge and an animated edge; zoom slider bottom left, node search top left." />

`@xy-lit/ui` itself registers nothing; importing `@xy-lit/ui/define.js` does. The light-DOM pieces (status ring,
labeled handles, schema table, shapes, tooltip, appendix, edge buttons) are styled by one sheet, **`uiStyles`**. The
ready-made types carry it; **when you build your own node type from the helpers add it**:
`defineNodeType({ styles: uiStyles, render })`, or `static styles = uiStyles` on a `FlowNodeElement`. Optional overrides:
`--xy-ui-surface`, `-text`, `-border`, `-border-strong`, `-muted`, `-subtle`, `-accent` (`#6366f1`), `-success`,
`-danger`, `-radius` (10px), `-shadow`, `-handle-color`, `-font-mono`.

## Node building blocks

| Item | Use |
|---|---|
| `<xy-base-node ?selected>` | A shadow-DOM card with `header`, default and `footer` slots (header and footer hidden unless used) and the parts `header`, `content`, `footer`. Handles are slotted light children. `--xy-base-node-padding`, `--xy-base-node-min-width`. |
| `statusIndicator(status, content)` | Wraps content in a ring outside the box (no size change): `'initial' \| 'loading' \| 'success' \| 'error'`, with `aria-busy` while loading and a spinner that stops under reduced motion. |
| `labeledHandle({ type, position, id?, label })` | A row spanning the node edge to edge with a handle and a label, for ports with names. |
| `buttonHandle({ type, position, showButton, onClick, label })` | A handle with a "+" button on a stem outside the node; presses on the button never start a connection. |
| `nodeTooltip(options, content)` | A `nodeToolbar` driven by hover and keyboard focus of the owning node. |
| `nodeAppendix(side, content)` | Content attached to a side of the node, outside its box. |

`<xy-base-node>` is the one deliberate shadow root inside a node. Handles, appendices and tooltips go inside it as light
children; its own template has none.

## Ready-made node types

| Type | `data` |
|---|---|
| `databaseSchema` | `{ label, schema: { title, type, key?: 'PK' \| 'FK' }[] }`; each row gets a target handle on the left and a source handle on the right, with `handle-id` equal to the column title |
| `shape` | `{ shape, label?, color?, registry? }`; 12 shapes (`rectangle`, `rounded-rectangle`, `ellipse`, `circle`, `diamond`, `hexagon`, `parallelogram`, ...), resizable, connection points with a source and a target handle each, shown on hover or selection. `ShapeRegistry` adds your own: `registry.register(name, { path, handles, textBox })` |
| `placeholder` | `{ label? }`: a dashed "+" box; dispatches a bubbling, composed `placeholder-click` event (`detail: { id, data }`) |
| `labeledGroup` | `{ label, labelPosition? }`: a group with a title; give it `width` and `height`, and put it before its children |

## Edges

`buttonEdge`, `dataEdge` and `animatedSvgEdge` take `data.pathType` (`'bezier' | 'smoothstep' | 'step' | 'straight'`).
`dataEdge` shows `edge.data[edge.data.key]` as its label, falling back to the source node's `data[key]` (the React Flow
UI behaviour). `animatedSvgEdge` moves a dot along the path (`data: { duration?, radius? }`).

## Panels

| Element | Default position | |
|---|---|---|
| `<xy-zoom-slider>` | `bottom-center` | range input, plus and minus buttons, a percentage button that resets to 100% |
| `<xy-zoom-select>` | `top-center` | 50, 100, 150, 200 percent and "Fit view"; an extra entry for a non-preset zoom |
| `<xy-node-search>` | `top-left` | combobox with a listbox matching node labels and ids; `max-results`, `placeholder`, `.getLabel`; fires `node-search-select` (`detail.node`) and zooms to the node |
| `<xy-devtools>` | `bottom-right` | switches for a viewport logger, a node inspector and a change logger; `viewport-logger`, `node-inspector`, `change-logger` attributes, `entries` (newest first, up to 50), `clearLog()` |

Panels extend the plugin base: put them inside `<xy-flow>` (or a provider) and they pick up the flow's styles and store.
`<xy-devtools>` listens to `nodes-change` and `edges-change` without cancelling them, so the flow stays uncontrolled;
it needs a `<xy-flow>` parent.

Storybook (`pnpm dev:storybook`, port 6006 by default) has a story for every component with live controls.
