# Theming

A flow is styled with CSS custom properties, `::part()` selectors and, for what those cannot reach, stylesheets you
hand to the flow. Light and dark mode are built in.

<Demo name="theming" :height="400" caption="Colour pickers set custom properties on the flow element. The checkboxes switch on a ::part() rule from the page and a stylesheet adopted into the flow." />

## CSS custom properties

Every upstream `--xy-*` variable works. Set them on `xy-flow` (they inherit into the shadow root) or on any
ancestor. Each has a built-in `-default` companion for light and dark mode; you set the plain name and it wins.

```css
xy-flow {
  --xy-node-background-color: #eef2ff;
  --xy-node-border: 1px solid #6366f1;
  --xy-edge-stroke: #6366f1;
  --xy-edge-stroke-selected: #4338ca;
  --xy-handle-background-color: #f59e0b;
  --xy-background-color: #fafafa;
}
```

| Group | Variables |
|---|---|
| Canvas | `--xy-background-color`, `--xy-background-pattern-color` (and the `-dots-`, `-lines-`, `-cross-` variants) |
| Nodes | `--xy-node-color`, `-border`, `-background-color`, `-border-radius`, `-boxshadow-hover`, `-boxshadow-selected`, `--xy-node-group-background-color` |
| Handles | `--xy-handle-background-color`, `--xy-handle-border-color` |
| Edges | `--xy-edge-stroke`, `-stroke-width`, `-stroke-selected`, `--xy-edge-label-color`, `-background-color`, `--xy-connectionline-stroke`, `-stroke-width` |
| Selection | `--xy-selection-background-color`, `--xy-selection-border` |
| Controls | `--xy-controls-button-background-color` (`-hover`), `-color` (`-hover`), `-border-color`, `--xy-controls-box-shadow` |
| Mini map | `--xy-minimap-background-color`, `-mask-background-color`, `-mask-stroke-color`, `-mask-stroke-width`, `-node-background-color`, `-node-stroke-color`, `-node-stroke-width` |
| Resizer | `--xy-resize-background-color` |
| Attribution | `--xy-attribution-color`, `--xy-attribution-background-color` |
| Loading overlay | `--xy-loading-background`, `--xy-loading-color`, `--xy-loading-track` |
| Motion | `--xy-enter-duration`, `--xy-enter-stagger`, `--xy-enter-easing` |

The [`<xy-flow>` reference](/api/elements/xy-flow#css-custom-properties) has the full list with defaults. The
attribution link is darker than upstream's so that it passes WCAG AA contrast.

## Colour mode

`color-mode="light" | "dark" | "system"` puts a `light` or `dark` class on the flow's wrapper; `system` follows
`prefers-color-scheme` and updates when the preference changes. The built-in node, edge, handle, control and mini
map colours switch with it. Your own node styles should use the flow's variables (or yours, set per mode) instead of
fixed colours, so they follow too:

```css
.card { background: var(--xy-node-background-color, var(--xy-node-background-color-default)); }
```

This site sets `color-mode` on every demo from the page's theme.

## Parts

The shadow root exposes parts you can style from the page with `::part()`:

| Element | Parts |
|---|---|
| `<xy-flow>` | `pane`, `viewport`, `node`, `edge`, `edge-svg`, `handle`, `loading` |
| `<xy-background>` | `background` |
| `<xy-controls>`, `<xy-minimap>`, `<xy-panel>` | `panel`, and `button` (controls), `<xy-control-button>`: `button` |
| `@xy-lit/ui` and `@xy-lit/collab-yjs` elements | listed on their [reference pages](/api/) |

```css
xy-flow::part(node) { border-radius: 14px; }
xy-flow::part(handle) { width: 10px; height: 10px; }
```

`::part()` cannot style **descendants** of a part, and the content of a node is a descendant of `node`. That is why
the next two mechanisms exist.

## Styling node content

- **`defineNodeType({ styles })`**, `static styles` of a `FlowNodeElement`, and `defineEdgeType({ styles })` adopt a
  stylesheet into the flow's root automatically. This is the normal way.
- **`flow.adoptStyles(sheet)`** adds any constructable stylesheet or Lit `css` result, for example a compiled
  Tailwind sheet. Adopted sheets are deduplicated by identity; changing the sheet's text updates every flow that
  adopted it.

```ts
const sheet = new CSSStyleSheet();
sheet.replaceSync('.lit-flow__node-default { text-transform: uppercase; }');
flow.adoptStyles(sheet);
```

## `unstyled`

`unstyled` loads the upstream **base** stylesheet (functional styles and minimal node colours) instead of the default
look. Use it when you draw nodes, edges and controls entirely yourself. Plugins read the flag when they connect, so
set it before adding plugins.

## Light render root

`render-root="light"` renders into the document (or the enclosing shadow root) instead of a shadow root. Global CSS,
including Tailwind, then styles the nodes directly. The flow's own sheets are adopted into that root once and never
removed; the flow's children are moved into the rendered tree, so use `child.remove()` rather than
`flow.removeChild(child)`. `render-root` is read once, before the first render: set it as an attribute. Some
features need the shadow tree's slots: `<xy-presence-avatars>` and `<xy-remote-cursors>` are specified for the
shadow root, and `installHelperLines` needs `{ render: false }` in light mode.

## Class names

Every node has the classes the engine expects (`lit-flow__node`, `lit-flow__node-<type>`, `selected`, `dragging`,
`selectable`, `draggable`), edges `lit-flow__edge`, `selected`, `animated`, and handles `lit-flow__handle`, `source`
or `target`, `connectingfrom`, `connectingto`, `valid`. Remote users' highlights use `remote-selected`,
`remote-dragging` and `--xy-remote-color`.
