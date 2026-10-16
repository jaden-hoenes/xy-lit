# Accessibility

## What you get

- **Keyboard**: nodes and edges are focusable (`tabindex`), so Tab reaches them in DOM order. On a node, Enter or
  Space selects it, Escape deselects it, the arrow keys move a selected node (Shift for 4x steps) and Backspace
  deletes the selection. Edges select with Enter or Space. The controls and the mini map are real buttons and an
  `<svg role="img">`.
- **Announcements**: moving a node with the keyboard writes a message to an `aria-live` region inside the flow
  ("Moved selected node right. New position, x: 40, y: 20"). The demo mirrors it in the box on the right.
- **Descriptions**: every flow renders hidden descriptions (`aria-describedby` on nodes and edges): "Press enter or
  space to select a node. Press delete to remove it and escape to cancel."
- **Roles and labels**: the wrapper is `role="application"`; the controls panel is a `role="group"` with a label;
  handles carry an `aria-label`.
- **Contrast**: built-in colours, including the attribution link, meet WCAG AA in light and dark mode. The repository
  runs axe-core on the flow, controls, mini map and panel in both modes (`tests/e2e/lit/a11y.spec.ts`) with no rule
  disabled.
- **Reduced motion**: with `prefers-reduced-motion: reduce`, entrance animations are skipped, the loading spinner
  slows down and `@xy-lit/pro`'s position animations run with duration 0.

<Demo name="accessibility" :height="340" caption="Tab into the flow, Tab to a node, press Enter, then use the arrow keys. The log on the right shows what a screen reader announces." />

## Customising the text

`ariaLabelConfig` (a property) overrides any of the strings; the rest keep their defaults (`Partial<AriaLabelConfig>`).
This is also how you translate.

```ts
flow.ariaLabelConfig = {
  'node.a11yDescription.default': 'Drücken Sie Enter, um den Knoten auszuwählen.',
  'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) => `Knoten nach ${direction} bewegt: ${x}, ${y}`,
  'controls.zoomIn.ariaLabel': 'Vergrößern',
};
```

| Key | Used for |
|---|---|
| `node.a11yDescription.default` | description of a node |
| `node.a11yDescription.keyboardDisabled` | description when arrow-key movement applies |
| `node.a11yDescription.ariaLiveMessage` | function `({ direction, x, y }) => string` |
| `edge.a11yDescription.default` | description of an edge |
| `controls.ariaLabel`, `controls.zoomIn.ariaLabel`, `controls.zoomOut.ariaLabel`, `controls.fitView.ariaLabel`, `controls.interactive.ariaLabel` | the controls panel and its buttons |
| `minimap.ariaLabel` | the mini map |
| `handle.ariaLabel` | handles |

## On your nodes

The flow cannot know what your node *means*; you can tell it:

- `node.ariaLabel` sets the accessible name, `node.ariaRole` the role (the default is `group` for focusable nodes),
  `edge.ariaLabel` the same for edges, `domAttributes` adds `aria-*` and `data-*` attributes.
- Interactive content inside a node (inputs, buttons) needs its own accessible names and the `nodrag` class so
  keyboard and pointer users can operate it without moving the node. Key presses inside inputs are ignored by the
  flow's shortcuts.
- Do not rely on colour alone. Selection also changes the box shadow, and invalid connection targets are marked
  through handle state classes you can give a shape or icon.
- `nodes-focusable="false"` and `edges-focusable="false"` take elements out of the tab order, `disable-keyboard-a11y`
  turns off the keyboard layer; use them only if you provide another path to the same actions.

## A non-pointer path to every action

| Action | Without a pointer |
|---|---|
| Select | Tab to it, Enter |
| Move | select, arrow keys |
| Delete | select, Backspace |
| Connect | not possible with the keyboard alone (see below); offer a menu or form (for example a context pad that creates connected elements, and F2 to edit a label) |
| Pan and zoom | `<xy-controls>` buttons (zoom in, out, fit) |
| Undo | Mod+Z with `@xy-lit/pro` |

**Keyboard-only connecting is not supported, by design.** Handles have `tabindex="-1"`, so Tab never reaches them and
there is no keyboard connect mode. XY Lit keeps React Flow's behaviour here on purpose. Click-to-connect
(`connect-on-click`) works with a pointer, a switch or a screen reader that clicks, but it needs a click on the handle.
A flow whose main task is wiring should give keyboard users another way in: a form or menu that calls
`flow.addEdges(...)`, or a node action. A context pad that creates a connected element from the selected node works from the keyboard.
