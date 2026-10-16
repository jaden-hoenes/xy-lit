# Sub-flows

A node becomes a **child** by naming its parent: `parentId`. Its `position` is then relative to the parent, and it
moves with it. The parent can be any node, usually a `group` node or a custom container.

<Demo name="sub-flows" :height="340" caption="Drag the children against the group's border: one is confined, one grows the group, one may leave it. Add more children with the button." />

```ts
flow.nodes = [
  { id: 'g', type: 'group', position: { x: 200, y: 0 }, width: 260, height: 190, data: {} },
  { id: 'a', parentId: 'g', extent: 'parent', position: { x: 20, y: 30 }, data: { label: 'confined' } },
  { id: 'b', parentId: 'g', expandParent: true, position: { x: 20, y: 110 }, data: { label: 'grows the group' } },
];
```

## Rules

- **Parents come before their children** in the `nodes` array. `addNodes` and the pro
  [grouping](/guide/pro-features#grouping) helpers keep that order for you.
- **`extent: 'parent'`** confines a child to its parent's box; a custom `extent` takes `[[x0, y0], [x1, y1]]` in the
  parent's coordinates. Without it a child may be dragged out (it keeps its `parentId`).
- **`expandParent: true`** grows the parent when the child is dragged beyond its edge. Together with `extent: 'parent'`
  the child is not confined but grows the box.
- **Give containers a size.** A `group` node has no content to measure; set `width` and `height` (or `style`). Group
  nodes have no handles; an edge to a group needs a node type with handles (the example uses the `default` type).
- **Selection and z-order.** `elevate-nodes-on-select` raises a selected node above others. `z-index-mode` (`basic`,
  `auto`, `manual`) controls how parents and children stack; `basic` puts children above their parent.
- **Hidden and collapsed.** `hidden: true` on a parent hides its children; `@xy-lit/pro` adds
  [expand and collapse](/guide/pro-features#expand-and-collapse) built on it.

## Dropping into groups

`@xy-lit/pro`'s `installDropIntoGroup(flow)` reparents nodes when a drag ends inside a group (and unparents them when
it ends outside), converting positions and keeping one undo step.

## Fitting the view

`fit-view` and `flow.fitView()` include `type: 'group'` nodes. A group node with an explicit `width` and `height` is
part of the initial fit like any other node: the fit waits until the nodes were measured, so no extra `fitView()`
call is needed after `await flow.whenRendered()`.
