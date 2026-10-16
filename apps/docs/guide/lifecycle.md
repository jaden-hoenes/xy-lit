# Lifecycle

## Events in order

| Event | When | `detail` |
|---|---|---|
| `init` | The pan/zoom engine and the store are ready; the instance can be used. | `{ instance }` |
| `nodes-initialized` | Every node has been measured (once per flip from false to true; never for an empty graph). | `{ nodes }` |
| `render-complete` | Everything the flow knows about is rendered: nodes measured, edges drawn, a queued `fit-view` applied, then two animation frames. Once per structure revision. | `{ revision, nodeCount, edgeCount, durationMs }` |

A **revision** changes when the set of node or edge ids changes or a data source is attached, so adding a node, a
collaborator's insert or `flow.source = ...` each produce a new `render-complete`. With
`only-render-visible-elements`, only the visible nodes have to be measured.

<Demo name="lifecycle" :height="360" caption="Reload to see the three events with timings. The loading checkbox keeps the overlay up; motion replays the entrance on reload." />

## Waiting for a render

`flow.whenRendered()` resolves with the `render-complete` detail: immediately when the current revision is already
complete, otherwise on the next one. It is what the [tests](/guide/testing) and the docs demos wait for.

```ts
const flow = document.querySelector('xy-flow');
flow.nodes = nodes;
const { durationMs } = await flow.whenRendered();
await flow.fitView();
```

A controlled flow must apply `dimensions` changes or it never completes. A flow whose container has no height
completes after the fit timeout (400 ms by default, `fitViewOptions.timeout`) because `fit-view` cannot run.

## The loading overlay

Until the first `render-complete` the flow shows a spinner over the canvas (`.lit-flow__loading`,
`part="loading"`). It hides itself once and does not come back, except when a new data source is attached.

- `no-loading-overlay` turns it off.
- `loading` forces it on, for your own slow work (fetching a graph): set it, assign nodes, clear it.
- `<div slot="loading">` replaces the spinner with your own content.
- `--xy-loading-background`, `--xy-loading-color` and `--xy-loading-track` restyle it.

## Motion

`motion="enter"` fades and slides the **initial population** of nodes in with a stagger, and draws the first edges.
`motion="enter remote"` also animates nodes that a *collaborator* adds. It is skipped when the user prefers reduced
motion and when more than `motion-max-nodes` (300) nodes are visible. Tune it with `--xy-enter-duration`,
`--xy-enter-stagger` and `--xy-enter-easing`. Assigning a new `flow.source` replays the entrance.

## Connecting, moving and tearing down

The flow can be moved in the DOM and reconnected: `connectedCallback` rebuilds what `disconnectedCallback` destroys
(engine, observers, keyboard subscription). Properties assigned before the element upgrades reach the store on the
first update. `render-root` and `id` are read once, so set them as attributes (or before the element connects).

## Errors and warnings

Engine and store problems arrive as cancelable `flow-error` events (`detail: { code, message }`). Unhandled, they
become a `console.warn` in development builds. A few element-level problems (`XYL01`, `XYL03`, `XYL04`, `XYL06`,
`XYL07`, `XYL40`) are development warnings in the console only. Every message names the code and ends with a help
link to this section.

| Code | Meaning |
|---|---|
| `001`... | Upstream xyflow codes, such as the zero-size container `004` or a missing handle `008`. |
| `XYL00` | A store listener threw. |
| `XYL01` | A `domAttributes` key is not allowed (`data-*`, `aria-*`, `title`, `lang`, `dir`, `tabindex` only). |
| `XYL02` | `fitView` failed. |
| `XYL03` | An attribute has an invalid value, or a second flow under one provider keeps its own store. |
| `XYL04` | Handles inside nested shadow roots are not supported. |
| `XYL06` / `XYL07` | A plugin element outside a flow, or `<xy-viewport-portal>` outside a flow's direct children. |
| `XYL10` | A value cannot be stored in the Yjs document (a function or class instance in `data`). |
| `XYL20` / `XYL21` | The collaboration healer removed an element / the document is newer than this client. |
| `XYL30` | The clipboard write was refused (no permission); copies keep working in memory. |
| `XYL40` | An unknown shape name in `@xy-lit/ui`'s shape node. |
