# Interaction

Every behaviour below is an attribute (kebab-case) and a property on `<xy-flow>`.

<Demo name="interaction" :height="380" caption="Toggle the options and try them: selection by dragging, wheel panning and zooming, snapping." />

## Selecting

| What | How |
|---|---|
| Select a node or edge | click it (`elements-selectable`, default `true`; per element `selectable`) |
| Add to the selection | hold `multi-selection-key` (Meta on macOS, Control elsewhere) |
| Selection rectangle | hold `selection-key` (default `Shift`) and drag; or set `selection-on-drag` to draw one by dragging the pane (then pan with the middle button, right button, Space or the `pan-on-drag` buttons) |
| Rectangle semantics | `selection-mode="full"` (the node must be inside) or `partial` (touching is enough) |
| Clear | click the pane, or press Escape on a focused element |
| Select on drag start | `select-nodes-on-drag` (default `true`) |

The selected nodes get a dashed box you can drag as a group. `selection-change`, `selection-start`, `selection-end`,
`selection-drag*`, `selection-click` and `selection-context-menu` report it. `elevate-nodes-on-select` and
`elevate-edges-on-select` raise selected elements above the rest.

## Dragging

Nodes drag when `nodes-draggable` is true (default; per node `draggable`). `node-drag-threshold` (default 1 px) delays
the start; `snap-to-grid` with `snap-grid="15 15"` snaps positions; `auto-pan-on-node-drag` pans the viewport when
the pointer nears the edge, at `auto-pan-speed`. A node's `dragHandle` (a CSS selector) restricts dragging to part of the node. Events:
`node-drag-start`, `node-drag`, `node-drag-stop` (with `node` and all dragged `nodes`).

## Pan and zoom

| Attribute | Default | |
|---|---|---|
| `pan-on-drag` | `true` | `true`, `false`, or the allowed mouse buttons, e.g. `"1,2"` |
| `pan-on-scroll` | `false` | wheel pans instead of zooming; `pan-on-scroll-mode` is `free`, `horizontal` or `vertical`, `pan-on-scroll-speed` 0.5 |
| `zoom-on-scroll` / `zoom-on-pinch` / `zoom-on-double-click` | `true` | |
| `min-zoom` / `max-zoom` | 0.5 / 2 | |
| `translate-extent` | infinite | pan bounds, `[[x0, y0], [x1, y1]]` |
| `node-extent` | infinite | bounds nodes can be dragged within |
| `prevent-scrolling` | `true` | stop the page from scrolling while the pointer is over the flow |
| `pan-activation-key` | `Space` | hold to pan with the left button even while `selection-on-drag` |
| `zoom-activation-key` | Meta / Control | hold to zoom with the wheel even when `zoom-on-scroll` is off |

The docs demos set `prevent-scrolling="false"` and `zoom-on-scroll="false"` so you can scroll the page past them;
Ctrl or Cmd with the wheel zooms. `move-start`, `move` and `move-end` report the gesture; `viewport-change` reports
every change.

## Keyboard

Nodes and edges are focusable (`nodes-focusable`, `edges-focusable`; turn the keyboard layer off with
`disable-keyboard-a11y`). On a focused node: **Enter** or **Space** selects it, **Escape** deselects it, and **arrow keys** move it while it is
selected (Shift moves 4x as far, with a live-region announcement). **Backspace** (`delete-key`) deletes the selection.
Mod+Z, Mod+Shift+Z and Mod+Y undo and redo when a history is installed (`history-keys="off"` disables them). Every
key attribute takes a key name (`"Delete"`), a combination (`"Meta+s"`) or `"null"`. Keyboard handling acts on the
**active** flow (the last one you pressed or focused), so several flows on one page do not fight.

## Keeping gestures out of nodes

Inside a node, add these classes to stop the flow from reacting:

| Class | Effect |
|---|---|
| `nodrag` | pressing does not drag the node |
| `nopan` | pressing does not pan the pane |
| `nowheel` | the wheel does not zoom or pan |
| `nokey` | pressing does not start a selection rectangle (used by in-node editors) |

Wheel events over a **scrollable element inside a node** scroll it natively until it hits its end
(`wheel-scroll-detection="auto"`); `off` always leaves the wheel to the canvas.

## Connecting

Dragging from handles, click-to-connect and reconnecting are covered in
[handles and connections](/guide/handles-and-connections).

## Touch

Pinch zooms (`zoom-on-pinch`), one finger pans the pane (`pan-on-drag`), a long press does not start a selection
rectangle. Reconnect anchors and handles work with touch.
