# 12 · `@xy-lit/pro` and `@xy-lit/ui`

These are clean-room implementations of behaviours described on reactflow.dev's public
example pages. Don't consult or copy React Flow Pro example source.

Every feature here is built only on public APIs: `FlowInstance`, `FlowStore` actions,
change middlewares, events, `nodeToolbar`/`edgeLabel` helpers and slots.

## `@xy-lit/pro`

```
packages/pro/src/
  index.ts
  history/local-history.ts      LocalHistory implements FlowHistory
  clipboard/clipboard.ts        installClipboard()
  helper-lines/helper-lines.ts  installHelperLines() + <xy-helper-lines>
  layout/layout.ts              layout(), applyLayout()
  layout/worker.ts              worker entry (dagre, elk, d3-hierarchy, d3-force)
  animation/animate.ts          animateNodePositions()
  collapse/collapse.ts          toggleCollapsed(), collapseAll(), expandAll()
  grouping/grouping.ts          groupSelection(), ungroup(), installDropIntoGroup()
  define.ts
```

Each `install*` returns a disposer `() => void`.

### Local undo/redo — `LocalHistory`

```ts
export class LocalHistory implements FlowHistory {
  constructor(flow: XyFlowElement, options?: { maxSteps?: number /* 100 */ });
  undo(): void; redo(): void; canUndo(): boolean; canRedo(): boolean;
  subscribe(l: () => void): () => void;
  clear(): void; dispose(): void;
}
```

- Registers node and edge middlewares (they return changes unchanged) and
  `store.setHistory(this)`. A source with its own `history` (Yjs) wins automatically.
- Records **inverse** changes from the state before the change is applied:
  `position` → previous `position` (for a gesture, capture originals at `start`, push one
  step at `end`); `dimensions` with `setAttributes` → previous `width`/`height` (+ position
  for resizes, grouped by `gestureId`); `add` → `remove`; `remove` → `add` with the original
  item and its index; `replace` → `replace` with the previous item. Ignores `select`,
  measurement, and `dragging`-only changes.
- Changes with `meta.origin === 'undo'` aren't recorded as new steps. Undo applies the inverse
  through `triggerNodeChanges`/`triggerEdgeChanges` with `{ phase: 'discrete', origin: 'undo' }`
  and pushes the forward step onto the redo stack. A new recorded step clears redo.
- One `deleteElements` call (nodes + edges) is one step: group by a `meta.gestureId` that the
  instance sets for multi-trigger operations (`deleteElements`, paste, layout).
- Selection is restored with the step (store the selected ids, re-select via `addSelectedNodes`).

### Clipboard — `installClipboard(flow, options?)`

Options: `{ getId?: (old: string) => string; pasteOffset?: number /* 20 */; keys?: boolean /* true */ }`.

- Copy/cut: selected nodes, plus all descendants of selected group nodes, plus edges with both
  ends in that set. Serialise as `{ "xy-lit": 1, nodes, edges }` with local fields stripped
  (`selected`, `dragging`, `resizing`, `measured`, `remote`).
- Listens for `copy`/`cut`/`paste` events on the flow host (they reach it when focus is inside
  the flow) and writes `text/plain` + `application/x-xy-lit+json`. With `keys`, also handles
  Mod+C/X/V/D through `keyboardTracker` when the flow is active and focus isn't in an input,
  using `navigator.clipboard.writeText/readText` (permission errors → `flow-error` `XYL30`).
- Paste: parse; new ids via `getId ?? (id => `${id}-${crypto.randomUUID().slice(0, 6)}`)`;
  remap `parentId`, `source`, `target`; position: if `lastPointerFlowPosition` is inside the
  viewport, translate the copied set so its bounding box's top-left is at the pointer,
  otherwise offset by `pasteOffset` per repeated paste. Unselect everything, add with
  `selected: true`. One history step. Mod+D duplicates without touching the clipboard.

### Helper lines — `installHelperLines(flow, options?)`

Options: `{ threshold?: number /* 6 screen px */; snap?: boolean /* true */ }`.

- Node middleware on `position` changes with phase `start`/`live` for a single dragged node
  (skip multi-node drags). Build an `rbush` of other visible nodes' absolute rects once per
  gesture (at `start`). For the dragged rect, find the closest candidate for vertical
  alignment (left↔left, left↔right, right↔left, right↔right, centerX↔centerX) and horizontal
  alignment (top/bottom/centerY) within `threshold / zoom`. When `snap`, adjust the change's
  position by the delta. Publish the guides `{ vertical?: { x, y1, y2 }, horizontal?: { y, x1, x2 } }`.
- `<xy-helper-lines>`: light-DOM child placed with `slot="viewport-front"` (installHelperLines
  appends it), renders one SVG with up to two lines in flow coordinates, stroke width `1/zoom`.
  Cleared at `end`.

### Layout — `layout(nodes, edges, options)` and `applyLayout(flow, options)`

```ts
type LayoutOptions =
  | { algorithm: 'dagre'; direction?: 'TB' | 'LR' | 'BT' | 'RL'; nodesep?: number; ranksep?: number }
  | { algorithm: 'elk'; elkOptions?: Record<string, string> }
  | { algorithm: 'tree'; direction?: 'TB' | 'LR'; nodeSize?: [number, number] }
  | { algorithm: 'force'; iterations?: number; strength?: number };
export function layout(nodes: InternalNode[], edges: Edge[], options: LayoutOptions): Promise<Map<string, XYPosition>>;
export function applyLayout(flow: XyFlowElement, options: LayoutOptions & { animate?: number; fitView?: boolean }): Promise<void>;
```

Runs in a module Web Worker (`new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`)
that dynamically imports the algorithm's peer dependency (missing peer → reject with a clear
message). Uses measured sizes. Root nodes only (children keep relative positions). `applyLayout`
animates with `animateNodePositions` when `animate > 0`, then `fitView` when asked. One history
step.

### Node position animation — `animateNodePositions(flow, targets, options?)`

`options: { duration?: 300; easing?: (t) => number /* easeInOutCubic */ }`. Uses a gesture:
first frame `updateNodePositions(map, true, { origin: 'layout' })` (phase `start`), rAF frames
(`live`), last frame `updateNodePositions(map, false, { origin: 'layout' })` (`end`). With a
Yjs source the in-between frames are local overlay only and collaborators see one commit.
Returns a promise; a new animation for the same nodes cancels the old one.

### Expand/collapse — `toggleCollapsed(flow, nodeId)`

Stores state in `node.data.collapsed: boolean` (via `updateNodeData`). Descendants = nodes
reachable through outgoing edges (`getOutgoers`, iteratively) that are not reachable from any
other root without passing through `nodeId`. Collapsing sets `hidden: true` on them (and their
edges, which the engine hides automatically); expanding clears it for descendants not under
another collapsed node. `expandAll`/`collapseAll` helpers. One history step per toggle.

### Grouping

- `groupSelection(flow, { type = 'group', padding = 20, data = {} })`: bounds of selected root
  nodes (`getNodesBounds`), add a group node at `bounds - padding` with that size (`width`,
  `height`), set `parentId` on the selected nodes and convert their positions to relative.
  Group node is inserted **before** its children in the array (engine requirement).
- `ungroup(flow, groupId)`: convert children to absolute positions, clear `parentId`, remove
  the group.
- `installDropIntoGroup(flow, { groupTypes = ['group'] })`: on `node-drag-stop`, for each
  dragged root node, the topmost intersecting group (`getIntersectingNodes`, partially false) →
  reparent and convert position; dragging a child fully out of its parent → unparent.

## `@xy-lit/ui`

Counterparts of React Flow UI components, all built on `@xy-lit/flow`.

```
packages/ui/src/
  base-node.ts            <xy-base-node>
  status.ts               statusIndicator()
  handles.ts              labeledHandle(), buttonHandle()
  database-schema-node.ts databaseSchemaNode (NodeTypeDefinition)
  shapes/registry.ts      ShapeRegistry, defaultShapes
  shapes/shape-node.ts    shapeNode (NodeTypeDefinition)
  placeholder-node.ts     placeholderNode
  labeled-group-node.ts   labeledGroupNode
  node-tooltip.ts         nodeTooltip() (uses nodeToolbar)
  node-appendix.ts        nodeAppendix()
  edges.ts                buttonEdge, dataEdge, animatedSvgEdge
  zoom-slider.ts          <xy-zoom-slider>, <xy-zoom-select>
  node-search.ts          <xy-node-search>
  devtools.ts             <xy-devtools>
  define.ts
```

- `<xy-base-node>`: shadow root with slots `header`, default, `footer`, parts `header`,
  `content`, `footer`; reflects `selected` (attribute set by the renderer). Handles must be
  **slotted children** (light DOM, so the engine can still find them); its own template must
  not contain `<xy-handle>`. Styles via `--xy-node-*` variables.
- `statusIndicator(status: 'loading' | 'success' | 'error' | 'initial', content)`: wrapper
  template with a status border (spinner border animation for loading, honours reduced motion).
- `labeledHandle({ type, position, id?, label, class? })`: `<xy-handle>` plus a positioned label
  span. `buttonHandle({ type, position, id?, showButton, onClick, content })`: handle with an
  attached button rendered beside it (class `nodrag nopan`).
- `databaseSchemaNode`: `data: { label: string; schema: { title: string; type: string; key?: 'PK' | 'FK' }[] }`.
  Renders a table; each row has `<xy-handle type="target" position="left" handle-id=${title}>`
  and a `source` on the right. Pairs with edges using `startLabel`/`endLabel` for cardinality.
- `ShapeRegistry`: `register(name, { path(w, h): string; handles(w, h): ShapeHandle[]; textBox(w, h): Rect })`,
  `get(name)`, `names()`; `defaultShapes` registers rectangle, rounded-rectangle, circle,
  ellipse, diamond, hexagon, parallelogram, triangle, cylinder, document, plus, arrow-rectangle.
  `shapeNode`: `data: { shape: string; label?: string; color?: string; registry?: ShapeRegistry }`,
  renders an SVG of the shape at the node's size, handles absolutely positioned at
  `handles(w, h)` points (style `left`/`top` with translate -50%), text in a `div` over
  `textBox`. `resizer: { variant: 'handles', minWidth: 40, minHeight: 40 }`.
- `placeholderNode` (dashed box with "+" that emits `placeholder-click`), `labeledGroupNode`
  (group with a label tag).
- `nodeTooltip(options, content)`: `nodeToolbar` shown while the node is hovered (tracks hover
  through `node-pointer-enter/leave` on the flow).
- `nodeAppendix(position, content)`: template positioned outside the node box on one side.
- Edges: `buttonEdge` (× button at the label point, deletes the edge), `dataEdge` (label from
  `data[key]` where `key = data.key`), `animatedSvgEdge` (bezier path plus a circle with
  `<animateMotion dur=${data.duration ?? '2s'} repeatCount="indefinite" path=${path}>`).
- `<xy-zoom-slider position>`: panel with − / range input (minZoom..maxZoom, step 0.01) / +,
  bound to the viewport. `<xy-zoom-select>`: `<select>` with 50/100/150/200 %, "fit view".
- `<xy-node-search>`: input + results (filter nodes by `data.label` or a `getLabel` property);
  choosing a result selects the node and `setCenter`s on it.
- `<xy-devtools>`: panel with three toggles: viewport logger, node inspector (renders
  `nodeToolbar`-style info boxes with id/type/position/size next to each node via a
  `viewport-front` slot child), change logger (last 50 `nodes-change`/`edges-change` events).

## Tests

- `packages/pro/test/*.browser.test.ts`: local history (drag = one step, delete = one step,
  redo cleared on new action, controlled mode still records); clipboard round trip with id
  remap and edge filtering; helper lines snapping and guide geometry; layout via the worker with
  dagre (positions differ from input, root-only); animation produces start/live/end phases and,
  with a Yjs source, one doc commit; collapse/expand; grouping conversions.
- `packages/ui/test/*.browser.test.ts`: each element/renderer renders; database schema node
  handles have the field names as ids and connect; shapes registry custom shape; node search
  centres the viewport.
- e2e `lit/pro.spec.ts`: copy/paste and undo through the keyboard in all browsers.
