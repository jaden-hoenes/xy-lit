# 11 · `@xy-lit/collab-yjs`

Collaboration is a `FlowDataSource`. The flow doesn't know about Yjs; the app does
`flow.source = new YjsFlowSource(doc, { awareness, user })`. Transport is the app's choice
(Hocuspocus, y-websocket, y-webrtc, y-indexeddb); this package never imports a provider.

## Public API — `yjs-flow-source.ts`

```ts
export type YjsFlowSourceOptions = {
  awareness?: Awareness;                    // y-protocols/awareness; presence disabled without it
  user?: { id: string; name: string; color: string; avatar?: string };
  livePositions?: 'awareness' | 'document'; // default 'awareness'
  undo?: false | { captureTimeout?: number };   // default { captureTimeout: 400 }
  heal?: boolean;                           // default true
  softLocks?: boolean;                      // default true
  richText?: Record<string, string[]>;      // node type → data keys stored as Y.Text
  migrations?: Migration[];
  synced?: Promise<unknown>;                // run migrations / healing only after this resolves
  readOnly?: boolean;                       // ignore all doc writes (overlay + presence still work)
  keys?: { nodes?: string; edges?: string; meta?: string };   // default 'nodes' | 'edges' | 'meta'
};

export class YjsFlowSource<N extends Node = Node, E extends Edge = Edge> implements FlowDataSource<N, E> {
  constructor(doc: Y.Doc, options?: YjsFlowSourceOptions);
  readonly doc: Y.Doc;
  readonly nodes: N[]; readonly edges: E[];
  readonly structureVersion: number; readonly lastUpdateRemote: boolean;
  readonly history: FlowHistory | undefined;       // undefined when undo === false
  readonly presence: PresenceChannel | undefined;
  readonly issues: readonly RepairIssue[];          // from the last materialisation
  subscribe(listener: () => void): () => void;
  applyNodeChanges(changes: NodeChange<N>[], meta: ChangeMeta<N, E>): void;
  applyEdgeChanges(changes: EdgeChange<E>[], meta: ChangeMeta<N, E>): void;
  updateNodeData(id: string, patch: Partial<N['data']>, meta: ChangeMeta<N, E>): void;
  updateEdgeData(id: string, patch: Partial<NonNullable<E['data']>>, meta: ChangeMeta<N, E>): void;
  transact(fn: () => void, origin?: unknown): void;
  attach(store: FlowStore<N, E>): void;
  detach(): void;
  destroy(): void;                                  // detach + remove all Y observers + undo manager
  toObject(): { nodes: N[]; edges: E[] };          // durable fields only (no local, no remote)
  static populate(doc: Y.Doc, data: { nodes: Node[]; edges: Edge[] }, options?: Pick<YjsFlowSourceOptions, 'richText' | 'keys'>): void;
}
```

## Origins — `origins.ts`

```ts
export const LOCAL = Symbol('xy-lit/local');          // tracked by UndoManager
export const HEAL = 'xy-lit/heal';                   // repair writes, not undoable
export const MIGRATION = 'xy-lit/migration';
export const SERVER = 'server';                       // server-side repair
```

Every write from this package uses `doc.transact(fn, origin)`. Local user edits use
`LOCAL`. An `undo`/`redo` runs with the UndoManager as origin.

## Schema — `schema.ts`

```
Y.Doc
├─ meta  : Y.Map  { schema: 1, createdAt: number }
├─ nodes : Y.Map<id, Y.Map>
└─ edges : Y.Map<id, Y.Map>
```

`SCHEMA_VERSION = 1`.

Node `Y.Map` keys:

| Key | Stored as | Notes |
|---|---|---|
| `id`, `type` | string | |
| `position` | plain `{ x, y }` (ContentAny, atomic) | never two separate keys |
| `order` | string | fractional index (`fractional-indexing`) |
| `data` | `Y.Map<string, unknown>` | per-key merge; keys listed in `richText[type]` hold `Y.Text` |
| `width`, `height`, `initialWidth`, `initialHeight` | number | only explicit sizes (resizer `setAttributes`), never `measured` |
| `parentId`, `extent`, `expandParent`, `zIndex`, `hidden`, `draggable`, `selectable`, `connectable`, `deletable`, `focusable`, `dragHandle`, `sourcePosition`, `targetPosition`, `class`, `style`, `ariaLabel`, `ariaRole`, `origin`, `handles`, `domAttributes` | plain JSON | |
| any other top-level key the app sets | plain JSON | preserved |

Never stored (local only): `selected`, `dragging`, `resizing`, `measured`, `remote`,
`internals`. Edge `Y.Map` keys: `id`, `type`, `source`, `target`, `sourceHandle`,
`targetHandle`, `order`, `data` (`Y.Map`), and plain JSON for `label`, `startLabel`,
`endLabel`, `labelStyle`, `animated`, `hidden`, `deletable`, `selectable`, `focusable`,
`reconnectable`, `zIndex`, `markerStart`, `markerEnd`, `style`, `class`, `interactionWidth`,
`ariaLabel`, `ariaRole`, `offset`, `pathOptions`, `domAttributes`. Local only: `selected`.

`undefined` values are never written (delete the key instead). Values must be JSON-safe;
`toYNode`/`toYEdge` deep-clone plain values with `structuredClone` and reject functions
(dev error `XYL10`).

Conversion functions:

```ts
toYNode(node: Node, order: string, richText?: string[]): Y.Map<unknown>
toYEdge(edge: Edge, order: string): Y.Map<unknown>
fromYNode(y: Y.Map<unknown>): Node        // plain object; Y.Text → string via toString()
fromYEdge(y: Y.Map<unknown>): Edge
```

## Local overlay — `overlay.ts`

```ts
type NodeOverlay = {
  selected?: boolean; dragging?: boolean; resizing?: boolean;
  measured?: { width?: number; height?: number };
  livePosition?: XYPosition;                 // during a local drag/resize gesture
  liveSize?: { width: number; height: number };   // during a local resize gesture
};
type EdgeOverlay = { selected?: boolean };
```

Overlay entries for ids that no longer exist in the doc are dropped during materialisation.

## Local changes → Yjs — `applyNodeChanges` / `applyEdgeChanges`

All work for one call happens in one `doc.transact(fn, LOCAL)` (only if at least one doc
write is needed). Undo capture: at `meta.phase === 'start'` and `'end'` call
`undoManager.stopCapturing()` so one gesture is one undo step.

| Change | Phase | Effect |
|---|---|---|
| `position` | `start` / `live`, `livePositions: 'awareness'` | overlay `livePosition = position`, `dragging = change.dragging`; `presence.setDrag(ids, positions)` (rAF throttled) |
| `position` | `end` | write `position` for every id in the change set (use `livePosition` if the change has none); clear `livePosition`, `dragging = false`; `presence.setDrag(null)` |
| `position` | `discrete` (keyboard, api) | write `position` |
| `position` | any, `livePositions: 'document'` | write `position` every time (upstream behaviour) |
| `dimensions` with `setAttributes` | `start`/`live` | overlay `liveSize`, `resizing = true`; `presence.setResize(...)` |
| `dimensions` with `setAttributes` | `end`/`discrete` | write `width`/`height` (respect `'width'`/`'height'` values of `setAttributes`) |
| `dimensions` without `setAttributes`, `resizing: false` at `end` | `end` | commit `liveSize` and `livePosition` if present; clear overlay live fields; `presence.setResize(null)` |
| `dimensions` (measure) | `discrete` | overlay `measured` only |
| `select` | any | overlay `selected`; `presence.setSelection(...)` |
| `add` | any | `nodesY.set(item.id, toYNode(item, orderFor(index)))`; local fields of `item` go to the overlay |
| `remove` | any | delete the node, all edges whose `source`/`target` is that node, and all descendants (by `parentId`, recursively) |
| `replace` | any | diff `fromYNode(current)` vs `item` minus local keys: `set` changed top-level keys, `delete` removed keys; for `data`, set/delete changed keys inside the `Y.Map` (Y.Text keys: replace text only if the string differs, using a minimal diff: common prefix/suffix, then one delete + one insert) |

`orderFor(index)`: no index → `generateKeyBetween(maxOrder, null)`; with index → between the
orders of the nodes currently at `index - 1` and `index` in the materialised array.

`updateNodeData(id, patch)`: in a `LOCAL` transaction, `yData.set(k, v)` for each key
(`undefined` → delete). Same for edges.

`applyEdgeChanges`: `select` → overlay; `add` → `toYEdge`; `remove` → delete; `replace` → diff
as above.

Soft locks (`softLocks: true`): a node middleware registered in `attach()` drops `position`
and `dimensions(setAttributes)` changes for nodes that a remote user is dragging or resizing
(`remote.draggingBy`/`resizingBy`), so two users can't fight over one node. Advisory only.

## Yjs → arrays — `materialize.ts`

```ts
class Materializer<N, E> {
  nodeCache: Map<string, N>; edgeCache: Map<string, E>;
  orderedNodeIds: string[]; orderedEdgeIds: string[];   // recomputed only when structure is dirty
  rebuild(dirtyNodes: Set<string> | 'all', dirtyEdges: Set<string> | 'all', structureDirty: boolean): void;
}
```

- `nodesY.observeDeep((events, tx) => …)`: for each event take the top-level key: for events
  on `nodesY` itself, `event.changes.keys` (added/deleted ids → structure dirty); for nested
  events, `event.path[0]` is the node id. Keys `order` and `parentId` changing also mark
  structure dirty. Same for edges.
- Overlay changes and awareness changes mark individual ids dirty.
- `rebuild`: for each dirty id create a **new** plain object
  `{ ...fromYNode(y), ...overlayFields, position: overlay.livePosition ?? remoteDrag(id) ?? docPosition, width/height: liveSize ?? doc, remote: remoteMeta(id) }`
  (omit `remote` when empty). Untouched ids keep their cached object.
- When structure is dirty: run `orderAndRepair` (below) to compute ordered ids and the hidden
  set; else reuse.
- `this.nodes = orderedNodeIds.map(id => cache.get(id))` (new array only when any node object
  or the order changed; otherwise keep the old array so `syncFromSource` sees no change).
- Notify listeners once per Yjs transaction / overlay batch. Set `lastUpdateRemote =
  tx.origin !== LOCAL && !tx.local` during that notify. Bump `structureVersion` when the id set
  changed.

Initial construction does a full rebuild synchronously, so `nodes`/`edges` are ready before
`attach`.

## Repair — `repair.ts`

```ts
export type RepairIssue =
  | { kind: 'dangling-edge'; edgeId: string; missing: 'source' | 'target' }
  | { kind: 'orphan-parent'; nodeId: string; parentId: string }
  | { kind: 'parent-cycle'; nodeIds: string[]; brokenAt: string }
  | { kind: 'duplicate-edge'; keep: string; drop: string[] };
export function orderAndRepair(nodes: Map<string, Node>, edges: Map<string, Edge>, order: (id) => string):
  { nodeIds: string[]; edgeIds: string[]; nodePatches: Map<string, Partial<Node>>; issues: RepairIssue[] };
```

Deterministic rules (every client computes the same result from the same doc):

1. Node order: sort ids by `(order, id)`.
2. Orphan parent (parentId not present): render as root — patch `{ parentId: undefined }`
   (relative position used as absolute).
3. Parent cycles: walk parent chains; for each cycle break at the smallest id in it — patch
   `{ parentId: undefined }`.
4. Parents before children: stable topological order (depth-first from roots in step-1 order).
5. Dangling edges (missing endpoint node): drop from `edgeIds`.
6. Duplicate edges (same `source`, `sourceHandle ?? null`, `target`, `targetHandle ?? null`):
   keep the smallest id.
7. Edge order: `(order, id)`.

Patches apply to the materialised objects only (they produce new objects for affected ids).
Edges to unknown handles are left alone (the engine hides them with error 008).

Healing (`heal: true`): after a rebuild with issues, if this client is the **healer** — the
lowest `clientID` among awareness states (or itself without awareness) — schedule (500 ms
debounce, re-check issues first) one `doc.transact(…, HEAL)` that deletes dangling and
duplicate edges and clears broken `parentId`s. Report each healed issue that removed a user's
element through `store.emit('flow-error', { code: 'XYL20', message })` so apps can toast it.

## Presence — `awareness.ts`

```ts
export type PresenceState = {
  user: { id: string; name: string; color: string; avatar?: string };
  cursor?: XYPosition;                                     // flow coordinates
  selection?: { nodes: string[]; edges: string[] };
  drag?: { ids: string[]; positions: Record<string, XYPosition> };
  resize?: { id: string; width: number; height: number; position: XYPosition };
  connection?: { fromNode: string; fromHandle: string | null; fromType: HandleType; to: XYPosition };
  viewport?: Viewport;
  tool?: string;
};
export class PresenceChannel {
  constructor(awareness: Awareness, user: PresenceState['user']);
  readonly clientId: number;
  setCursor(p: XYPosition | null): void;     // throttled 33 ms (trailing)
  setSelection(s: PresenceState['selection'] | null): void;
  setDrag(d: PresenceState['drag'] | null): void;          // rAF-throttled
  setResize(r: PresenceState['resize'] | null): void;      // rAF-throttled
  setConnection(c: PresenceState['connection'] | null): void;  // rAF-throttled
  setViewport(v: Viewport | null): void;     // throttled 200 ms
  setTool(t: string | null): void;
  remotes(): Map<number, PresenceState>;     // excludes self and states without `user`
  subscribe(l: () => void): () => void;      // awareness 'change'
  destroy(): void;                           // clears local state fields
}
```

All fields live under one awareness field: `awareness.setLocalStateField('xyflow', state)`;
`user` is also written to the conventional `'user'` field (`{ name, color }`) for other Yjs
tools. Cleared on `destroy`, `pagehide`, and `visibilitychange` to hidden (cursor only).

`attach(store)` wires presence to the store: selection changes (subscribe to the store,
compare selected ids), connection state (`store.getState().connection`: when in progress,
publish `fromNode/fromHandle/fromType` and `to` converted to flow coordinates), viewport
(`move-end` is emitted on the flow; the source subscribes to `transform` changes instead,
throttled). Remote states feed the materialiser: `remote.selectedBy`, `remote.draggingBy`
(+ position override from `drag.positions`), `remote.resizingBy` (+ `liveSize` override),
`remote.addedBy` (set when a node appears in a remote transaction and the author's awareness
state is known; cleared after 1.5 s).

## Elements

`<xy-remote-cursors>` — light DOM child of `<xy-flow>` with `slot="viewport-front"` (it sets
the slot itself), `pointer-events: none`. Renders, per remote client with a `cursor`, an
absolutely positioned SVG arrow + name tag at the cursor's flow position, scaled by
`1 / zoom` (`transform: translate(x, y) scale(1/zoom)`, `transform-origin: 0 0`). Smooth with
one `PerfectCursor` per client (`perfect-cursors`), writing `style.transform` directly in its
callback. Also renders remote in-progress connections as dashed SVG paths
(`getBezierPath` from the remote `fromHandle` position to `to`) in the user's colour. Reports
the local cursor: listens to `pointermove`/`pointerleave` on its flow host (from context; not
document) and calls `presence.setCursor(instance.screenToFlowPosition(...))`.

`<xy-presence-avatars>` — shadow DOM, for use inside `<xy-panel>`. Lists remote users
(initials or avatar image, coloured ring). Click → follow mode: on every remote viewport
change, `instance.setViewport(remote.viewport, { duration: 120 })` until the local user pans
(listen for `move-start` with a non-null event). Double-click → `instance.setCenter(cursor.x,
cursor.y, { zoom: current, duration: 300 })`. Emits `follow-change` (`{ clientId | null }`).

## Undo — `undo.ts`

```ts
const undoManager = new Y.UndoManager([nodesY, edgesY], {
  trackedOrigins: new Set([LOCAL]),
  captureTimeout: options.undo?.captureTimeout ?? 400,
});
undoManager.on('stack-item-added', (e) => e.stackItem.meta.set('selection', localSelection()));
undoManager.on('stack-item-popped', (e) => restoreSelection(e.stackItem.meta.get('selection')));
```

`history: FlowHistory` wraps it (`undo`, `redo`, `canUndo = undoStack.length > 0`, …,
`subscribe` via `stack-item-added`/`stack-item-popped`/`stack-cleared`). Because live drags
only touch the overlay, undo sees committed results only. `restoreSelection` sets the overlay
`selected` flags (local only).

## Migrations — `migrations.ts`

```ts
export type Migration = { from: number; to: number; run(doc: Y.Doc, maps: { nodes: Y.Map<any>; edges: Y.Map<any>; meta: Y.Map<any> }): void };
```

After `options.synced` resolves (or immediately), if `meta.schema` is missing and the doc is
empty, set it to `SCHEMA_VERSION` (origin `MIGRATION`). If it's lower, run the matching chain in
one `MIGRATION` transaction and set the new version. A doc with a higher schema than the client
knows → `flow-error` `XYL21` and the source becomes read-only (all `apply*` calls ignored).
Unknown node types fall back to the default type (flow behaviour, error 003).

## Server entry — `@xy-lit/collab-yjs/server`

Second package entry (no Lit, no DOM): `validateDoc(doc, keys?)` → `RepairIssue[]` and
`healDoc(doc, origin = SERVER, keys?)` (applies the same healing writes). Used by
`apps/collab-server` in an `onChange` debounce.

## Read-only users

If the provider marks the connection read-only, the app sets
`flow.nodesDraggable = flow.nodesConnectable = false` and `flow.elementsSelectable = true`.
The source also accepts `readOnly: true` in options (all doc writes ignored, overlay and
presence still work).

## Tests

- `test/schema.test.ts`: round trip node/edge ↔ Y.Map for every key; local keys never written;
  `undefined` deletes.
- `test/source.test.ts` (two in-memory docs connected by `Y.applyUpdate` relay):
  uncontrolled flow-like usage through `FlowStore` with a fake host; drag phases produce no doc
  writes until `end` (count `doc.on('update')`); one undo step per drag; concurrent label edit
  and move both survive; `updateNodeData` writes only the patched keys; remove deletes
  connected edges and descendants; replace diff writes only changed keys; identity of untouched
  nodes preserved across a remote edit.
- `test/repair.test.ts`: every rule; determinism (shuffled input → same output).
- `fuzz/convergence.fuzz.ts` (fast-check, `numRuns` from env `FUZZ_RUNS`, default 2000 locally,
  10000 in CI): 2–4 docs, random ops (add, move, delete, reparent, connect, data edit, rich
  text edit, undo), random delivery order with drops and duplicates, partitions, then full sync.
  Assert identical `Y.encodeStateAsUpdate`-derived JSON, identical `orderAndRepair` output on all
  replicas, and invariants (no dangling edges rendered, no cycles, parents before children).
- `test/presence.browser.test.ts`: throttling, remote cursor rendering at zoom 0.5 and 2,
  follow mode.
- e2e `tests/e2e/collab/*.spec.ts` (two browser contexts against `apps/collab-server`): live drag
  preview on B while A drags, committed position after drop; A's undo doesn't revert B's edit;
  offline edits on both merge on reconnect (`context.setOffline`); remote cursor visible;
  dangling edge healed after concurrent delete + connect.
