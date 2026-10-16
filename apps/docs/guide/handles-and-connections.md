# Handles and connections

A **handle** is an `<xy-handle>` inside a node. Dragging from a handle draws a **connection line**; dropping it on a
compatible handle creates an edge.

<Demo name="handles" :height="380" caption="Connect a source to a target. With the colour rule on, only matching colours are accepted and the handle under the pointer turns red or green." />

## Handle attributes

| Attribute | Meaning |
|---|---|
| `type` | `source` (default) or `target`. |
| `position` | `top`, `right`, `bottom` or `left`: the side of the node, which also fixes the edge direction. |
| `handle-id` | Required when a node has several handles of one type. Edges refer to it as `sourceHandle` / `targetHandle`. |
| `is-connectable` | Overrides the node's connectability for this handle. |
| `is-connectable-start` / `is-connectable-end` | Whether a connection may start or end here (`true` by default). |

The `isValidConnection` **property** of a handle overrides the flow's validator for connections to that handle.

## Connection modes

In `connection-mode="strict"` (the default) a source connects only to a target. In `loose` any handle connects to
any other, which is what you want for diagrams with undirected ports. `connection-radius` (20 px) is how close the
pointer must get to a handle to snap to it; `connection-drag-threshold` is the distance before a drag starts.

## Validation

Two hooks decide what is allowed:

```ts
// refuse while dragging: handles show .connectingto without .valid
flow.isValidConnection = (connection) => connection.source !== connection.target;

// rewrite or refuse when the connection completes
flow.onBeforeConnect = (connection) => ({ ...connection, id: `e-${connection.source}-${connection.target}`, type: 'smoothstep' });
```

`isValidConnection` receives a `Connection` (`source`, `target`, `sourceHandle`, `targetHandle`) or an edge. Return
`false` to refuse. `onBeforeConnect` may return the edge to add, or a falsy value to drop it. The default action of
the cancelable `connect` event then adds the edge, merged over `defaultEdgeOptions`, with an id from `getEdgeId`.

### Styling the handles

While a connection is dragged, handles get state classes you style in your node's CSS:

| Class | Handle |
|---|---|
| `connectingfrom` | the handle the drag started at |
| `connectingto` | the handle under the pointer, or in range |
| `valid` | together with `connectingto`: the connection would be accepted |
| `connectionindicator` | handles that could take a connection |

`.lit-flow__handle.connectingto { background: red } .lit-flow__handle.connectingto.valid { background: green }` is
the whole validation feedback of the demo.

### Limiting connections

Use `HandleConnectionsController` or `NodeConnectionsController` to count connections and bind `is-connectable`:

```ts
class LimitedNode extends FlowNodeElement {
  #connections = new HandleConnectionsController(this, { type: 'target', id: 'in' });
  render() {
    return html`<xy-handle type="target" handle-id="in" position="left"
      .isConnectable=${this.#connections.value.length < 1}></xy-handle>`;
  }
}
```

## Click to connect

With `connect-on-click` (on by default) a click on a handle starts a connection and a click on another handle
completes it, so no drag is needed. It fires `click-connect-start` and `click-connect-end` (the end event also fires
when the second click lands on an invalid handle). It is the touch-friendly path.

## Events

| Event | `detail` |
|---|---|
| `connect-start` | `{ event, nodeId, handleId, handleType }` |
| `connect` | `{ connection, edge }` (cancelable) |
| `connect-end` | `{ event, connectionState }`: `connectionState.isValid`, the `toHandle` or `null` when dropped on the pane |
| `handle-connect`, `handle-disconnect` | on the `<xy-handle>` itself: `{ connections }` |

`connect-end` is the place to open a "create a node here" menu when `connectionState.toHandle` is `null`
(see the `add-node-on-edge-drop` example). `event.composedPath()` is empty after dispatch, so test the target inside
the handler.

## The connection line

`connection-line-type` (`default`, `straight`, `step`, `smoothstep`, `simplebezier`), `connection-line-style` and
`connection-line-container-style` style the line while dragging. For a custom one set the `connectionLineRenderer`
property: a function `(props, flow)` that returns an SVG template, with the start and end coordinates and positions, `fromNode`, `fromHandle`,
`toNode`, `toHandle`, `connectionStatus` (`'valid' | 'invalid' | null`) and `pointer`.

## Reconnecting

With `edges-reconnectable` (or per edge `reconnectable: true | 'source' | 'target'`), a selected or hovered edge
shows an anchor at each end. Dragging an anchor to another handle fires `reconnect-start`, then `reconnect`
(`{ oldEdge, newConnection, edge }`, cancelable; the default action replaces the edge) and `reconnect-end`. Use
`onBeforeReconnect(newEdge, oldEdge)` to rewrite the result. `reconnect-radius` (10 px) is the size of the anchor.
Anchors work with touch, which React Flow's do not.
