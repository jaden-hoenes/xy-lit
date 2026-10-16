# 05 · Nodes

References: React `components/NodeWrapper/index.tsx`, `components/Nodes/utils.ts`
(`handleNodeClick`), `hooks/useDrag.ts`; Svelte `components/NodeWrapper/NodeWrapper.svelte`,
`container/NodeRenderer/NodeRenderer.svelte`, `actions/drag/index.ts`.

## Single-tree rule

The engine finds handles with `nodeElement.querySelectorAll('.source' | '.target')` and
`root.elementFromPoint()`, and finds the viewport with `domNode.querySelector('.xyflow__viewport')`.
So `<xy-node>`, everything a node renderer outputs, `<xy-handle>`, `FlowNodeElement`
subclasses and `<xy-node-resizer>` all render into the light DOM of their parent
(`createRenderRoot() { return this; }`), which places them in the flow's single shadow root.

## `NodeRenderContext`

Built by `<xy-flow>` (a `StoreController` with shallow equality), passed to every `<xy-node>`
as `.ctx`, identity changes only when a field changes:

```ts
type NodeRenderContext = {
  store: FlowStore; instance: FlowInstance; flowId: string;
  nodeTypes: NodeTypes;                         // built-ins merged with user types
  nodesDraggable: boolean; nodesConnectable: boolean; nodesFocusable: boolean;
  elementsSelectable: boolean; selectNodesOnDrag: boolean;
  nodeDragThreshold: number; nodeClickDistance: number;
  noDragClassName: string; noPanClassName: string;
  disableKeyboardA11y: boolean; autoPanOnNodeFocus: boolean;
  ariaLabelConfig: AriaLabelConfig;
  measure: MeasureController;
  motion: MotionState;                          // 10-styles-theming §Motion
  listeners: ReadonlySet<string>;               // event types that have listeners on the flow
};
```

## `<xy-node>` — `elements/xy-node.ts`

`XyNodeElement extends LitElement`, light render root.

Properties (all `{ attribute: false }`): `node: InternalNode`, `px: number`, `py: number`,
`z: number`, `ctx: NodeRenderContext`.

Context: provides `nodeIdContext` (value `node.id`) and `nodeConnectableContext` (value
`connectable`) with `ContextProvider`s created in the constructor and updated in `willUpdate`.

### Derived values (in `willUpdate`)

```ts
const n = this.node, c = this.ctx;
draggable   = n.draggable   ?? c.nodesDraggable;
selectable  = n.selectable  ?? c.elementsSelectable;
connectable = n.connectable ?? c.nodesConnectable;
focusable   = n.focusable   ?? c.nodesFocusable;
hasDimensions = nodeHasDimensions(n);
isParent    = c.store.getState().parentLookup.has(n.id);
type        = n.type ?? 'default';
```

### Host (applied in `willUpdate`, never through a template)

- `data-id = node.id`, `part = "node"`.
- `className = ['lit-flow__node', `lit-flow__node-${type}`, node.class, dragging && 'dragging',
  selected && 'selected', draggable && 'draggable', connectable && 'connectable',
  selectable && 'selectable', draggable && c.noPanClassName, isParent && 'parent',
  remoteSelected && 'remote-selected'].filter(Boolean).join(' ')`. Only write when the string
  changes.
- Style: when `node.style` changes, set `this.style.cssText = node.style ?? ''` and then
  re-apply all managed properties below. Managed properties are set with
  `this.style.setProperty`:
  - `transform: translate(${px}px, ${py}px)`
  - `z-index: ${z}`
  - `visibility: hasDimensions ? 'visible' : 'hidden'`
  - width/height (Svelte rule): `w = measured.width === undefined ? (width ?? initialWidth) : width`,
    same for `h`; set `width: ${w}px` when `w` is a number, else remove the property.
  - `pointer-events: all` when selectable/draggable/has listeners (React rule), else `none`
    (React uses `hasPointerEvents`).
- A11y: `tabindex = focusable ? 0 : null`; `role = node.ariaRole ?? (focusable ? 'group' : null)`;
  `aria-label = node.ariaLabel`; `aria-roledescription = "node"`;
  `aria-describedby = c.disableKeyboardA11y ? null : `${ARIA_NODE_DESC_KEY}-${flowId}``.
- `domAttributes`: set allowed keys (02-types), remove keys that disappeared.

### Content

`render()` resolves the node type: `entry = c.nodeTypes[type] ?? c.nodeTypes.default` (dev error
`003` once per unknown type).

- `NodeTypeDefinition` → `entry.render(props, c.instance)`.
- Constructor or tag name → an element created once per `<xy-node>` with
  `document.createElement(tagName)` (constructor → `customElements.getName(ctor)`; dev error if
  unregistered); rendered as a child value `${this.contentEl}`; `contentEl.props = props` and
  `contentEl.flow = c.instance` on every update. A type change replaces the element.

If the type definition (or the element class's `static resizer`) declares `resizer`, render
`<xy-node-resizer .options=${resizer}></xy-node-resizer>` before the content.

`props: NodeProps` is built per update:
`{ id, data, type, selected: !!selected, selectable, deletable: deletable ?? true, draggable,
isConnectable: connectable, dragging: !!dragging, zIndex: z, positionAbsoluteX: px,
positionAbsoluteY: py, width, height, sourcePosition, targetPosition, dragHandle, parentId }`.

**Position-only updates skip content.** In `shouldUpdate(changed)`: if every changed key is in
`{px, py, z}` and the type definition does not set `usesPosition: true`, apply the managed
style properties directly and return `false`.

### Lifecycle

- `connectedCallback`: `c.measure.observe(this)` once `ctx` is set (also in `willUpdate` when
  ctx first arrives).
- `firstUpdated`: create the drag instance (§Dragging).
- `updated(changed)`: if `type`, `sourcePosition` or `targetPosition` changed after first
  render → `c.measure.requestMeasure([id])` (Svelte effect). Update drag params.
- `disconnectedCallback`: `c.measure.unobserve(this)`, `drag.destroy()`, remove
  toolbar/label registrations owned by this node.

### Dragging — `packages/flow/src/drag.ts`

```ts
export function createDragStoreItems(store: FlowStore, host: XyFlowElement): () => XYDragStoreItems
```

Returns `() => ({ nodes, nodeLookup, edges, nodeExtent, snapGrid, snapToGrid, nodeOrigin,
multiSelectionActive, domNode, transform, autoPanOnNodeDrag, nodesDraggable, selectNodesOnDrag,
nodeDragThreshold, autoPanSpeed, unselectNodesAndEdges, updateNodePositions, panBy,
onError: reportError, onNodeDragStart/onNodeDrag/onNodeDragStop: (event, node, nodes) => emit('node-drag-…', { event, node, nodes }),
onSelectionDragStart/onSelectionDrag/onSelectionDragStop: (event, nodes) => emit('selection-drag-…', { event, nodes }) })`
reading current state each call.

`<xy-node>`:

```ts
this.drag = XYDrag({
  getStoreItems: createDragStoreItems(c.store, flowHost),
  onNodeMouseDown: (id) => handleNodeClick({ id, store: c.store, nodeEl: this }),
});
// in updated():
if (!draggable) { this.drag.destroy(); this.dragActive = false; }
else this.drag.update({ domNode: this, noDragClassName: c.noDragClassName, handleSelector: node.dragHandle,
  nodeId: node.id, isSelectable: selectable, nodeClickDistance: c.nodeClickDistance }), this.dragActive = true;
```

Only call `update` when one of those inputs changed (XYDrag re-binds d3 listeners on update).
`handleNodeClick` is a port of React `components/Nodes/utils.ts`.

### Pointer and keyboard (listeners on the host, added in the constructor)

- `click`: if `selectable && (!selectNodesOnDrag || !draggable || nodeDragThreshold > 0)` →
  `handleNodeClick(...)`; then emit `node-click` with `node.internals.userNode`.
- `dblclick` → `node-double-click`; `contextmenu` → `node-context-menu`;
  `pointerenter`/`pointermove`/`pointerleave` → `node-pointer-*`. Skip emitting when
  `!c.listeners.has(type)` (cheap guard for move events).
- `keydown` (only when focusable and `!disableKeyboardA11y`, and not `isInputDOMNode(e)`):
  `Enter`/`Space`/`Escape` (`elementSelectionKeys`) when selectable →
  `store.handleNodeSelection(id, e.key === 'Escape', this)`; arrows when draggable and
  selected → `preventDefault`, set `ariaLiveMessage` via
  `ariaLabelConfig['node.a11yDescription.ariaLiveMessage']({ direction, x, y })`,
  `store.moveSelectedNodes(arrowKeyDiffs[key], e.shiftKey ? 4 : 1)`.
- `focus`: if `autoPanOnNodeFocus && !disableKeyboardA11y && this.matches(':focus-visible')`
  and the node is outside the viewport (`getNodesInside` check), `store.setCenter(centre,
  { zoom: current })` (Svelte `onFocus`).

## Defining node types — `nodes/define-node-type.ts`

```ts
export function defineNodeType<N extends Node>(def: { render; styles?; resizer?; usesPosition?: boolean }): NodeTypeDefinition<N> {
  return Object.freeze({ kind: 'renderer', ...def });
}
```

Styles: `<xy-flow>` collects `styles` from every type in `nodeTypes`/`edgeTypes` (and
`static styles` of `FlowNodeElement` subclasses) whenever those properties change, converts
each `CSSResult` to a `CSSStyleSheet` (`result.styleSheet`), dedupes by identity, and sets the
render root's `adoptedStyleSheets = [...baseSheets, ...typeSheets, ...userSheets]`. In light
mode they are added to the document/enclosing root once and never removed.

## `FlowNodeElement` — `nodes/flow-node-element.ts`

```ts
export abstract class FlowNodeElement<N extends Node = Node> extends LitElement {
  static override properties = { props: { attribute: false }, flow: { attribute: false } };
  declare props: NodeProps<N>;
  declare flow: FlowInstance;
  static resizer?: NodeResizerDefaults;
  protected override createRenderRoot() { return this; }
  get nodeId(): string { return this.props.id; }
  get data(): N['data'] { return this.props.data; }
}
```

Controllers that need the node id (`NodeConnectionsController`, etc.) read it from
`nodeIdContext`, which `<xy-node>` provides, so they also work in template renderers' child
elements. `static styles` on a `FlowNodeElement` subclass are adopted into the flow root (they
must be written for light DOM: `sum-node .total { … }`, not `:host`).

## Built-in node types — `nodes/builtin.ts`

Ports of Svelte `components/nodes/*.svelte`:

```ts
export const defaultNode = defineNodeType<BuiltInNode>({ render: ({ data, sourcePosition = Position.Bottom, targetPosition = Position.Top }) => html`
  <xy-handle type="target" position=${targetPosition}></xy-handle>${data?.label ?? ''}<xy-handle type="source" position=${sourcePosition}></xy-handle>` });
export const inputNode  = defineNodeType({ render: ({ data, sourcePosition = Position.Bottom }) => html`${data?.label ?? ''}<xy-handle type="source" position=${sourcePosition}></xy-handle>` });
export const outputNode = defineNodeType({ render: ({ data, targetPosition = Position.Top }) => html`<xy-handle type="target" position=${targetPosition}></xy-handle>${data?.label ?? ''}` });
export const groupNode  = defineNodeType({ render: () => nothing });
export const builtinNodeTypes = { default: defaultNode, input: inputNode, output: outputNode, group: groupNode };
```

Labels render as text (`${…}` in a text position), never as HTML.

## Node toolbar — `nodes/node-toolbar.ts`

Upstream portals the toolbar out of the (scaled) node into the renderer root. Moving
Lit-rendered DOM breaks Lit's cleanup, so XY Lit uses a directive that registers a template with
the flow, and the flow renders all toolbars in its toolbar layer.

```ts
export const nodeToolbar: (options: NodeToolbarOptions, content: unknown) => DirectiveResult;
export type NodeToolbarOptions = {
  nodeId?: string | string[];      // default: the enclosing node (nodeIdContext of the part's host)
  isVisible?: boolean;             // default: node selected and it is the only selected node
  position?: Position;             // default top
  align?: 'start' | 'center' | 'end';  // default center
  offset?: number;                 // default 10
  class?: string; style?: string;
};
```

Implementation: `class NodeToolbarDirective extends AsyncDirective`. `render()` returns
`nothing`. `update(part, [options, content])` finds the owning `<xy-node>` by walking from
`part.parentNode` (`ChildPart.parentNode`) with `closest('xy-node')` (works in renderer output
and inside `FlowNodeElement`s, which are light-DOM descendants) and the flow host through the
node's `ctx`; registers/updates `{ key: directiveId, nodeIds, options, content }` in
`flow.toolbars` (a `Map`) and requests a toolbar-layer update. `disconnected()` unregisters;
`reconnected()` registers again.

Toolbar layer in `<xy-flow>` (outside the viewport, so it is not scaled):

```ts
repeat(activeToolbars, (t) => t.key, (t) => html`
  <div class="lit-flow__node-toolbar ${t.options.class ?? ''}" data-id=${t.nodeIds.join(' ')}
       style="position:absolute;transform:${t.transform};z-index:${t.zIndex};${t.options.style ?? ''}">
    ${t.content}
  </div>`)
```

Per toolbar: nodes = ids mapped through `nodeLookup`; skipped when none exist; `isActive` =
`options.isVisible ?? (nodes.length === 1 && nodes[0].selected && selectedCount === 1)`;
`transform = getNodeToolbarTransform(getNodesBounds(nodes, { nodeLookup, nodeOrigin }), viewport, position, offset, align)`;
`zIndex = Math.max(...nodes.map(n => (n.internals.z || 5) + 1))`. Inactive toolbars are not
rendered (e2e checks `not.toBeAttached()`). The layer subscribes to `transform` only while at
least one toolbar is registered.

## Tests

`xy-node.browser.test.ts`: classes and style string merge (user style keeps managed transform);
hidden until measured; position-only update does not call the renderer; type change re-measures;
`domAttributes` filtering; keyboard select/move/escape and aria-live message; element node type by
constructor and by tag; `nodeToolbar` registers/unregisters with the node, positions for all
12 position/align combinations match the upstream e2e expectations.
