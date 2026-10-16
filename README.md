# XY Lit

[![CI](https://github.com/jaden-hoenes/xy-lit/actions/workflows/ci.yml/badge.svg)](https://github.com/jaden-hoenes/xy-lit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@xy-lit/flow?label=%40xy-lit%2Fflow)](https://www.npmjs.com/package/@xy-lit/flow)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Node-based UIs as web components. XY Lit is a [Lit](https://lit.dev) port of [React Flow](https://reactflow.dev) built
on the same engine, [`@xyflow/system`](https://github.com/xyflow/xyflow): drag, zoom, connect, select, resize and
lay out nodes and edges with `<xy-flow>`, from plain HTML or any framework, with optional real-time collaboration
through [Yjs](https://yjs.dev).

> **Status:** 0.x. The API may still change before 1.0; breaking changes are listed in the release notes of each
> version.

**[Documentation](https://jaden-hoenes.github.io/xy-lit/)** ·
**[Examples](https://jaden-hoenes.github.io/xy-lit/examples/)** ·
**[Storybook](https://jaden-hoenes.github.io/xy-lit/storybook/)**

```html
<script type="module">
  import '@xy-lit/flow/define.js';
  const flow = document.querySelector('xy-flow');
  flow.nodes = [
    { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Hello' } },
    { id: '2', position: { x: 160, y: 100 }, data: { label: 'World' } },
  ];
  flow.edges = [{ id: 'e1-2', source: '1', target: '2' }];
</script>
<xy-flow fit-view style="display: block; height: 400px">
  <xy-background></xy-background>
  <xy-controls></xy-controls>
</xy-flow>
```

## Why

- **Standards-based**: custom elements, one shadow root per flow, CSS custom properties and `::part` for styling,
  `CustomEvent`s for everything. No framework runtime to ship.
- **The React Flow engine**: pan and zoom, dragging, selection, connection validation, resizing, auto-pan and
  keyboard accessibility come from `@xyflow/system`, with React Flow's behaviour as the reference (the upstream
  end-to-end suite runs against XY Lit).
- **Collaboration as a data source**: `flow.source = new YjsFlowSource(doc, { awareness, user })` gives you shared
  state, per-user undo, cursors and self-healing documents.
- **Built for scale**: with `only-render-visible-elements`, a 10 000-node graph pans, zooms and drags at 60 fps; the
  performance guide has the measured numbers, including the fully visible cases.

## Packages

| Package | What it is |
|---|---|
| [`@xy-lit/store`](packages/store) | Framework-free state, change pipeline, data sources and the instance API |
| [`@xy-lit/flow`](packages/flow) | `<xy-flow>`, nodes, handles, edges, mini map, controls, background, resizer, toolbars |
| [`@xy-lit/collab-yjs`](packages/collab-yjs) | `YjsFlowSource`, presence, cursors, undo, repair, server helpers |
| [`@xy-lit/pro`](packages/pro) | Undo/redo, clipboard, helper lines, auto layout, animation, collapse, grouping |
| [`@xy-lit/ui`](packages/ui) | Node card, schema and shape nodes, zoom controls, node search, devtools |

## Quick start

```sh
pnpm add @xy-lit/flow
```

Import `@xy-lit/flow/define.js` once to register the elements, give `<xy-flow>` a height, and assign `nodes` and
`edges`. The [getting-started guide](https://jaden-hoenes.github.io/xy-lit/guide/getting-started) covers Lit, React 19,
Vue, Angular and Svelte.

## Browser support

Current versions of Chromium-based browsers, Firefox and Safari. The test suite (unit, conformance and end-to-end) runs
in Chromium, Firefox and WebKit in CI.

## Documentation, examples and demos

The hosted sites are linked at the top. To run everything locally (`pnpm install` first), each command uses a port you
can override with the environment variable in brackets.

| What | Command | Default URL |
|---|---|---|
| Documentation site (guides, live demos, API reference) | `pnpm dev:docs` | http://localhost:5176 (`DOCS_PORT`) |
| Examples (the reactflow.dev examples, stress pages, collaboration demo) | `pnpm dev` | http://localhost:5174 (`EXAMPLES_PORT`) |
| Storybook (every element and helper, with controls) | `pnpm dev:storybook` | http://localhost:6006 (`STORYBOOK_PORT`) |
| Collaboration server for the collab demos | `pnpm dev:collab` | ws://localhost:1234 (`COLLAB_PORT`) |

The collaboration demos on the hosted sites need that server; without it they show a "server not reachable" message.

## Contributing

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the test commands and the code
ground rules, and [SECURITY.md](SECURITY.md) to report a vulnerability. This project follows the
[Code of Conduct](CODE_OF_CONDUCT.md). The [`spec/`](spec) directory holds the design documents the implementation
follows.

## Acknowledgements

XY Lit is an independent project. It is **not affiliated with or endorsed by** xyflow, webkid GmbH or the React Flow
team. It builds on [`@xyflow/system`](https://github.com/xyflow/xyflow) (MIT) and ports code, styles and end-to-end
tests from xyflow at commit `3d35b57` (`@xyflow/system` 0.0.83, `@xyflow/react` 12.12.0, `@xyflow/svelte` 1.7.0);
the notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). "React Flow" is a trademark of its owners.
`Gliba/lit-flow` was used for ideas only. It has no licence file, so none of its code is copied.

## License

MIT, see [LICENSE](LICENSE). Ported xyflow code is credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
