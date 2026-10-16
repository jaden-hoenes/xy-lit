# Getting started

XY Lit gives you `<xy-flow>`, a custom element that renders draggable nodes and connectable edges on a pannable,
zoomable canvas. It is a port of [React Flow](https://reactflow.dev) built on the same engine, so the behaviour,
vocabulary and most of the API will look familiar.

## Install

```sh
pnpm add @xy-lit/flow
```

| Package | Use it for |
|---|---|
| `@xy-lit/flow` | The flow, nodes, handles, edges and plugins. It re-exports the whole store API. |
| `@xy-lit/store` | The framework-free store, when you build on your own binding or work in Node. |
| `@xy-lit/collab-yjs` | [Collaboration](/guide/collaboration) with Yjs. |
| `@xy-lit/pro` | [Undo, clipboard, layout, grouping](/guide/pro-features). |
| `@xy-lit/ui` | [Ready-made nodes, edges and panels](/guide/ui-components). |

Lit is a regular dependency of `@xy-lit/flow`. The packages are ES modules and need a bundler (Vite, esbuild,
webpack) or an import map that resolves `lit`, `@lit/context` and `@xy-lit/*`.

## Your first flow

Import `@xy-lit/flow/define.js` once. It is the only module with side effects: it registers `xy-flow` and its
siblings (`xy-node`, `xy-handle`, `xy-edge`, `xy-controls`, `xy-minimap`, `xy-background`, `xy-panel`, ...).
Registration is idempotent, so a second copy of the package does not throw.

```html
<xy-flow id="flow" fit-view style="display: block; height: 400px">
  <xy-background></xy-background>
  <xy-controls></xy-controls>
  <xy-minimap pannable zoomable></xy-minimap>
</xy-flow>

<script type="module">
  import '@xy-lit/flow/define.js';

  const flow = document.getElementById('flow');
  flow.nodes = [
    { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Hello' } },
    { id: '2', position: { x: 180, y: 110 }, data: { label: 'World' } },
    { id: '3', type: 'output', position: { x: 0, y: 220 }, data: { label: 'Drag me' } },
  ];
  flow.edges = [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e2-3', source: '2', target: '3' },
  ];
</script>
```

<Demo name="getting-started" :height="340" caption="The flow above. Drag nodes, drag from a handle to connect, scroll with Ctrl or Cmd to zoom." />

Three things to notice:

- **Nodes and edges are properties**, not attributes, because they are objects. Everything scalar is also an
  attribute in kebab-case: `fit-view`, `min-zoom`, `snap-to-grid`, `color-mode`. Boolean attributes that default to
  `true` accept `"false"` to turn them off (`nodes-draggable="false"`). The [API reference](/api/elements/xy-flow)
  lists every attribute.
- **Plugins are children.** `<xy-background>`, `<xy-controls>`, `<xy-minimap>` and `<xy-panel>` find their flow
  through context, so they only work inside a `<xy-flow>` (or inside a `<xy-flow-provider>`).
- **Everything is an event.** The flow dispatches `CustomEvent`s that bubble and are composed:
  `flow.addEventListener('connect', (e) => e.detail.connection)`. The listener is typed for `XyFlowElement`.

## The sizing rule

Like React Flow, the flow fills its container and needs a size. `<xy-flow>` is `display: block`, `position:
relative` and `overflow: hidden`, but it has no intrinsic height: give it one with CSS (a fixed height, a flex or
grid cell, `height: 100vh`). In development a flow whose height is 0 reports upstream error `004` through the
`flow-error` event.

```css
xy-flow { display: block; height: 480px; }
```

## With Lit

In a Lit element, set `nodes` and `edges` as properties. A property binding to an object or an array is set on
**every render**, and the flow owns its nodes once you hand them over (see
[controlled vs uncontrolled](/guide/controlled-vs-uncontrolled)), so a plain `.nodes=${nodes}` in a template that
re-renders would reset the flow to the initial nodes. Bind it once with `guard`, or set it imperatively.

```ts
import { LitElement, css, html } from 'lit';
import { guard } from 'lit/directives/guard.js';
import '@xy-lit/flow/define.js';
import type { Edge, Node } from '@xy-lit/flow';

const nodes: Node[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'One' } },
  { id: '2', position: { x: 160, y: 80 }, data: { label: 'Two' } },
];
const edges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }];

class MyDiagram extends LitElement {
  static override styles = css`
    xy-flow { display: block; height: 400px; }
  `;

  override render() {
    return html`<xy-flow
      .nodes=${guard([], () => nodes)}
      .edges=${guard([], () => edges)}
      fit-view
      @connect=${(e: CustomEvent) => console.log(e.detail.connection)}
    >
      <xy-controls></xy-controls>
    </xy-flow>`;
  }
}
customElements.define('my-diagram', MyDiagram);
```

Other frameworks need no wrapper: see [Frameworks](/guide/frameworks) for React 19, Vue, Angular and Svelte.

## Typed access

`@xy-lit/flow` exports the types you need (`Node`, `Edge`, `Connection`, `FlowInstance`, `NodeChange`, ...) and
augments `HTMLElementTagNameMap`, so `document.querySelector('xy-flow')` is an `XyFlowElement`. The element
implements the whole `FlowInstance` API (`fitView()`, `getNodes()`, `screenToFlowPosition()`, `updateNodeData()`,
...), so you rarely need `flow.instance`.

```ts
import type { XyFlowElement } from '@xy-lit/flow';

const flow = document.querySelector<XyFlowElement>('xy-flow')!;
await flow.whenRendered(); // nodes measured, edges drawn
await flow.fitView({ padding: 0.2 });
```

## Where next

- [Concepts](/guide/concepts): nodes, edges, handles, the viewport and the change pipeline.
- [Custom nodes](/guide/custom-nodes) and [custom edges](/guide/custom-edges).
- [Migrating from React Flow](/guide/migrating-from-react-flow) if you know React Flow already.
- [Examples](/examples/): the reactflow.dev examples, ported.
