# Custom nodes

A node type decides what a node looks like. There are two ways to write one; both render into the flow's single
shadow tree (see [concepts](/guide/concepts#one-tree-one-shadow-root)).

| | `defineNodeType` | `FlowNodeElement` |
|---|---|---|
| What it is | a render function `(props, flow) => template` | a Lit element class |
| State of its own | no (use `flow.updateNodeData`) | yes: reactive properties, controllers |
| Styles | `styles` option, adopted by the flow | `static styles` (light DOM) |
| Register | put it in `nodeTypes` | `customElements.define`, then the constructor or tag name in `nodeTypes` |

<Demo name="custom-nodes" :height="340" caption="Select the task for its toolbar. Edit the numbers: the sum node recomputes from its connected nodes. Resize the note." />

## `defineNodeType`

```ts
import { html, css } from 'lit';
import { defineNodeType } from '@xy-lit/flow';
import type { Node } from '@xy-lit/flow';

const task = defineNodeType<Node<{ title: string }>>({
  styles: css`
    .card { padding: 8px 12px; border: 1px solid #c7d2fe; border-radius: 10px; background: #fff; }
  `,
  render: ({ id, data, selected }, flow) => html`
    <div class="card">
      <xy-handle type="target" position="left"></xy-handle>
      <b>${data.title}</b>
      <xy-handle type="source" position="right"></xy-handle>
    </div>
  `,
});

flow.nodeTypes = { task };
flow.nodes = [{ id: '1', type: 'task', position: { x: 0, y: 0 }, data: { title: 'Hello' } }];
```

The first argument is `NodeProps`: `id`, `data`, `type`, `selected`, `dragging`, `width`, `height`, `zIndex`,
`isConnectable`, `positionAbsoluteX/Y`, `sourcePosition`, `targetPosition`, `dragHandle`, `parentId`, `draggable`,
`selectable`, `deletable`. The second is the flow's `FlowInstance`: call `flow.updateNodeData(id, { ... })`,
`flow.deleteElements(...)` or `flow.getNode(...)` from event handlers.

The function must return a Lit template, `nothing` or a string, and is called whenever the props change. Return
data-derived text with `${...}`: values are always escaped, and **XY Lit never renders HTML from data** (no
`unsafeHTML`, no tag names from data). To show structured content, branch in the template.

## Drawing the node

A custom type gets **no border, background or padding**. Only `default`, `input`, `output` and `group` have the
React Flow look; yours draws everything inside the `xy-node` wrapper, which has the position and the selection
class. Two helpers keep the interaction right:

- **`nodrag`**: add the class to anything interactive (inputs, buttons, sliders) so pressing it does not start a
  drag. The class names are configurable (`no-drag-class-name`, `no-pan-class-name`, `no-wheel-class-name`).
- **`nowheel`** on a scrollable area stops the wheel from zooming; with `wheel-scroll-detection="auto"` (the
  default) scrollable elements inside a node scroll natively until they reach their end.

### Handles

Place `<xy-handle type="target|source" position="left|right|top|bottom">` inside the markup. Several handles of one
type need a `handle-id`. Position them with CSS (`style="top: 12px"`). See
[handles and connections](/guide/handles-and-connections).

### Styles

`styles` (a Lit `css` result or an array) is adopted into the flow's root once per flow, deduplicated by object
identity, so many nodes of one type share one sheet. Write selectors for the light DOM of the node, for example
`.card .lit-flow__handle { ... }`. Use CSS custom properties from the page (`var(--vp-c-bg)`) or from the flow
(`--xy-node-background-color`) so the node follows [theming](/guide/theming) and dark mode.

## `FlowNodeElement`

For state, lifecycle or controllers, subclass `FlowNodeElement`. It renders into its own light DOM, receives the
node's `props` and the `flow`, and exposes `nodeId` and `data`.

```ts
import { html, css } from 'lit';
import { FlowNodeElement } from '@xy-lit/flow';
import type { Node } from '@xy-lit/flow';

class NumberNode extends FlowNodeElement<Node<{ value: number }>> {
  static override styles = css`
    number-node .box { padding: 8px 12px; border: 1px solid #c7d2fe; border-radius: 10px; background: #fff; }
  `;

  override render() {
    return html`<div class="box">
      <input class="nodrag" type="number" .value=${String(this.data.value)}
        @input=${(e: Event) => this.flow.updateNodeData(this.nodeId, { value: Number((e.target as HTMLInputElement).value) })} />
      <xy-handle type="source" position="right"></xy-handle>
    </div>`;
  }
}
customElements.define('number-node', NumberNode);

flow.nodeTypes = { number: 'number-node' }; // the tag name, or the constructor
```

Write `static styles` for the light DOM (`number-node .box`, never `:host`). Set `static resizer = { minWidth: 120 }` to
get a [node resizer](#resizing).

### Controllers

The equivalents of React Flow's hooks are Lit reactive controllers. Create them in a field or the constructor; they
re-render the host when their slice of the store changes.

| Controller | Value |
|---|---|
| `NodeConnectionsController(host, { handleType?, handleId? })` | the connections of this node (`source`, `target`, handles) |
| `HandleConnectionsController(host, ...)` | connections of one handle, to limit them |
| `NodesDataController(host, ids)` | `{ id, type, data }` of other nodes (`ids` may be a function) |
| `InternalNodeController(host, id)` | the engine's internal node (absolute position, bounds) |
| `NodesController`, `EdgesController`, `ViewportController` | reactive `flow.getNodes()`, `getEdges()`, viewport |
| `ConnectionController(host, selector?)` | the connection being dragged, to highlight handles |
| `NodesInitializedController`, `FlowInstanceController`, `StoreApiController` | measurement state, the instance, the store |
| `KeyPressController(host, 'Shift')` | whether a key is held |
| `OnSelectionChangeController`, `OnViewportChangeController` | callbacks without a re-render |

Controllers also take `{ store }` as the last argument, so they work in elements **outside** the flow when a
`<xy-flow-provider>` shares the store.

## Toolbars

`nodeToolbar(options, content)` renders `content` in a toolbar that follows the node, outside the scaled viewport so
it keeps its size. Call it in a renderer or a `FlowNodeElement.render`. By default it is shown while its node is the
only selected node; `isVisible` overrides that, and `position`, `align` and `offset` place it.

```ts
html`${data.title}
  ${nodeToolbar({ position: 'top', offset: 10 }, html`<button class="nodrag">Delete</button>`)}`;
```

## Resizing

`defineNodeType({ resizer: { minWidth: 120, minHeight: 60, keepAspectRatio: false } })` (or `static resizer`) makes
`<xy-node>` render an `<xy-node-resizer>` before your content: handles at the corners while selected. `variant:
'lines'` resizes by the edges and `'hover-corner'` shows one handle on hover. The node needs `width` and `height`;
write your content as `width: 100%; height: 100%`. Resizing sends `dimensions` and `position` changes with
`origin: 'resize'` and the phases `start`, `live`, `end`.

## Other node options

`Node` also takes `class` and `style` (strings for the `xy-node` host), `dragHandle` (a selector that restricts
dragging to part of the node), `draggable`, `selectable`, `connectable`, `deletable`, `focusable`, `hidden`,
`zIndex`, `ariaLabel`, `ariaRole`, `domAttributes` (`data-*`, `aria-*`, `title`, `lang`, `dir`, `tabindex` only;
anything else is dropped with warning `XYL01`) and `origin`.
