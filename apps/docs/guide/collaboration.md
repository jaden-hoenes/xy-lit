# Collaboration

`@xy-lit/collab-yjs` turns a flow into a shared document. The flow does not know about Yjs: collaboration is a
**data source**. Assign a `YjsFlowSource` to `flow.source` and nodes, edges, undo history and presence flow through a
`Y.Doc`.

<Demo name="collaboration" :height="430" caption="Two flows, two documents and an in-memory relay with adjustable latency. Drag on one side, select, add nodes, go offline and reconnect, undo." />

## Wiring a flow

```sh
pnpm add @xy-lit/collab-yjs yjs y-protocols @hocuspocus/provider
```

```ts
import '@xy-lit/flow/define.js';
import '@xy-lit/collab-yjs/define.js'; // <xy-remote-cursors>, <xy-presence-avatars>
import { YjsFlowSource } from '@xy-lit/collab-yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

const doc = new Y.Doc();
const provider = new HocuspocusProvider({
  url: 'ws://localhost:1234',
  name: room, // the document name is the room
  document: doc,
  token: `user:${user.id}`,
});
// run migrations and repair only once local and remote state are in
const synced = new Promise((resolve) => provider.on('synced', resolve));

const source = new YjsFlowSource(doc, {
  awareness: provider.awareness!, // must be the provider's awareness (its client id is doc.clientID)
  user: { id: user.id, name: user.name, color: user.color },
  synced,
});

const flow = document.querySelector('xy-flow')!;
flow.append(
  document.createElement('xy-remote-cursors'), // sets slot="viewport-front" itself
  document.createElement('xy-presence-avatars'), // an overlay, position="top-right" by default
);
flow.source = source; // nodes and edges now live in Yjs; flow.nodes and flow.edges are ignored
await synced;
await flow.fitView(); // nothing existed at the first render
```

Any provider works as long as it syncs the `Y.Doc` and exposes a `y-protocols` `Awareness` (Hocuspocus,
y-websocket, WebRTC, a relay of your own as in the demo). `YjsFlowSource` options:

| Option | Meaning |
|---|---|
| `awareness`, `user` | enable presence; it is off unless **both** are given. |
| `synced` | a promise; migrations and healing wait for it. **Always pass it with a provider**: without it an empty local document can overwrite the server's `meta.schema` or heal a half-synced document. |
| `undo` | `false` to disable, or `{ captureTimeout }` (default 400 ms). |
| `livePositions` | `'awareness'` (default): live drags travel through awareness and the document is written once on drop; `'document'` writes every move (heavier). |
| `heal` | repair dangling edges and broken parents (default `true`). |
| `softLocks` | ignore moves and resizes of a node a remote user is dragging (default `true`). |
| `richText` | node type to the `data` keys stored as `Y.Text`, for example `{ note: ['body'] }`. Must be identical on every client. |
| `migrations` | schema migrations, `{ from, to, run(doc, maps) }`. |
| `readOnly` | ignore document writes (selection and presence still work); also a settable property. |
| `keys` | names of the top-level maps (`nodes`, `edges`, `meta`). |

Seed an empty room with `YjsFlowSource.populate(doc, { nodes, edges })` (it uses the `MIGRATION` origin, so it is not
undoable). Use fixed ids when several clients might seed the same room at once: the writes then collide on the same
keys instead of duplicating.

## What is stored

```
Y.Doc
├─ meta  : Y.Map  { schema, createdAt }
├─ nodes : Y.Map<id, Y.Map>   position, order (fractional index), data (a Y.Map: per-key merge), width, height, parentId, ...
└─ edges : Y.Map<id, Y.Map>   source, target, handles, order, data, label, markers, ...
```

Selection, `dragging`, `resizing`, `measured` and remote decorations are **local only**; they never reach the
document. Only explicit sizes (from the resizer) are stored. Values must be JSON-safe: a function or class
instance in `data` is rejected with `XYL10` (the node is skipped), and `undefined` deletes a key. `data` is a `Y.Map`,
so two users editing different keys of one node's data merge; use `flow.updateNodeData` for data edits (one map key per
change) and `source.transact(fn)` to group several writes into one transaction and one undo step.
`source.toObject()` gives the durable fields only, repaired and in order, for export.

## Presence

Awareness carries who is here and what they are doing:

- **Selection**: a remote user's selection puts `remote-selected` on the node and sets `--xy-remote-color`;
  `node.remote.selectedBy` lists the users.
- **Live drags and resizes**: while a user drags, others see the node move (about 30 to 60 Hz through awareness) with
  `remote-dragging`; the document is written once on drop. A node being dragged remotely is **soft-locked**: your own
  moves and resizes of it are ignored until the gesture ends (first gesture wins). Selecting and measuring are never
  blocked.
- **Cursors**: `<xy-remote-cursors>` draws every remote pointer in flow coordinates, scaled so that it keeps its size
  when you zoom; parts `cursor` and `name`.
- **Avatars**: `<xy-presence-avatars include-self max="5" position="top-right">` shows who is connected; the "N online" label counts everyone in the room including you, and `include-self` also
  adds your own avatar. Clicking an
  avatar calls `follow(clientId)`: your viewport follows theirs until you move it (`follow-change` event). Avatar
  URLs are limited to `http(s)`, `data:image` and `blob:`.
- **Inserts**: with `motion="enter remote"`, nodes a collaborator adds fade in and carry `node.remote.addedBy` for a
  moment.

`source.userOf(clientId)` resolves a client id to the user; `source.presence` is the `PresenceChannel` if you want to
publish your own fields. The elements need the shadow render root (`render-root="shadow"`, the default).

## Undo and redo

`source.history` is the document's `Y.UndoManager` behind the flow's `FlowHistory` interface
(`undo`, `redo`, `canUndo`, `canRedo`, `subscribe`, plus `stopCapturing`, `clear`, `undoManager`). Only your own local
edits are tracked, so **undo never reverts a collaborator's change**. A whole drag is one step; edits within
400 ms merge. The flow binds Mod+Z, Mod+Shift+Z and Mod+Y to it; call it from toolbar buttons and use `subscribe`
for the disabled state. With a Yjs source, `@xy-lit/pro`'s `LocalHistory` stays inert.

## Repair and migrations

Concurrent edits can leave a document inconsistent: one user deletes a node while another connects to it, two users add
the same edge, a parent is deleted under a child. Every client computes the same repaired view from the same
document, in a deterministic order:

| Issue (`RepairIssue.kind`) | Repair |
|---|---|
| `dangling-edge` | the edge is not rendered |
| `orphan-parent` | the child renders as a root (and loses `extent: 'parent'`) |
| `parent-cycle` | broken at the smallest id |
| `duplicate-edge` | the smallest id is kept |

Everyone renders the repaired view at once. The client with the lowest awareness id also **writes** the repair
(origin `HEAL`, not undoable) after 500 ms; the others re-check every 2 s. When an element was removed the flow
dispatches a `flow-error` with code `XYL20`, which an app can show as a toast. A server can heal too (below).

Schema changes: `meta.schema` carries the document version. A document **newer** than the client understands, or with
no migration path, makes the source read-only and reports `XYL21`. Older documents are migrated with your
`migrations`, in one `MIGRATION` transaction.

## The collaboration server

The repository ships a Hocuspocus server in `apps/collab-server`:

```sh
export COLLAB_PORT=1234
pnpm dev:collab                       # in memory
DB=/tmp/rooms.sqlite pnpm dev:collab  # persist rooms with SQLite
HEAL_DEBOUNCE_MS=500 pnpm dev:collab  # server-side repair delay, default 2000
```

Auth is a token of the form `user:<id>` or `user:<id>:ro` (read-only); anything else is rejected. After changes it
debounces per document and repairs with `healDoc(doc, 'server')`. `GET /` answers 200 (a health check). Use it as a
template: its checks are the ones to replace with your own authentication.

`@xy-lit/collab-yjs/server` has no Lit or DOM imports, so your own Node server can use the same functions:

```ts
import { healDoc, validateDoc } from '@xy-lit/collab-yjs/server';

const issues = validateDoc(doc); // RepairIssue[], writes nothing
const fixed = healDoc(doc, 'server'); // writes the repairs, returns the issues it fixed
```

## Errors

`flow-error` events: `XYL10` (a value cannot be stored), `XYL20` (the healer removed an element), `XYL21` (document too
new, source read-only). Handle them to tell the user.

## Offline and teardown

A provider that reconnects merges everything. Real browsers keep established WebSockets open when the network goes
away, so listen to `window` `offline` and `online` and call `provider.disconnect()` / `provider.connect()` for honest
offline UX. `y-indexeddb` gives a local copy that survives reloads (await its `whenSynced` before `synced`). To tear
down: `source.destroy()` (observers, undo manager, presence), then `provider.destroy()`.

## Testing

`packages/collab-yjs` is fuzzed: `pnpm fuzz` replays random concurrent operations over four replicas with delayed,
dropped and reordered delivery and asserts that all of them converge to the same repaired document
(`FUZZ_RUNS` defaults to 2000, CI uses 10000). `pnpm e2e:collab` drives two real browsers against the server.
