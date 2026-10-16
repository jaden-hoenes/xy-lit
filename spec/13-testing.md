# 13 · Testing

## Layers

| Layer | Runner | Where |
|---|---|---|
| Store unit | Vitest (Node) | `packages/store/test` |
| Element unit | Vitest browser mode (Chromium, Firefox, WebKit) | `packages/{flow,pro,ui,collab-yjs}/test/*.browser.test.ts` |
| Conformance e2e | Playwright, vendored xyflow specs, `FRAMEWORK=lit` | `tests/e2e/conformance` |
| XY Lit e2e | Playwright | `tests/e2e/lit` |
| Collab unit + fuzz | Vitest (Node) + fast-check | `packages/collab-yjs/{test,fuzz}` |
| Multi-client e2e | Playwright + `apps/collab-server` | `tests/e2e/collab` |
| Perf | Playwright (Chromium) | `tests/perf` |
| A11y | `@axe-core/playwright` + keyboard scripts | `tests/e2e/lit/a11y.spec.ts` |

## Conformance suite

`scripts/vendor-xyflow.sh` copies xyflow's `tests/playwright/e2e/*.ts` into
`tests/e2e/conformance/`. They select everything as `.${FRAMEWORK}-flow__…`, navigate to
`/tests/generic/:topic/:example`, `/examples/backgrounds` and `/examples/color-mode`, and
Playwright CSS locators pierce open shadow roots.

### Allowed patches

Only these edits to the vendored specs are allowed. Mark each with `// XY Lit:` and keep a
list in `tests/e2e/conformance/PATCHES.md`.

1. `constants.ts`: `export const FRAMEWORK = process.env.FRAMEWORK ?? 'lit';`
2. `nodes.spec.ts` "selecting multiple nodes with shift drag": the Svelte branch hard-codes
   `.svelte-flow__selection`. XY Lit uses React's selection DOM, so change both ternaries to
   `FRAMEWORK === 'svelte' ? '.svelte-flow__selection' : `.${FRAMEWORK}-flow__nodesselection``
   (and `__selection` for the user rectangle).
3. `nodes.spec.ts` "panning from a multi-selection rectangle with the middle mouse button":
   change `test.skip(FRAMEWORK !== 'react', …)` to `test.skip(FRAMEWORK === 'svelte', …)` and the
   three hard-coded `.react-flow__` locators to `.${FRAMEWORK}-flow__`.

Anything else that fails is a bug in XY Lit, not in the spec.

### Fixture pages (`apps/examples`)

`src/generic-tests/` holds the vendored fixture configs. Port them in place:

- Replace `import … from '@xyflow/svelte'` with `@xy-lit/flow` (same names: `MarkerType`,
  `Position`, `type Node`).
- Replace Svelte component imports with Lit node types in `src/generic-tests/components/`:
  - `DragHandleNode` → `defineNodeType({ styles, render: () => html`<div class="container"><div class="drag-handle custom-drag-handle"></div></div>` })`
    with the Svelte file's CSS (`.container` 100×50 red flex, `.drag-handle` 25×25 green).
  - `ToolbarNode` → renderer using `nodeToolbar({ isVisible: data.toolbarVisible, position: data.toolbarPosition, align: data.toolbarAlign }, html`<button>delete</button><button>copy</button><button>expand</button>`)`,
    then `<div class="node"><div>${data.label}</div><xy-handle type="target" position="left"></xy-handle><xy-handle type="source" position="right"></xy-handle></div>`,
    CSS `.node { width: 200px; height: 50px; border: solid 1px black; }`.
- Declare `FlowConfig` in `src/generic-tests/types.d.ts`:
  `{ flowProps?: Record<string, unknown>; panelProps?: …; minimapProps?: …; controlsProps?: …; backgroundProps?: … }`.

`src/fixture.ts` → `mountFixture(root, config)`:

1. Create `<xy-flow style="width:100vw;height:100vh">` (the page has `body { margin: 0 }`).
2. Map `flowProps` onto element properties. Names are the same as Svelte's except:
   `initialViewport → defaultViewport`, `multiSelectionKey`/`deleteKey`/`selectionKey`/
   `panActivationKey`/`zoomActivationKey` (same names, values pass through), `class → className`
   on the host is not used by fixtures. Unknown keys: dev warning, ignored.
3. Append `<xy-panel>`, `<xy-minimap>`, `<xy-controls>`, `<xy-background>` children when the
   corresponding `*Props` exist, mapping props to properties.
4. Wrap in `<xy-flow-provider>` (Svelte fixture parity).

Example pages:

- `/examples/backgrounds`: port React's `examples/react/src/examples/Backgrounds` (four flows
  with ids `flow-a`…`flow-d`, each one node, backgrounds with `bg-id` `0`/`1` and the same
  variants/gaps/offsets; layout grid 2×2, each 50vw × 50vh).
- `/examples/color-mode`: port Svelte's `color-mode` page (4 nodes, `fit-view`, controls,
  dots background, minimap, panel with `<select data-testid="colormode-select">` options
  light/dark/system bound to `colorMode`).

## XY Lit e2e (`tests/e2e/lit/`)

Each file is a Playwright spec against example pages added for it:

| Spec | Covers |
|---|---|
| `uncontrolled.spec.ts` | connect adds an edge; delete key removes; drag persists |
| `controlled.spec.ts` | page that prevents `nodes-change` and re-assigns: same behaviour; and a page that ignores changes: nothing moves |
| `connection-outside.spec.ts` | 06 §Pointer capture |
| `reconnect.spec.ts` | anchors appear only when enabled; reconnect replaces the edge |
| `two-flows.spec.ts` | two flows on one page: independent selection, delete key acts on the active flow only, marker ids don't clash |
| `render-complete.spec.ts` | event fires once per revision; overlay hidden afterwards; deterministic screenshot after `whenRendered()` |
| `subflows.spec.ts` | port of Svelte `examples/subflows`: child drag clamped to parent (`extent: 'parent'`), parent drag moves children, `expandParent` |
| `vertical-edges.spec.ts` | top/bottom handles: edge path starts going down from the source and ends going down into the target (sample path points) |
| `xss.spec.ts` | `<img src=x onerror=window.__pwned=1>` in node `data.label`, edge `label`, `startLabel`, `endLabel`: rendered as text, `window.__pwned` undefined |
| `measurement.spec.ts` | resizing a node via content change (no resizer) never sets `node.width` (inspect `flow.getNodes()`) |
| `wheel.spec.ts` | scrollable node content scrolls; viewport unchanged until the end |
| `light-root.spec.ts` | `render-root="light"`: drag, connect, Tailwind-like global class styles a node |
| `keyboard.spec.ts` | Tab to node, Enter selects, arrows move (Shift ×4), Escape deselects, Delete deletes, aria-live text |
| `a11y.spec.ts` | axe on `/tests/generic/nodes/general` and `/examples/color-mode`: no `serious`/`critical` violations; document any rule disabled and why |
| `motion.spec.ts` | `motion="enter"`: entering class then removed; reduced motion emulation disables it |
| `pro.spec.ts` | 12 |

## Collaboration tests

See `11-collab-yjs.md` §Tests. The e2e config starts `apps/collab-server` with
`DB=':memory:'` and each test uses a unique room id.

## Performance (`tests/perf`)

Stress page `/stress/:count` (grid of `count` default nodes, `count - 1` edges, `fit-view`).
Measure in Chromium headless with a rAF frame-time recorder injected in the page:

| Scenario | Count | Budget (p95 frame time) |
|---|---|---|
| Programmatic pan (`setViewport` animation, 2 s) | 1 000 / 5 000 / 10 000 | 16.7 ms / 16.7 ms / 33 ms |
| Drag one node across the pane (60 mouse moves) | 1 000 / 5 000 / 10 000 | 16.7 ms / 25 ms / 33 ms |
| Initial `render-complete` time | 1 000 / 5 000 / 10 000 | 1.5 s / 5 s / 10 s |

Budgets fail the perf job; they are recorded to `tests/perf/results.json` for trend tracking.
Run with `--workers=1`.

## Rules for writing tests

- Await `flow.whenRendered()` (unit) or the `render-complete` event (e2e:
  `page.evaluate(() => new Promise(r => document.querySelector('xy-flow').addEventListener('render-complete', r, { once: true })))`
  registered before navigation completes, or `whenRendered()`), never fixed sleeps.
- Browser tests clean up (`flow.remove()`) in `afterEach`.
- Every bug fixed gets a regression test in the closest layer.
