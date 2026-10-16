# 16 · Storybook and documentation site

## Storybook — `apps/storybook` (`@xy-lit/storybook`, private)

Storybook 10.6 with `@storybook/web-components-vite`, addons `@storybook/addon-docs` and
`@storybook/addon-a11y`. Port `STORYBOOK_PORT` (default 6006). `.storybook/main.ts` resolves
workspace packages from source (same aliases as `apps/examples`). `preview.ts` loads Inter,
sets a global `colorMode` toolbar (light/dark) that sets `color-mode` on every `<xy-flow>` in
the story and the page background.

Stories are CSF3 files in `apps/storybook/stories/`, written with Lit `html`. Each story renders
inside a 100% × 520px container. Use `args`/`argTypes` for attributes (controls), and
`@storybook/addon-docs` autodocs fed by `custom-elements.json` (`setCustomElementsManifest`
from `@storybook/web-components`) so attribute tables come from the manifest.

Required stories (title → stories):

| Title | Stories |
|---|---|
| `Flow/Basics` | Default, FitView, Controlled (logs changes in the actions panel), Uncontrolled, ReadOnly, DarkMode, LightRenderRoot |
| `Flow/Interaction` | SelectionOnDrag, PanOnScroll, SnapToGrid, KeyboardOnly (instructions), ClickConnect, Validation (only matching handle colours) |
| `Flow/Sub-flows` | ParentExtent, ExpandParent, NestedGroups |
| `Flow/Edges` | AllTypes, Markers (built-in + custom), Labels (center/start/end), ParallelSpread, Animated, Reconnect, EdgeToolbar, ButtonEdge |
| `Flow/Nodes` | BuiltIns, TemplateRenderer, ElementNode (SumNode with controllers), DragHandle, Resizer (handles/lines/hover-corner), NodeToolbar, WheelScrollInside |
| `Flow/Lifecycle` | RenderComplete (shows timings), LoadingOverlay (slow-measuring node), Motion |
| `Plugins` | Background (dots/lines/cross, multiple layers), Controls (horizontal, custom buttons), MiniMap (pannable/zoomable, custom node colour), Panel positions, ViewportPortal |
| `Collaboration` | SideBySide: two flows bound to two in-memory `Y.Doc`s synced through a relay with configurable latency (slider), showing cursors, live drags, undo per user; RepairDemo (concurrent delete + connect, healing) |
| `Pro` | UndoRedo, Clipboard, HelperLines, AutoLayout (dagre/elk/tree/force switch), AnimatedPositions, ExpandCollapse, Grouping |
| `UI/*` | one story per `@xy-lit/ui` component |

Scripts: `dev` (`storybook dev -p $STORYBOOK_PORT --no-open`), `build` (`storybook build -o
dist`), `test` (Playwright smoke: open the built static Storybook, visit every story id from
`index.json`, assert no console errors and that a `render-complete` happened for stories with a
flow).

## Documentation — `apps/docs` (`@xy-lit/docs`, private)

VitePress 1.6.4 (it brings its own Vite 5; keep it isolated in this app). Port `DOCS_PORT`
(default 5176). `.vitepress/config.ts`: `vue.template.compilerOptions.isCustomElement = (tag) => tag.startsWith('xy-')`;
`vite.resolve.alias` to workspace sources; theme `enhanceApp` imports `@xy-lit/flow/define.js`
(and pro/ui/collab defines) on the client only (`if (!import.meta.env.SSR)`).

Live demos: a `<Demo>` Vue component that renders a container and, on mount, calls a demo
module's `mount(el)` (demo modules live in `apps/docs/demos/*.ts`, written with Lit). Every
guide page has at least one live demo.

Pages:

```
index.md                         hero, feature grid, live hero demo, links to Storybook and the examples
guide/getting-started.md         install, plain HTML, sizing rule, first flow
guide/concepts.md                nodes, edges, handles, viewport, the change pipeline
guide/controlled-vs-uncontrolled.md
guide/custom-nodes.md            defineNodeType, FlowNodeElement, styles, single-tree rule
guide/custom-edges.md            defineEdgeType, baseEdge, labels, markers, parallel edges
guide/handles-and-connections.md validation, connection modes, click-connect, reconnect
guide/sub-flows.md
guide/interaction.md             selection, keyboard, pan/zoom options, wheel inside nodes
guide/theming.md                 CSS variables, parts, adoptStyles, light render root, dark mode
guide/accessibility.md
guide/performance.md
guide/lifecycle.md               init, nodes-initialized, render-complete, loading overlay, motion
guide/collaboration.md           YjsFlowSource, providers, presence, undo, repair, server
guide/pro-features.md            history, clipboard, helper lines, layout, grouping, collapse
guide/ui-components.md
guide/frameworks.md              React 19, Vue, Angular, Svelte usage snippets
guide/migrating-from-react-flow.md   prop → attribute/property/event table
guide/testing.md                 whenRendered(), Playwright tips
examples/index.md                gallery linking to apps/examples pages (embedded via iframe)
api/*.md                         generated
```

API reference: `scripts/gen-api.mjs` reads every `custom-elements.json` and the TypeScript
declarations (`dist/*.d.ts` of store/flow) and writes `api/elements/<tag>.md` (attributes,
properties, events, slots, parts, CSS properties, methods) and `api/functions.md`,
`api/types.md` (from JSDoc via the TS compiler API). Run in `predev`/`prebuild`.

Scripts: `dev`, `build` (`vitepress build`), `preview`, `test` (build + Playwright smoke over
every page: no console errors, demos reach `render-complete`, no broken internal links).
