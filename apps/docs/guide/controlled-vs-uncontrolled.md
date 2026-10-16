# Controlled vs uncontrolled

A flow can own its nodes and edges, or your application can. Both modes use the same pipeline; the only difference
is who applies the changes.

## Uncontrolled (the default)

Hand the flow its nodes and edges once. From then on it applies every change itself, and you read the current state
through the API.

```ts
flow.nodes = initialNodes;
flow.edges = initialEdges;

flow.addEventListener('node-drag-stop', (e) => save(e.detail.node));
const { nodes, edges, viewport } = flow.toObject(); // snapshot for persistence
flow.updateNodeData('n1', { label: 'Renamed' });
flow.addNodes({ id: 'n9', data: { label: 'New' } }); // placed at a free position
```

Assigning `flow.nodes` again **replaces** the flow's nodes with the array you pass. That is what you want to load a
saved graph, and exactly what you do not want in a Lit template that re-renders (see
[getting started](/guide/getting-started#with-lit)).

## Controlled

Own the arrays yourself: cancel the change events and apply the changes to your state.

```ts
import { applyEdgeChanges, applyNodeChanges } from '@xy-lit/flow';

let nodes = [...];
let edges = [...];
flow.nodes = nodes;
flow.edges = edges;

flow.addEventListener('nodes-change', (e) => {
  e.preventDefault(); // the flow now applies nothing by itself
  nodes = applyNodeChanges(e.detail.changes, nodes);
  flow.nodes = nodes;
});
flow.addEventListener('edges-change', (e) => {
  e.preventDefault();
  edges = applyEdgeChanges(e.detail.changes, edges);
  flow.edges = edges;
});
```

Rules of controlled mode:

- **Apply `dimensions` changes.** They carry the measured size of each node. A node is hidden until it is measured,
  so a controlled flow that drops them shows nothing.
- **`flow.nodes = nodes` does not echo.** Assigning hands the flow the new array; it does not produce another
  `nodes-change`.
- `e.detail.meta` tells you why: filter by `meta.origin` or `meta.phase`, or veto some changes by removing them from
  the array before applying it, as the demo does for positions.
- A new connection arrives as `connect` with the edge that would be added in `e.detail.edge`. If you cancel
  `edges-change` it arrives there as an `add` change; if you cancel `connect`, add `e.detail.edge` yourself.

<Demo name="controlled" :height="360" caption="The app holds the arrays. Tick the box to veto drags: nodes stay where the app state says." />

## Controlled viewport

Set `flow.viewport = { x, y, zoom }` to control the viewport; listen to `viewport-change` and write it back. Leave
`viewport` unset (use `default-viewport` for the start) and the flow pans and zooms by itself.

## Choosing

| | Uncontrolled | Controlled |
|---|---|---|
| State lives in | the flow's store | your application |
| You write | `flow.nodes = ...` once, event listeners | `nodes-change` / `edges-change` handlers |
| Good for | most apps, drag-heavy canvases, collaboration | validation of every edit, state machines, an existing store (Redux, signals) |
| Undo/redo | `@xy-lit/pro` `LocalHistory`, or Yjs | yours, or `LocalHistory` (apply `origin: 'undo'` changes synchronously) |

## Other data sources

`flow.source = new YjsFlowSource(doc, ...)` replaces the array source with a shared document: the changes are
written to Yjs, remote edits flow back, and `flow.nodes` is ignored. See [Collaboration](/guide/collaboration).
Changes still pass through the middlewares and the cancelable events, so a controlled app can sit on top of any
source.
