# @xy-lit/flow

Lit web components for node-based editors and diagrams: `<xy-flow>`, nodes, handles, edges, mini map, controls,
background, node resizer and toolbars. A port of [React Flow](https://reactflow.dev) built on `@xyflow/system`, usable
from plain HTML or any framework.

## Install

```sh
pnpm add @xy-lit/flow lit
```

`lit` is a regular dependency of this package; install it if you also write Lit components.

## Usage

```html
<script type="module">
  import '@xy-lit/flow/define.js'; // registers every element, once

  const flow = document.querySelector('xy-flow');
  flow.nodes = [
    { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Hello' } },
    { id: '2', position: { x: 160, y: 100 }, data: { label: 'World' } },
  ];
  flow.edges = [{ id: 'e1-2', source: '1', target: '2' }];
</script>

<!-- the flow fills its box, so give it a height -->
<xy-flow fit-view style="display: block; height: 400px">
  <xy-background></xy-background>
  <xy-controls></xy-controls>
  <xy-minimap></xy-minimap>
</xy-flow>
```

- `@xy-lit/flow` exports the classes, node and edge helpers, controllers and the whole `@xy-lit/store` API.
  Importing it registers nothing; `@xy-lit/flow/define.js` is the only module with side effects.
- Nodes and edges you assign are owned by the flow afterwards (uncontrolled). To control them, listen for
  `nodes-change` / `edges-change`, call `preventDefault()` and apply the changes yourself.
- `custom-elements.json` ships with the package (`exports["./custom-elements.json"]`) for editors and tooling.

Documentation: [XY Lit documentation](https://jaden-hoenes.github.io/xy-lit/guide/getting-started) (guides, live demos, API reference).
Source and issues: <https://github.com/jaden-hoenes/xy-lit>. MIT licensed; ported xyflow code is credited in
`THIRD_PARTY_NOTICES.md`.
