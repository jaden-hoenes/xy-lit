# 06 · Handles and connections

References: Svelte `components/Handle/Handle.svelte`, `components/ConnectionLine/ConnectionLine.svelte`,
`components/EdgeReconnectAnchor/EdgeReconnectAnchor.svelte`; React `components/Handle/index.tsx`,
`components/ConnectionLine/index.tsx`, `components/EdgeWrapper/EdgeUpdateAnchors.tsx`;
engine `.vendor/xyflow/packages/system/src/xyhandle/XYHandle.ts`.

## `<xy-handle>` — `elements/xy-handle.ts`

`XyHandleElement extends LitElement`, light render root, `render()` returns `nothing` (any
children the user puts inside stay as they are, e.g. a label).

| Property | Attribute | Type | Default |
|---|---|---|---|
| `type` | `type` | `'source' \| 'target'` | `'source'` |
| `position` | `position` | Position | `'top'` |
| `handleId` | `handle-id` | `string \| null` | null |
| `isConnectable` | `is-connectable` | `boolean \| undefined` | undefined → node's `connectable` (nodeConnectableContext) |
| `isConnectableStart` | `is-connectable-start` | boolean | true (`booleanAttr(true)`) |
| `isConnectableEnd` | `is-connectable-end` | boolean | true |
| `isValidConnection` | prop | IsValidConnection | undefined → flow's |

Contexts consumed (subscribe: true): `nodeIdContext`, `nodeConnectableContext`, `flowContext`.
No node id → throw `Error('xy-handle must be used inside a node')` in dev, render nothing in
production.

### Engine contract written on the host

Written in `willUpdate` (synchronously, so the classes exist before the first measurement):

- Attributes: `data-handleid` (`handleId` or remove when null), `data-nodeid`, `data-handlepos`
  (`position`), `data-id = `${flowId}-${nodeId}-${handleId ?? 'null'}-${type}``,
  `role="button"`, `aria-label = ariaLabelConfig['handle.ariaLabel']`, `tabindex="-1"`,
  `part="handle"`.
- Managed classes (toggle with `classList`, never overwrite `className`, so user classes
  survive): `lit-flow__handle`, `lit-flow__handle-${position}`, `${position}`,
  `noDragClassName`, `noPanClassName`, `source`|`target`, `connectablestart`, `connectableend`,
  `connectable`, `connectionindicator`, `connectingfrom`, `connectingto`, `valid`. Remove the
  previous position classes when `position` changes.

`connectionindicator` = `connectable && (!inProgress || isPossibleTarget) && (inProgress || clickStartHandle ? connectableEnd : connectableStart)`
(Svelte expression).

### Connection highlight without 20k subscriptions — `ConnectionHub`

A `ConnectionHub` (owned by `<xy-flow>`, exposed on `flowContext`) subscribes once to
`state.connection` and `state.connectionClickStartHandle`. Handles register with
`hub.register(key, handleEl)` where `key = `${nodeId}-${type}-${handleId ?? 'null'}``.

On change the hub computes `{ inProgress, fromKey, toKey, isValid, fromType, fromNodeId,
fromHandleId, clickStart }` and calls `handle.applyConnectionState(state)` on:
- all registered handles when `inProgress` or `clickStart` toggled (indicator class depends on it);
- otherwise only the handles whose key is the previous or new `fromKey`/`toKey`.

`applyConnectionState` recomputes `connectingfrom`, `connectingto`, `valid`,
`connectionindicator` with the Svelte rules (`isPossibleTarget` = Strict ? `fromType !== type` :
`nodeId !== fromNodeId || handleId !== fromHandleId`).

### Measuring

`connectedCallback` (after contexts resolved) and `disconnectedCallback`, and `updated()` when
`type`, `position` or `handleId` changed: `flow.measure.requestMeasure([nodeId])`. This replaces
most uses of `updateNodeInternals` (the instance method still exists).

### Pointer: starting a connection

Listeners on the host: `pointerdown`, `mousedown`, `touchstart` (passive: false), `click`.

```ts
onPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'touch' && e.button === 0 && this.isConnectableStart) {
    this.setPointerCapture(e.pointerId);   // §Pointer capture
  }
}
onMouseDownOrTouchStart(e: MouseEvent | TouchEvent) {
  const isMouse = isMouseEvent(e);
  if (isMouse && e.button !== 0) return;
  const s = store.getState();
  XYHandle.onPointerDown(e, {
    handleId, nodeId, isTarget: type === 'target',
    connectionRadius: s.connectionRadius, domNode: s.domNode, nodeLookup: s.nodeLookup,
    connectionMode: s.connectionMode, lib: 'lit', autoPanOnConnect: s.autoPanOnConnect,
    autoPanSpeed: s.autoPanSpeed, flowId: s.flowId,
    isValidConnection: this.isValidConnection ?? ((c) => store.getState().isValidConnection?.(c) ?? true),
    updateConnection: store.updateConnection, cancelConnection: store.cancelConnection, panBy: store.panBy,
    onConnect: (connection) => flow.handleConnect(connection),                      // §Connect
    onConnectStart: (event, params) => { this.suppressNextClick = true; emit('connect-start', { event, ...params }); },
    onConnectEnd: (event, connectionState) => emit('connect-end', { event, connectionState }),
    getTransform: () => store.getState().transform,
    getFromHandle: () => store.getState().connection.fromHandle,
    dragThreshold: s.connectionDragThreshold,
    handleDomNode: this,
  });
}
```

Only start when `isConnectableStart` (React checks `connectablestart`); target handles may
start connections (React allows it in both modes).

### Pointer capture ⚑

`XYHandle` attaches `mousemove`/`mouseup` listeners to `getHostForElement(target)`, which is
the flow's `ShadowRoot`. Events over elements outside the flow host never reach a shadow root,
so a mouse released outside the flow would leave the connection stuck. Pointer capture on the
handle retargets later pointer events, and the compatibility mouse events that follow them,
to the handle, which is inside the shadow root.

Pointer capture also makes the browser fire a `click` on the handle when the drag ends. The
`suppressNextClick` flag (set in `onConnectStart`, cleared on the next `pointerdown`) makes the
click handler ignore that click.

Verification is e2e test `lit/connection-outside.spec.ts` (start a connection, move the mouse
outside the flow host, release, and assert the connection line is gone and `connect-end`
fired), run in all three browsers. **Fallback if it fails in a browser:** during a connection
(between `onConnectStart` and `connect-end`) add temporary `window` listeners for
`mousemove`/`mouseup` (capture phase). For events whose `composedPath()` doesn't include the
flow host, dispatch a clone on the shadow root:
`root.dispatchEvent(new MouseEvent(e.type, { clientX, clientY, button, buttons, bubbles: true, composed: true }))`.
Remove them on `connect-end`. Record which browsers needed it in `00-decisions.md` §Changelog.
In light render-root mode none of this is needed (`getRootNode()` is the document).

### Click-connect

When `connectOnClick`, the `click` handler (skipped when `suppressNextClick`) ports Svelte's
`onclick`:

1. No start handle yet: if `!isConnectableStart` stop; emit `click-connect-start` and set
   `connectionClickStartHandle = { nodeId, type, id: handleId }`.
2. Start handle exists: `XYHandle.isValid(event, { handle: { nodeId, id: handleId, type }, connectionMode, fromNodeId, fromHandleId, fromType, isValidConnection, flowId, doc: getHostForElement(event.target), lib: 'lit', nodeLookup })`;
   if valid, `flow.handleConnect(connection)`; emit `click-connect-end` with a
   `FinalConnectionState` built like Svelte (clone of `connection` without `inProgress`,
   `toPosition` from `toHandle`); clear `connectionClickStartHandle`.

### Connect — `XyFlowElement.handleConnect(connection)`

```ts
const s = store.getState();
const before = s.onBeforeConnect ? s.onBeforeConnect(connection) : connection;
if (!before) return;
const edge = { id: s.getEdgeId(connection), ...s.defaultEdgeOptions, ...before } as E;
if (!emit('connect', { connection, edge }, true)) return;
store.triggerEdgeChanges([{ type: 'add', item: edge }], { phase: 'discrete', origin: 'connect' });
```

Skip adding when an edge with the same id already exists (upstream `addEdge` dedupe:
`connectionExists`) — report nothing, just return.

### Handle connection events

`<xy-handle>` dispatches `handle-connect` / `handle-disconnect` (`{ connections: HandleConnection[] }`,
bubbles, composed) when its entry in `connectionLookup` changes — Svelte's `onconnect` /
`ondisconnect`. To avoid per-handle subscriptions, the element overrides `addEventListener`:
the first listener for either type starts a `StoreController` on `edges` that compares
`connectionLookup.get(key)` with `areConnectionMapsEqual` and uses `handleConnectionChange`.

## Connection line — `connection-line.ts`

Rendered by `<xy-flow>` inside the viewport (flow coordinates), only while
`connection.inProgress`:

```ts
const c = connection;            // from state; `to` is container-relative screen space
const to = pointToRendererPoint(c.to, transform);
const status = getConnectionStatus(c.isValid);    // 'valid' | 'invalid' | null
html`<svg class="lit-flow__connectionline lit-flow__container" style=${containerStyle ?? nothing}>
  <g class="lit-flow__connection ${status ?? ''}">
    ${renderer ? renderer(props, instance) : svg`<path d=${path} fill="none" class="lit-flow__connection-path" style=${lineStyle ?? nothing}></path>`}
  </g>
</svg>`
```

`path` by `connectionLineType` (Svelte switch): bezier → `getBezierPath`, straight →
`getStraightPath`, step → `getSmoothStepPath({ borderRadius: 0 })`, smoothstep →
`getSmoothStepPath`, simplebezier → `getSimpleBezierPath` (port React
`components/Edges/SimpleBezierEdge.tsx` helper into `edges/simple-bezier.ts`). The connection
line selector includes `transform` so it re-renders during auto-pan.

## Reconnect anchors — `edges/reconnect-anchors.ts`

Rendered by `<xy-edge>` inside its `<g>` (React `EdgeUpdateAnchors`) when
`isReconnectable = edge.reconnectable ?? edgesReconnectable` and the edge is not being
reconnected:

```ts
svg`<circle class="lit-flow__edgeupdater lit-flow__edgeupdater-source" cx=${sourceX} cy=${sourceY}
            r=${reconnectRadius} stroke="transparent" fill="transparent"
            @pointerdown=${(e) => start(e, 'source')}></circle>`   // and the target one
```

`'source'` / `'target'` restrict to one end. `start(event, end)` ports Svelte
`EdgeReconnectAnchor.onPointerDown`: the *opposite* end is the fixed handle, call
`XYHandle.onPointerDown` with `edgeUpdaterType: opposite.type`, `handleDomNode: event.currentTarget`,
`onConnectStart` → set `reconnecting` state on the edge (hides its path), emit `reconnect-start`
and `connect-start`; `onConnect(connection)` → `flow.handleReconnect(oldEdge, connection)`;
`onReconnectEnd` → clear `reconnecting`, emit `reconnect-end`. Pointer capture as for handles.

`handleReconnect(oldEdge, connection)`:

```ts
const merged = { ...oldEdge, ...connection } as E;
const next = s.onBeforeReconnect ? s.onBeforeReconnect(merged, oldEdge) : merged;
if (!next) return;
if (!emit('reconnect', { oldEdge, newConnection: connection, edge: next }, true)) return;
store.triggerEdgeChanges([{ type: 'replace', id: oldEdge.id, item: next }], { phase: 'discrete', origin: 'reconnect' });
```

## Tests

- `xy-handle.browser.test.ts`: contract attributes/classes exact strings (`data-id`
  `1-a-null-source`); user classes survive updates; position change swaps classes and re-measures;
  handle added after first render gets measured (edge appears); hub updates only affected
  handles (spy on `applyConnectionState`); click-connect; `suppressNextClick`.
- e2e `lit/connection-outside.spec.ts` (above) and `lit/reconnect.spec.ts`.
