# 09 · Contexts and controllers

React hooks become Lit `ReactiveController`s. Each file in `packages/flow/src/controllers/`
ports the named React hook from `.vendor/xyflow/packages/react/src/hooks/`.

## Contexts — `context.ts`

```ts
export type FlowContextValue = {
  store: FlowStore; instance: FlowInstance;
  flow: XyFlowElement | null;       // null under a provider with no flow yet
  hub: ConnectionHub | null; measure: MeasureController | null;
};
export const flowContext = createContext<FlowContextValue>(Symbol.for('xy-lit/flow'));
export const nodeIdContext = createContext<string>(Symbol.for('xy-lit/node-id'));
export const nodeConnectableContext = createContext<boolean>(Symbol.for('xy-lit/node-connectable'));
export const edgeIdContext = createContext<string>(Symbol.for('xy-lit/edge-id'));
```

`Symbol.for` keeps contexts working if two copies of the package are loaded.
`@lit/context` requests are composed events, so they cross the flow's shadow boundary in
both directions (elements inside the shadow root find the provider on the host; light-DOM
plugins find it because they are descendants of the host).

## `StoreController` — `controllers/store-controller.ts`

```ts
export class StoreController<T, N extends Node = Node, E extends Edge = Edge> implements ReactiveController {
  value!: T;
  constructor(host: ReactiveControllerHost & HTMLElement,
              selector: (s: FlowState<N, E>, store: FlowStore<N, E>) => T,
              equals: (a: T, b: T) => boolean = Object.is,
              options?: { store?: FlowStore<N, E> });   // explicit store skips context
  get store(): FlowStore<N, E> | undefined;
}
```

- Without `options.store`, it creates `new ContextConsumer(host, { context: flowContext, subscribe: true, callback })`.
- On attach (store available and host connected): compute `value`, subscribe; listener
  recomputes and calls `host.requestUpdate()` only when `!equals(prev, next)`.
- `hostConnected` re-attaches (and recomputes) after a reconnect; `hostDisconnected`
  unsubscribes.
- Export `shallow(a, b)` (port zustand's shallow for arrays, objects, Maps, Sets) from
  `@xy-lit/store`.

## Controllers

| Controller | Ports | `value` | Notes |
|---|---|---|---|
| `FlowInstanceController(host)` | `useReactFlow` | `FlowInstance \| undefined` | identity stable |
| `NodesController(host)` | `useNodes` | `N[]` | doc: re-renders on every drag frame |
| `EdgesController(host)` | `useEdges` | `E[]` | |
| `ViewportController(host)` | `useViewport` | `Viewport` | from `transform`, shallow |
| `NodeIdController(host)` | `useNodeId` | `string \| undefined` | `nodeIdContext` consumer |
| `InternalNodeController(host, id \| () => id)` | `useInternalNode` | `InternalNode \| undefined` | selector `nodeLookup.get(id)`, `===` with `lookupVersion` |
| `NodeConnectionsController(host, { id?, handleType?, handleId?, onConnect?, onDisconnect? })` | `useNodeConnections` | `NodeConnection[]` | id defaults to `nodeIdContext`; uses `connectionLookup` keyed like React; `areConnectionMapsEqual` + `handleConnectionChange` for callbacks |
| `HandleConnectionsController(host, { type, id?, nodeId? })` | `useHandleConnections` (deprecated upstream) | `HandleConnection[]` | kept for parity |
| `NodesDataController(host, ids \| () => ids)` | `useNodesData` | single or array of `{ id, type, data }` | equality `shallowNodeData` |
| `ConnectionController(host, selector?)` | `useConnection` | ConnectionState (with `to` converted by `pointToRendererPoint(to, transform)`) | shallow |
| `NodesInitializedController(host, { includeHiddenNodes? })` | `useNodesInitialized` | boolean | port selector logic |
| `KeyPressController(host, keyCode, { target?, actInsideInputWithModifier?, preventDefault? })` | `useKeyPress` | boolean | default target: shared `keyboardTracker`; with `target` (an element), listens on it while connected |
| `OnSelectionChangeController(host, cb)` | `useOnSelectionChange` | — | registers in `store.selectionChangeHandlers` |
| `OnViewportChangeController(host, { onStart?, onChange?, onEnd? })` | `useOnViewportChange` | — | listens to `move-start`/`move`/`move-end` on the flow element (from context) |
| `StoreApiController(host)` | `useStoreApi` | `FlowStore \| undefined` | |

Every controller accepts an optional last argument `{ store?: FlowStore }` for use outside a
flow or provider.

## Usage example (documentation snippet; must compile in `examples/`)

```ts
class SumNode extends FlowNodeElement<Node<{ value: number }>> {
  private inputs = new NodeConnectionsController(this, { handleType: 'target' });
  private values = new NodesDataController(this, () => this.inputs.value.map((c) => c.source));
  override render() {
    const total = (Array.isArray(this.values.value) ? this.values.value : [])
      .reduce((s, n) => s + ((n?.data as { value?: number })?.value ?? 0), 0);
    return html`<xy-handle type="target" position="left"></xy-handle>
      <span class="total">${total}</span>
      <xy-handle type="source" position="right"></xy-handle>`;
  }
}
```

## Tests

`controllers.browser.test.ts`: each controller updates its host exactly when the selected
value changes (count `updated()` calls), detaches on disconnect, re-attaches on reconnect, and
works with an explicit store outside a flow. `KeyPressController` combos and input exclusion.
