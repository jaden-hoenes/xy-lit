# Concepts

## Nodes, edges, handles

A **node** is a plain object: an `id`, a `position` in flow coordinates, a `data` object and optionally a `type`
that picks how it renders. An **edge** connects a `source` node to a `target` node, optionally at named handles
(`sourceHandle`, `targetHandle`). A **handle** is the connection point on a node: an `<xy-handle>` placed inside the
node's markup.

```ts
const nodes = [
  { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'A' } },
  { id: 'b', position: { x: 200, y: 80 }, data: { label: 'B' } },
];
const edges = [{ id: 'a-b', source: 'a', target: 'b', type: 'smoothstep', animated: true }];
```

The built-in node types are `default` (a target handle on top, a source handle on the bottom), `input`, `output`
and `group`. The built-in edge types are `default` (bezier), `straight`, `step`, `smoothstep` and `simplebezier`.
You add your own with [`defineNodeType`](/guide/custom-nodes) and [`defineEdgeType`](/guide/custom-edges).

## One tree, one shadow root

Everything a flow draws lives in **one DOM tree**: the shadow root of `<xy-flow>` (or the document, with
`render-root="light"`). `<xy-node>`, `<xy-handle>` and `<xy-edge>` have no shadow roots of their own, and neither do
your node renderers. This is what lets the engine measure handles and nodes and compute edge paths, and it has two
consequences you will meet:

- Page CSS does not reach nodes. Style them through [`defineNodeType({ styles })`, `adoptStyles()` or CSS custom
  properties](/guide/theming).
- Handles inside a nested shadow root are not supported. (`@xy-lit/ui`'s `<xy-base-node>` is the one deliberate
  shadow root inside a node; its handles are slotted light children.)

## Coordinates and the viewport

Node positions are in **flow coordinates**. The viewport is `{ x, y, zoom }`: the translation and scale that map flow
coordinates to pixels in the element. Convert with `flow.screenToFlowPosition({ x, y })` and
`flow.flowToScreenPosition({ x, y })`. `fit-view` fits the viewport to the nodes after the first measurement;
`flow.fitView({ padding, duration })` does it on demand, `setViewport`, `setCenter`, `zoomIn`, `zoomOut` and
`fitBounds` move it. Pan and zoom come from d3-zoom through the engine; see [interaction](/guide/interaction).

## The change pipeline

Every modification of nodes and edges, by the user or by code, becomes a **typed change** and goes through one
pipeline:

1. The user drags a node, selects it, connects two handles, presses Backspace, or your code calls
   `flow.updateNodeData()`, `deleteElements()`, ...
2. The store builds changes (`position`, `dimensions`, `select`, `add`, `remove`, `replace`) and a `meta` object:
   `{ phase, origin, gestureId? }`. `phase` is `start`, `live`, `end` or `discrete`; `origin` says where it came
   from (`drag`, `resize`, `keyboard`, `select`, `measure`, `connect`, `reconnect`, `delete`, `api`, `paste`,
   `undo`, `layout`, `remote`).
3. Registered **middlewares** may rewrite or drop them (helper lines snap positions this way).
4. The flow dispatches a cancelable `nodes-change` or `edges-change` event. If nobody calls `preventDefault()`,
   the **data source** applies the changes.

The demo logs step 4. Drag a node (`drag/start`, `drag/live`, `drag/end` share a `gestureId`), click to select,
connect two handles, select and press Backspace.

<Demo name="concepts" :height="320" caption="nodes-change, edges-change and connect, as they are dispatched." />

Because the phase and origin travel with the changes, an app can tell a live drag frame from the final position
(persist on `end`), a user edit from an `undo`, or a local change from a `remote` one.

## Data sources

Where nodes and edges live is a `FlowDataSource`. The default is an `ArraySource` that keeps plain arrays inside the
store: assign `flow.nodes` once and the flow applies changes itself. `@xy-lit/collab-yjs` provides a `YjsFlowSource`
that keeps them in a shared `Y.Doc`. You can implement the interface yourself (`nodes`, `edges`, `subscribe`,
`applyNodeChanges`, `applyEdgeChanges`, and optionally `updateNodeData`, `transact`, `history`).

## The store and the instance

Each `<xy-flow>` owns a `FlowStore` (from `@xy-lit/store`) unless it sits inside a `<xy-flow-provider>`, which lets
elements outside the flow (a sidebar, a toolbar) share it. `flow.instance` is the stable `FlowInstance`, the
imperative API that also backs the element's own methods. Controllers such as `NodesController` and
`ViewportController` (the equivalents of React Flow's hooks) subscribe a Lit element to slices of the store; see
the [custom nodes](/guide/custom-nodes) guide.

## Events

Names are kebab-case and match React Flow's callbacks: `node-click`, `node-drag-stop`, `edge-click`,
`selection-change`, `pane-click`, `move-end`, `connect`, `connect-end`, `reconnect`, `delete`, `viewport-change`,
`init`, `nodes-initialized`, `render-complete`, `flow-error`. All of them bubble and are composed. The flow only does
the work behind a pointer or move event when someone listens, so unused events are free. The
[`<xy-flow>` reference](/api/elements/xy-flow#events) lists every event with its `detail`.
