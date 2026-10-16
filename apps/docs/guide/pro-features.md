# Pro features

`@xy-lit/pro` adds the features editors need. Every function builds on the public store and instance APIs, so they
compose on one `<xy-flow>`; the order of installation does not matter.

```sh
pnpm add @xy-lit/pro
# layout algorithms are optional peers, install the ones you use
pnpm add @dagrejs/dagre elkjs d3-hierarchy d3-force
```

```ts
import '@xy-lit/flow/define.js';
import '@xy-lit/pro/define.js'; // registers <xy-helper-lines>
import {
  LocalHistory, installClipboard, installHelperLines, installDropIntoGroup,
  applyLayout, groupSelection, ungroup, toggleCollapsed, collapseAll, expandAll,
} from '@xy-lit/pro';

const flow = document.querySelector('xy-flow')!; // may be installed before it is connected
const history = new LocalHistory(flow, { maxSteps: 100 });
const clipboard = installClipboard(flow);
const helperLines = installHelperLines(flow);
const dropIntoGroup = installDropIntoGroup(flow);
```

Pure functions take a `FlowLike`: the `<xy-flow>` element **or** a `FlowInstance`, so a node's own "collapse" button can
call `toggleCollapsed(flow, id)` with the instance it receives. The `install*` functions need the element and return a
disposer.

<Demo name="pro" :height="460" caption="Drag nodes near each other for guide lines. Undo, redo, copy and paste (or Mod+Z, Mod+C, Mod+V), group the selection, collapse a branch, lay out with dagre." />

## History

`new LocalHistory(flow, { maxSteps = 100, ignoreOrigins? })` records the inverse of every change and binds Mod+Z,
Mod+Shift+Z and Mod+Y. `undo()`, `redo()`, `canUndo()`, `canRedo()`, `subscribe()`, `clear()`, `dispose()`, `batch(fn)`
(one step for everything `fn` changes) and `withoutRecording(fn)`.

- A **gesture** (drag, resize, animation, layout) is one step, pushed at `end`, and dropped when it ends where it started.
  Discrete batches that share a `gestureId` (delete, paste, group) merge into one step.
- Never recorded: origins `undo`, `measure`, `select`, `remote`, selection-only changes, `dragging`-only moves.
- Undo applies through the normal pipeline with `{ phase: 'discrete', origin: 'undo' }`, so a **controlled** app must apply
  those `nodes-change` / `edges-change` events like any other, synchronously.
- With a data source that has its own history (Yjs), the source wins and `LocalHistory` is inert (`history.active ===
  false`): install it unconditionally.

## Clipboard

`installClipboard(flow, { getId?, pasteOffset = 20, keys = true })` binds Mod+C, Mod+X, Mod+V and Mod+D to the active
flow and returns a disposer with `copy()`, `cut()`, `paste()` and `duplicate()` for buttons and menus. Copying writes
JSON to the system clipboard (and keeps an in-memory copy); pasting reads the browser's own `paste` event, so Firefox
does not prompt for permission. Pasted nodes and edges are selected and get new ids; a copied child without its parent
becomes a root at its absolute position; repeated pastes offset by `pasteOffset`. `serializeSelection`,
`parseClipboard` and `pasteElements(flow, payload, { at, offset, getId })` are the building blocks. Payload data goes
through `JSON.stringify`, so functions in `node.data` are lost. If the browser refuses the clipboard write you get a
`flow-error` with code `XYL30` once, and copy and paste keep working through memory.

## Helper lines

`installHelperLines(flow, { threshold = 6, snap = true, onChange?, render = true })` shows alignment guides while a node
is dragged and snaps it to them, including on drop. The returned disposer has a live `guides` getter. Style it with
`--xy-helper-line-color` and the parts `svg`, `line`, `vertical`, `horizontal` of `<xy-helper-lines>`. Multi-node drags
are not snapped. Needs the shadow render root; in `render-root="light"` pass `{ render: false }` and draw from `onChange`.

## Layout

```ts
await applyLayout(flow, { algorithm: 'dagre', direction: 'LR', animate: 300, fitView: true });
```

Algorithms: `dagre`, `elk`, `tree` (d3-hierarchy) and `force` (d3-force). They run in a module worker, falling back to the main
thread when it cannot start, and are loaded on demand: a missing peer rejects with a message naming the package.
`layout(nodes, edges, options, { worker })` is the pure function; `applyLayout` also applies the positions, animates
(`animate` in ms), fits the view and keeps the top-left where it was (`keepPosition`). It lays out **root nodes** (an
edge to a child counts for its root ancestor), from the **measured** sizes (150x40 for unmeasured nodes), so run it after
the first render. `layoutBackend()` reports `'worker' | 'main-thread' | 'idle'`.

Applications built with Vite need `worker: { format: 'es' }` for the layout worker.

## Animation

`animateNodePositions(flow, { id: { x, y }, ... }, { duration = 300, easing, respectReducedMotion = true })` moves nodes
smoothly, as one history step and one commit (a Yjs source sees one write at the end). It resolves `true`, or `false` when a
newer animation of any of the same nodes replaced it.

## Expand and collapse

`toggleCollapsed(flow, id, force?)` hides the nodes reachable through an edge subtree (and their edges) and returns the new
state, which is stored in `node.data.collapsed`. `collapseAll`, `expandAll`, `isCollapsed` and
`getCollapsibleDescendants` complete it. A node reachable from two roots stays visible while either is expanded. It works
on edges, not on `parentId`; your node renderer draws the toggle.

## Grouping

`groupSelection(flow, { type: 'group', padding: 20, data })` wraps the selected root nodes in a new group node sized to fit
them and returns its id; `ungroup(flow, id)` releases the children. `installDropIntoGroup(flow, { groupTypes })`
reparents nodes when a drag ends inside or outside a group. See [sub-flows](/guide/sub-flows).
