# 00 · Locked decisions

Everything in this file is decided. Change it only by adding a line to §Changelog with the
reason.

## Names

| Thing | Value | Notes |
|---|---|---|
| Working title | XY Lit | `lit-flow` is taken on npm; the repo folder name doesn't matter |
| npm scope | `@xy-lit` | Packages: `store`, `flow`, `collab-yjs`, `pro`, `ui` |
| Element prefix | `xy-` | `<xy-flow>`, `<xy-handle>`, … |
| Engine `lib` value | `'lit'` | Produces classes `lit-flow__*`. Required by the conformance e2e suite (`FRAMEWORK=lit`) |
| Dev-warning prefix | `XY Lit` | `createDevWarn('XY Lit', DOCS_URL)` |
| Docs URL constant | `https://jaden-hoenes.github.io/xy-lit` | GitHub Pages site, defined once in `packages/store/src/constants.ts` |

**Rename recipe.** `LIB`, `LIB_NAME` and `DOCS_URL` live in `packages/store/src/constants.ts`.
Tag names are hard-coded in templates and registered in `packages/flow/src/define.ts`;
renaming the prefix is a search-and-replace of `xy-` in `packages/*/src` (CSS custom
properties are `--xy-*` and must **not** be renamed). The npm scope appears only in
`package.json` files and import specifiers; renaming it is a search-and-replace of `@xy-lit/`.

## Pinned versions (checked 2026-10-14)

Runtime:

| Package | Version | Range used |
|---|---|---|
| `@xyflow/system` | 0.0.83 | **exact** `0.0.83` (0.0.x, internal API) |
| `lit` | 3.3.3 | `^3.3.3` |
| `@lit/context` | 1.1.6 | `^1.1.6` |
| `rbush` | 4.0.1 | `^4.0.1` (spatial index: free placement, helper lines) |
| `yjs` | 13.6.33 | `^13.6.33` (peer of collab-yjs) |
| `y-protocols` | 1.0.7 | `^1.0.7` |
| `lib0` | 0.2.119 | `^0.2.119` |
| `fractional-indexing` | 4.0.0 | `^4.0.0` |
| `perfect-cursors` | 1.0.5 | `^1.0.5` |
| `@dagrejs/dagre` | 3.1.1 | `^3.1.1` (pro, optional peer) |
| `elkjs` | 0.12.0 | `^0.12.0` (pro, optional peer) |
| `d3-force` / `d3-hierarchy` | 3.0.0 / 3.1.2 | `^3` (pro) |
| `@hocuspocus/provider` / `server` / `extension-sqlite` / `extension-logger` | 4.7.1 | `^4.7.1` (examples + server app only) |
| `y-indexeddb` | 9.0.12 | `^9.0.12` (examples only) |

Tooling:

| Tool | Version | Notes |
|---|---|---|
| Node | ≥ 22 (dev machine has 26.10) | `engines.node: ">=22"` |
| pnpm | 11.25.0 | `"packageManager": "pnpm@11.25.0"` |
| TypeScript | `~5.9.3` | **Not 7.x.** The custom-elements-manifest analyzer and typescript-eslint use the JS compiler API |
| Vite | `^8.3.4` | Library mode per package; examples app |
| Vitest | `^5.0.4` + `@vitest/browser-playwright` `^5.0.4` | Store tests in Node; element tests in browser mode |
| Playwright | `1.64.1` (`@playwright/test`) | e2e, Chromium + Firefox + WebKit |
| ESLint | `^10` + `typescript-eslint ^8.71` + `eslint-plugin-lit ^2.3` + `eslint-plugin-wc ^3.1` | flat config |
| Prettier | `^3.9` | |
| PostCSS | `postcss ^8.5`, `postcss-nested ^8.0`, `postcss-rename ^0.8.1` | style generation script only |
| `@custom-elements-manifest/analyzer` | `^0.11.0` | `custom-elements.json` per element package |
| `@changesets/cli` | `^3.0.3` | |
| `@changesets/changelog-github` | `^1.0.1` | changelog entries with PR and author links (`.changeset/config.json`) |
| `fast-check` | `^4.10.2` | collab fuzzing |
| `@axe-core/playwright` | `^4.13.0` | a11y e2e |
| `tsx` | `^4.23` | scripts, collab server |
| `storybook`, `@storybook/web-components-vite`, `@storybook/web-components`, `@storybook/addon-docs`, `@storybook/addon-a11y` | `^10.6.2` | `apps/storybook` |
| `vitepress` | `1.6.4` | `apps/docs` (brings its own Vite 5) |
| `@fontsource-variable/inter` | `^5.3.0` | docs, Storybook |

## Architecture decisions

1. **Bind, don't rewrite.** Use `@xyflow/system`'s `XYPanZoom`, `XYDrag`, `XYHandle`,
   `XYResizer`, `XYMinimap` and store utilities unmodified, through `engine.ts`.
2. **One shadow root per flow** (default `render-root="shadow"`), opt-in `render-root="light"`.
3. **Store**: hand-written `FlowStore` (no Lit dependency), ported from React's zustand store,
   exposed to elements through `@lit/context` and `StoreController(selector, equals)`.
   Notifications coalesce per microtask; state reads are always synchronous.
4. **Change pipeline**: every interaction produces upstream `NodeChange`/`EdgeChange` arrays plus
   a `ChangeMeta`. They pass through middlewares, then a cancelable `nodes-change` /
   `edges-change` event, then the active `FlowDataSource`.
5. **Default mode is uncontrolled** (`ArraySource`). Calling `preventDefault()` on
   `nodes-change`/`edges-change` makes the app the owner (controlled). Assigning `.source`
   hands state to an external source (Yjs).
6. **Node and edge renderers are functions returning Lit templates** (`defineNodeType`,
   `defineEdgeType`). Stateful nodes may instead be custom elements extending
   `FlowNodeElement` (light render root).
7. **Node/edge `class` and `style` are strings**, as in Svelte Flow (`class?: string`,
   `style?: string`). This is a DOM binding; strings map straight to attributes and let
   the Svelte generic-test fixtures port unchanged.
8. **Selection DOM follows React**: user rectangle `.lit-flow__selection`; selected-nodes box
   `.lit-flow__nodesselection > .lit-flow__nodesselection-rect`.

## Behavioural decisions (deviations from React Flow are marked ⚑)

| Topic | Decision |
|---|---|
| `connect` | ⚑ Cancelable. Default action adds the edge (Svelte behaviour). React adds nothing unless `onConnect` does |
| Reconnect anchors | ⚑ `edges-reconnectable` defaults to **false** (React: true but inert without `onReconnect`). `edge.reconnectable` overrides per edge. `reconnect` is cancelable; default action replaces the edge |
| Delete key | Acts only on the **active flow**: the one containing focus, else the one that received the most recent pointerdown |
| Modifier/activation keys | Tracked once per page by `KeyboardTracker`; every flow reads the shared state |
| Wheel inside scrollable node content | ⚑ On by default (`wheel-scroll-detection="auto"`); `off` restores upstream |
| Entrance motion | Off by default (`motion` attribute opt-in) |
| Loading overlay | On by default until the first `render-complete`; `no-loading-overlay` disables |
| `fitView` | Upstream queue-until-initialised plus timeout fallback (`fitViewOptions.timeout`, default 400 ms) |
| Live drags in collaboration | Awareness during the gesture, one document write on drop (`livePositions: 'awareness'`) |
| Connection drag outside the host | ⚑ Handle calls `setPointerCapture` so mouse events keep reaching the shadow root (see `06-handles-connections.md` §Pointer capture) |
| Attribution | Rendered by default as "XY Lit · xyflow" linking to `https://xyflow.com`; `hide-attribution` hides it |
| Error codes | Upstream `errorMessages` codes reused; reported through a cancelable `flow-error` event, default action `console.warn` in dev |

## Scope of 0.1

Workspace, store, core elements with full conformance,
plugins, additions beyond React Flow, Yjs collaboration with server and fuzzing, Pro-equivalent
features (undo/redo, copy/paste, helper lines, auto layout, position animation,
expand/collapse, grouping), UI components (base node, labeled/button handles, database schema
node, shapes, button edge, zoom slider, node search, devtools), docs/examples/manifest/perf,
Storybook and the VitePress documentation site (16).

## Out of scope (later)

SSR, whiteboard tools (freehand/lasso/eraser), editable edges and orthogonal routing, image
export, `@xy-lit/react` wrapper package, upstream PRs (nested-shadow-root handles, wheel
predicate). They are not planned for 0.1.

## Changelog

- 2026-10-16 (release): **Publishing.** Packages `store`, `flow`, `collab-yjs`, `pro` and `ui` are published under `@xy-lit` with npm
  provenance from `.github/workflows/release.yml` (changesets). They start at version `0.0.0` so the initial `minor` changesets produce
  `0.1.0`. Added `@changesets/changelog-github ^1.0.1` as a root devDependency (changelog entries link the pull request and author). The
  docs are served from GitHub Pages (`DOCS_URL` is `https://jaden-hoenes.github.io/xy-lit`); the dev-warning help link points at the
  "Errors and warnings" section of the lifecycle guide.
- 2026-10-15 (collaboration): **API shape**: `orderAndRepair`'s `order` callback is
  `(id, kind: 'node' | 'edge') => string` (node and edge ids may collide). A node whose broken parent is repaired also loses
  `extent: 'parent'` (the engine would report 005), in the materialised view and in the healing write. `repair.ts` also exports
  `applyRepairs(maps, issues)` and `healDoc` returns the issues it fixed; `RepairIssue` rules are exactly spec 11. `YjsFlowSource`
  gained `readOnly` (getter/setter; also set by `XYL21`), `userOf(clientId)`; `history` is typed `YjsHistory` (`FlowHistory` plus
  `stopCapturing`, `clear`, `undoManager`). `runMigrations` returns a status; `no-path` (no chain to the current schema) makes the
  source read-only with `XYL21` like `too-new`; a missing `meta.schema` on a non-empty doc counts as 0 only if a migration starts at 0.
  **Mapping**: `replace` is diffed against the node the user last saw (the materialised object), not against the document, so an
  unrelated edit never persists a remote live position or a local live size; `add` of an id that exists is a `replace`; several adds
  in one batch keep their relative order (working id list). The local selection publishes to presence from the overlay, not from a
  store subscription (same result, no scan of all nodes); connection/viewport come from a store subscription as specced
  (`connection.to` is container-relative, converted to flow coordinates with the transform). Soft locks: the first gesture wins per
  `(gestureId, node)`; `start`/`discrete` changes on a locked node are dropped, later `live`/`end` of an accepted gesture pass.
  `remote.addedBy` is set when a remote transaction adds at most 10 nodes and exactly one client's clock advanced and that client is
  in awareness. Healing: the healer reports `XYL20` only for issues that removed an element; non-healers re-check every 2 s.
  `YjsFlowSource` writes `meta.schema`/`createdAt` itself (origin `MIGRATION`); `populate` uses `MIGRATION` too (not undoable).
  **Presence**: `PresenceChannel` binds one shared `pagehide`/`visibilitychange` listener per page while a channel exists
  (`eslint.config.js` lists `packages/collab-yjs/src/awareness.ts` in `LISTENER_EXEMPT`); setters with `null` apply at once and
  cancel pending throttled writes; `destroy()` also nulls the `user` field. New files: `remote-state.ts` (per-node presence view),
  `controllers/presence-controller.ts`. `<xy-presence-avatars>` is an absolute overlay with `position`, `max`, `include-self`
  and a `follow(clientId)` method (spec: avatars live in `<xy-panel>`, which does not exist yet); it skips avatar URLs that are not
  http(s)/data:image/blob:. `<xy-remote-cursors>` positions with `style.transform` from `PerfectCursor` callbacks and rescales on zoom
  change. **Server**: `apps/collab-server` hook lives in `src/repair-hook.ts` (`createRepairHook`, `HEAL_DEBOUNCE_MS`, default 2000);
  `server.ts` also clears timers on `afterUnloadDocument`/`onDestroy`. **Tests**: the fuzz op set has an extra `sync` (direct
  exchange between reachable replicas); the placeholder `smoke.*` tests were removed. `context.setOffline` does not close established
  WebSockets in Chromium or Firefox, so the demo disconnects the provider on the window `offline` event (and reconnects on `online`),
  and the e2e spec relies on that; deterministic concurrency specs use the page's "Go offline" switch. No dependency changes;
  `eslint.config.js` is the only shared file touched.
- 2026-10-15 (core elements): **Pane**: the derived values of React's `FlowRenderer`
  (`panOnDrag = panActivationKeyPressed || panOnDrag`, `selectionOnDrag && panOnDrag !== true`, `isSelecting`) live in
  `PaneController.interaction` and `PanZoomController` uses them too (it now passes `panOnDrag: false` while the selection key
  is held, as React does; an earlier version missed that). The pane's capture-phase `click` is added by the controller (a template
  cannot bind `click` twice); a stale `userSelectionRect` is cleared on `pointerup` when selection is no longer enabled; the
  auto-pan loop has a run flag so a pending `panBy` cannot restart it; `setPointerCapture` is wrapped in try/catch (synthetic
  pointers throw). Selection gestures share one `gestureId`. **Keys**: `FlowKeysController` also binds Mod+Z / Mod+Shift+Z /
  Mod+Y to `store.history` (trivial once the hook existed); a lone flow with no active flow handles the delete
  key (spec: only the active flow; with exactly one attached flow there is nothing else to choose); delete is skipped while a
  Ctrl/Meta/Shift modifier is held (Svelte rule, React gets it from the pressed-key count). **Render complete**: ready also
  requires no queued `fitView` (so the viewport is final when the event fires) and, with `only-render-visible-elements`, only
  the visible nodes must be measured; `RenderCompleteController.attach(store)` / `reset()` are new; assigning `source` resets
  `firstRenderComplete`. **Reconnect**: `reconnect-start`/`reconnect-end` carry the type of the handle that stays (React passes
  `oppositeHandle.type`; Svelte passes the dragged end); anchors start on `mousedown`/`touchstart` with pointer capture from
  `pointerdown` (so touch works, unlike React's mouse-only anchors); the click that follows a reconnect drag is swallowed;
  the edge gets `updating` while hovering an anchor (React) and while reconnecting. **Provider**: `FlowContextValue` gained an
  optional `provider` (`FlowProvider.attachFlow/detachFlow`); `<xy-flow>` no longer uses a `ContextConsumer` for the provider
  (it only answers the first connection, so a moved flow lost its provider) but dispatches its own `context-request` event on
  every connect (`FlowContextRequestEvent`, not exported by `@lit/context`); nodes/edges assigned to a flow under a provider
  go into the shared store when non-empty, `fit-view` queues a fit on it; a second flow under one provider keeps its own store and
  warns `XYL03`. **Store bug**: `getLayoutedEdges` ignored `edge.hidden` (it only skipped hidden endpoints); fixed with a unit test.
  **Node toolbar**: `nodeToolbar` directive, `activeToolbars` and the toolbar layer were implemented now (needed by the
  `node-toolbar` conformance spec, which passes); `<xy-flow>` follows the viewport transform only while a toolbar is *shown*
  (spec 05 said "registered": every node type that calls `nodeToolbar` registers even when hidden). **Fixtures/e2e**: generic-test
  Lit components live in `src/generic-tests/components/` (the router excludes that folder); the Svelte originals stay as `.svelte.txt`;
  e2e pages are `src/examples/e2e-*.ts` with helpers in `src/lib/e2e.ts`; `tests/e2e/lit/globals.d.ts` types the page globals.
  **Playwright**: `conformance/pane.spec.ts` "autoPanOnNodeDrag" runs in a second Firefox project `firefox-wide` (2100x2100 window)
  and is excluded from the normal `firefox` project: Playwright-Firefox drops mouse events outside the window, so the test is a
  frame-timing race (about 90% failures with unmodified XY Lit; none with 1 ms of work per mouse move, which is why React Flow
  passes). The spec file is unchanged. See `tests/e2e/conformance/PATCHES.md`. `lit/subflows.spec.ts` uses a 1600x900 viewport for the same reason.
- 2026-10-15 (core elements): `renderRoot` (spec 04) is `renderRootMode` on the element
  (Lit's own `renderRoot` field collides); the attribute is still `render-root`. `fitView` is both the boolean property of
  04 (stored as `fitViewOnInit`, attribute `fit-view`) and the instance method: the accessor setter takes a boolean, the
  getter returns the method. `<xy-edge>` is `display: contents` through `extra.css` (`xy-edge { display: contents }`), not an
  inline style from the constructor (a custom element constructor may not add attributes when created with
  `createElement`). `<xy-node>` gets an extra `isParent` property from the nodes layer (the node object does not change
  when it gains children) and re-observes itself when the engine has no measurement (a replaced node object loses
  `measured`/`handleBounds`; same as Svelte's observer effect). The position-only skip compares the user node field by
  field (the engine creates a new internal node on every drag frame, so a plain "only px/py/z changed" test never held).
  `MeasureController` flushes resize-observer batches synchronously (they already run once per frame after layout); only
  `requestMeasure` uses rAF. The edge label layer re-renders through a microtask (`labelsVersion` state), not rAF, so labels
  never lag their edge by a frame. `connect` is emitted before the duplicate check (React calls `onConnect` for
  duplicates); the default action skips duplicates through `addEdge`. `viewport-change` is emitted for every transform
  change when someone listens, not only when controlled. `styles.test.ts` is `styles.browser.test.ts` (there is no Node
  test project for `@xy-lit/flow`). `ConnectionLineProps` gained `pointer` (React parity, container-relative pixels).
  Lit-reactive properties set before the element upgrades reach the store on the first update; the element's own
  accessors `nodes`/`edges`/`source`/`fitView` are upgraded in `connectedCallback`, so `render-root` and `id` should be
  attributes (or set after definition). `.vitest` added to `.gitignore`.
- 2026-10-14 (store): `Edge` is **not assignable to upstream `EdgeBase`** (a `CustomEdgeMarker` has `type: 'custom'`),
  so upstream generics constrained to `EdgeBase` reject it. `@xy-lit/store` therefore defines its own
  `EdgeChange<E>`/`EdgeAddChange`/`EdgeReplaceChange`, `EdgeLookup<E>` and `DefaultEdgeOptions` (same shapes as
  upstream; `EdgeSelectionChange`/`EdgeRemoveChange` are upstream's) and wraps `addEdge`, `reconnectEdge`,
  `getIncomers`, `getOutgoers`, `getConnectedEdges` for `Edge`. The store casts to `EdgeBase` internally. Spec 02
  said "upstream change types unchanged"; node changes are, edge changes are structurally identical.
- 2026-10-14 (store): upstream `adoptUserNodes` reports `nodesInitialized: false` for an empty node list and counts a node
  as initialised only when `measured` is set (a user `width`/`height` is not enough). The store keeps that; it
  never emits `nodes-initialized` for an empty list, and treats "no nodes" as ready for `fitView` (resolves at once).
- 2026-10-14 (store): `fitView` (03 §fitView) refinements: `resolveFitView` returns unless a fit is queued, so controllers
  may call it whenever panZoom/size appear (no `nodesInitialized` pre-check needed); it detaches `fitViewQueued/Options/
  Resolver` before awaiting the viewport animation (a `fitView()` call during the animation queues a fresh fit with
  its own promise, instead of being resolved by the old one); with nothing measured it stays queued, and after the
  timeout (or with `force`) it resolves `false`; a timeout that fires before the pan/zoom engine or container size
  exist is remembered, so the next `resolveFitView()` fits forced. The constructor's `fitView: true` also arms the timer.
- 2026-10-14 (store): `triggerNodeChanges/triggerEdgeChanges(changes, meta, { apply })`: `apply` receives the
  post-middleware `(changes, meta)` (spec said `() => void`; a superset). If a middleware returns a different array the
  api `snapshotNodes/snapshotEdges` is dropped from the meta so the source applies the (rewritten) changes, not the
  stale full array. `updateNodeData`'s source fast path falls back to `source.applyNodeChanges` in that case.
- 2026-10-14 (store): `addNodes`, `addEdges`, `deleteElements`, and the `updateNodeData`/`updateEdgeData` fast paths flush the
  pending `setNodes`/`setEdges` queue first so call order is preserved (React queued everything).
  `addNodes` placement keeps one spatial index per parent: ancestors of a child are no obstacles, the child's
  `position` is made parent-relative. `deleteElements` follows React's event order exactly: `edges-delete`,
  edge changes, `nodes-delete`, node changes, `delete` (03 listed the events first, then the triggers).
- 2026-10-14 (store): placement `step` default is `snapToGrid ? snapGrid[0] : 20` (03 said `snapGrid[0] ?? 20`, but
  `snapGrid` always has a value). `'viewport-center'` is computed from the transform and `width/height`
  (identical to `screenToFlowPosition` of the pane centre, but needs no DOM).
- 2026-10-14 (store): `store.reset()` restores only runtime state (domNode, panZoom, size, transform, selection boxes, key
  flags, connection, pending fitView which settles `false`, gesture); options and elements are kept (React's `reset`
  re-created the whole state and is only used on unmount).
- 2026-10-14 (store): selection actions (`addSelectedNodes/Edges`, `unselectNodesAndEdges`, `resetSelectedElements`) put one
  shared `gestureId` on their node and edge triggers. `handleNodeSelection` sets `nodesSelectionActive: false`
  like React's `handleNodeClick`; `handleEdgeSelection` like React's `onEdgeClick` + Svelte's `selectable` check.
- 2026-10-14 (store): keyboard: besides `parseKeyCode`/`PressedKeys`/`keyboardTracker` the store exports `KeyCodeWatcher`, a
  per-key-code port of `useKeyPress` (own pressed set, sticky state, input-field guard, preventDefault rule) that
  `FlowKeysController` should drive from `keyboardTracker.subscribe`. `PressedKeys` remembers both `key` and `code`
  of each held key (React stored one of them depending on the watched keys). The tracker does not forward plain
  keys typed in inputs. `isDev()` reads `process.env.NODE_ENV` in a try/catch, not `import.meta.env.DEV` (Vite
  statically replaces that in library builds).
- 2026-10-14 (store): `FlowOptions` (undefined in 02) is the option subset of `FlowState` plus constructor-only `nodes`, `edges`,
  `fitView`, `width`, `height`. `setOptions` ignores `undefined` except for `defaultEdgeOptions`, `isValidConnection`,
  `onBefore*`, `fitViewOptions` (where it clears), skips unchanged values, and assigns `nodes`/`edges` to an
  `ArraySource` (else through `instance.setNodes/setEdges`). `FlowInstance.setViewport` accepts `Partial<Viewport>` and
  `screenToFlowPosition` also `snapGrid` (React). `STORE_SYMBOL = Symbol.for('xy-lit.store')` is set on the instance as
  a non-enumerable property; `getStoreOf(instance)` is exported from the index and `/internal`.
- 2026-10-14 (store): edge layout reports engine errors (e.g. `008`) once per edges array, not on every pass. A `setNodes` whose
  result differs only in order produces no changes and is therefore not applied (React's uncontrolled mode applied it).
  `MarkerDef = MarkerProps | CustomEdgeMarker & { id }`; `getMarkerDefs()` lists upstream markers (sorted) first, then custom.
- 2026-10-14 (workspace): added `@eslint/js ^10.0.1` as a root devDependency (ESLint 10 flat config needs it
  for `js.configs.recommended`; not listed in 01 §Dependencies). `pnpm-workspace.yaml` gained
  `allowBuilds` (pnpm 11 build-script approval) and `minimumReleaseAgeExclude` for Playwright 1.64.1.
- 2026-10-14 (workspace): Vite 8 library mode uses `build.rolldownOptions` (not `rollupOptions`) with
  `output.preserveModules` + `preserveModulesRoot: 'src'`; works as specced. Shared config lives in
  `config/vite-lib.ts`; vitest `projects` entries use `extends: true`; config files import
  `config/*.ts` with explicit `.ts` extensions (Vite 8's native config loader requires them).
- 2026-10-14 (workspace): Vitest Node projects exclude `*.browser.test.ts`. See 01 §Vitest.
- 2026-10-14 (workspace): added `XY_BROWSERS` (comma list, default all three) honoured by Vitest browser
  mode and the Playwright configs. Reason: this dev host (Arch-based, unsupported by Playwright)
  cannot run WebKit (missing ICU 74, libxml2.so.2, flite, libjxl 0.8, libbacktrace; Ubuntu
  sonames) and `sudo` is off limits. Chromium and Firefox work. Real CI must run all three.
- 2026-10-14 (workspace): `tests/e2e` `test` script is `node run.mjs` (strips the `--` pnpm forwards) and the
  config selects spec dirs with `testMatch`, so `pnpm e2e -- conformance/nodes.spec.ts` narrows
  as the conformance gate expects. `apps/examples` pages with params use file-name routes (01 §Apps).
- 2026-10-14: added Storybook and the documentation site (16).
- 2026-10-14: initial lock. Vitest browser mode replaces
  web-test-runner (one runner for Node and browser tests).

### Plugins and controllers

- **Plugins**: all plugin elements extend `FlowPluginElement` (own shadow root, flow sheets adopted, `:host { display: contents }`
  re-declared after the shared `extra.css` host rules, warning `XYL06` outside a flow; `<xy-viewport-portal>` warns `XYL07`).
  `<xy-panel>` defaults to `top-right` (spec 08; React's is `top-left`). The controls panel has `role="group"` (axe flags a bare
  `aria-label` on a div); `<xy-control-button>` styles slotted `svg` with `::slotted(svg)`. `<xy-minimap>` does not inline a stroke
  or stroke width unless asked (the CSS defaults apply; React did the same), reads `width`/`height` as attributes, falls back to the
  node's inline `background` for the fill (node `style` is a string in XY Lit) and memoises the node list by `lookupVersion`.
  `<xy-resize-control>` gained `controlClass`/`controlStyle` (used by the resizer for handle/line styling) and moves its initial
  children inside the rendered control. `<xy-node-resizer>` is visible while its node is selected unless `is-visible` is given
  (React defaulted to always visible); `hover-corner` is always rendered.
- **Edge toolbar** keeps its size through the `--xy-zoom` custom property that `PanZoomController` writes on the viewport element
  (only when the zoom changes) instead of re-rendering with `getEdgeToolbarTransform(zoom)`; spec 07 required a re-render of
  the label layer on zoom, which would have re-run every toolbar edge renderer per wheel step. `EdgeRenderResult` labels accept
  `nothing`. The node toolbar z-index is `(z || 5) + 1` as in React.
- **Controllers**: `StoreController` gained `refresh()` and the options `onChange` and `onAttach`, and tolerates a provider
  answering `undefined`. `NodeConnectionsController` without an id warns `014` (React throws; a throw inside `hostConnected`
  breaks the element lifecycle). `InternalNodeController` selects `[node, x, y, z]` (shallow) so in-place engine mutations update
  the host.
- **Motion**: computed by `MotionController` on the flow element (`hostUpdate`, before render), not in the store's
  `setNodesFromSource` as spec 10 described; same rules (initial population, `enter remote` + `source.lastUpdateRemote`,
  reduced motion read from `matchMedia` at that moment, `motion-max-nodes`). With `motion="off"` it does no per-render work.
  The backstop timer is `duration + stagger * index + 100 ms` (edges `+ 120 ms` for the draw delay), read from the CSS variables.
- **Light root**: no `<slot>` exists in light mode, so `LightSlotProjector` (a child-list `MutationObserver` on the host) moves the
  flow's children into the wrapper / viewport layers / loading overlay. The flow's `slot="loading"` child hides the spinner via
  `[data-slotted]`.
- **Parallel edges**: `simplebezier` ignores `props.offset`; `step` also accepts `pathOptions.stepPosition` (explicit wins).
- **Wheel**: the listener is attached through a `ref` on `.lit-flow__nodes` and follows `wheel-scroll-detection` at runtime.
- **Styles**: attribution link colour `#5f5f5f` (dark: `#b4b4b4`, `--xy-attribution-color`) for WCAG AA; `.lit-flow__edge-toolbar`
  is `width: max-content`. `/examples/color-mode` got an `aria-label` on its select (a11y spec).
- **No dependency changes.** Vendored conformance specs are unpatched beyond the three patches of the core-elements entry (`PATCHES.md` unchanged).

### Pro (`@xy-lit/pro`)

- 2026-10-15 (pro): **API shape.** All `@xy-lit/pro` functions take a `FlowLike` (the `<xy-flow>` element
  or its `FlowInstance`); `install*` functions (and `LocalHistory`) also work on a not-yet-connected `<xy-flow>` (attach is deferred
  to its first update). `installClipboard` / `installHelperLines` return a disposer that carries extra members (`copy/cut/paste/
  duplicate`, resp. a live `guides` getter), which is still a `() => void`. Extras beyond spec 12: `LocalHistory.batch()`,
  `withoutRecording()`, `active`, `undoSize`, `redoSize`, option `ignoreOrigins`; `pasteElements`, `serializeSelection`,
  `parseClipboard`; `layoutBackend()`, `disposeLayoutWorker()`; `getCollapsibleDescendants`, `isCollapsed`; `defineHelperLines()`.
- 2026-10-15 (pro): **LocalHistory.** Redo steps are computed from the live state when you undo (inverse of the inverse), not recorded
  at change time, so recording does not depend on the order of other change middlewares (helper lines). When a source has its own
  history, `LocalHistory` is inert (records nothing, empty stacks) instead of recording uselessly; replacing the source clears
  its stacks. Selection-only `replace` changes (and other local-field-only ones) are not steps. `add` inverse is `remove`;
  `remove` inverse is `add` with the original index (ascending, so several indices restore the order).
- 2026-10-15 (pro): **Clipboard.** Mod+V does not use `navigator.clipboard.readText()` (it shows a paste prompt in Firefox and needs a
  permission in Chromium): it arms a one-shot capture `paste` listener on `document` and falls back to the last copy of the page
  after 60 ms. Copy uses `writeText` as specced; a refusal is reported once per install as `XYL30`. A copied child without its
  parent becomes a root at its absolute position. Pasted nodes and edges are selected; paste runs inside `source.transact`.
- 2026-10-15 (pro): **Helper lines** also snap the `end` phase (XYDrag's final update carries the raw pointer position, so the node
  would otherwise jump off the guide on drop) and are skipped when a batch has more than one position change (multi-drag, parent
  expansion). The rbush is queried with an infinite band along the other axis, so aligned nodes far away are found.
- 2026-10-15 (pro): **Layout.** `layout()` takes a fourth `{ worker, origin, nodeOrigin }` argument, returns `node.position` values for
  root nodes (children's edges are lifted to their root ancestor), and results are normalised to the top-left (0, 0) plus `origin`;
  `applyLayout` keeps the top-left where it is unless `keepPosition: false`. If the worker fails to start, layouts fall back to the
  main thread. The package build needs `src/layout/worker.ts` as an entry and a small plugin that keeps the literal
  `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })` (Vite's lib build would inline it as a data URL).
  elkjs inside a worker needs a stubbed `self.document` while it loads (its bundle otherwise takes over `onmessage`).
  Shared files touched for this: `vitest.config.ts` (browser project `optimizeDeps.entries`, so Vite does not reload the page
  when the lazy peer imports are discovered) and `apps/examples/vite.config.ts` (`worker.format: 'es'`).
- 2026-10-15 (pro): **Animation** returns `Promise<boolean>` (false when replaced) and sends explicit phases and one `gestureId`; it
  honours `prefers-reduced-motion` (duration 0) unless `respectReducedMotion: false`. **Collapse**: `toggleCollapsed(flow, id, force?)`
  returns the new state; a node under two roots stays visible when one root collapses (spec rule), so `collapseAll` can leave such
  nodes visible. **Grouping**: only selected root nodes are grouped; reparenting into a group that comes later in the array
  moves the subtree with `remove` + `add`; the drop's reparent joins the drag's history step.

### UI (`@xy-lit/ui`)

- **Styles**: spec 12 does not say how the light-DOM helpers get their CSS. `@xy-lit/ui` exports `uiStyles` (one `css` sheet), carried by every
  node and edge type of the package; custom node types built from the helpers add it to their `styles`. Colours derive from the flow's
  `--xy-node-*` tokens (plus optional `--xy-ui-*` overrides, exported as `tokens`), so no dark-mode selectors are needed.
- **Additions beyond 12**: `uiNodeTypes` / `uiEdgeTypes` maps; `createDefaultShapes()`, `ShapeRegistry.has/entries/clone`; `ShapeHandle.type` (a point
  renders only a source or a target; default both, stacked); `data.pathType` on the three edges; `<xy-zoom-slider>` shows the zoom percentage (click resets);
  `<xy-node-search>` also matches node ids, has `maxResults`, `zoom` and the `node-search-select` event; `<xy-devtools>` has `entries`, `clearLog()`, the
  `<xy-devtools-inspector>` element, and switches initialised from attributes; `nodeTooltip` also shows on keyboard focus (`showOnFocus`).
- **nodeTooltip** tracks hover with `pointerenter`/`pointerleave` listeners on the owning `<xy-node>` instead of `node-pointer-enter/leave` on the flow:
  the flow only emits those when something listens, so a tooltip would otherwise force listeners on every flow.
- **dataEdge** reads `edge.data[edge.data.key]`, falling back to the source node's `data[key]` (React Flow UI behaviour).
- **Zoom panels** default to `bottom-center` (slider) and `top-center` (select), node search to `top-left`, devtools to `bottom-right`.
- **Shape nodes** always render both a `source` and a `target` handle per connection point, so shapes connect in strict mode in both directions.
- **Not a ui bug, observed**: deleting an edge with a label triggers Lit's change-in-update warning on `<xy-flow>`. Left as is (flow-core); the ui e2e ignores that one warning.
- No dependency changes.

### Examples, performance and packaging

- **Examples**: every new page is a Lit element on `apps/examples/src/lib/demo.ts` (not the imperative `createFlow` helper of the e2e
  pages). `/examples/dark-mode` is a richer page next to the conformance fixture `/examples/color-mode` (which must keep its markup);
  `/examples/dagre` is the reactflow.dev layout example next to the multi-algorithm `pro-layout`; `/examples/hello` (an empty
  placeholder) became a minimal real flow. The index is driven by `src/catalog.ts` (titles, descriptions, categories); routes it does not
  list appear under "Other" and fail `lit/examples.spec.ts`. The pro demos published `window.history` (read-only, threw on mount) and now
  publish `window.proHistory`. Lit re-sets `.nodes=${nodes}` on every render, so pages bind `.nodes=${initial(nodes)}` (guard).
- **Perf**: `tests/perf` has a *fit* variant (spec/13 table, whole graph on screen) and a *windowed* variant (`only-render-visible-elements`,
  zoom 1) plus a zoom scenario that spec/13 does not list. On the dev host (headless Chromium, software compositing) the spec budgets for
  5k and 10k visible nodes are not reachable (Blink "Layerize" costs about 3 us per node per frame), so `tests/perf/budgets.ts` enforces
  calibrated regression limits there (5k: 66.7 ms, 10k: 133.4 ms pan/zoom and 150 ms drag) and records `meetsSpec` in `results.json`; the
  windowed variant and 1k hold the spec numbers. Frame checks allow 0.5 ms of jitter. `/stress/:count` accepts `?visible=1` and `?minimap=1`,
  sets `min-zoom=0.02` (the default 0.5 would cut a 10k grid off) and exposes `window.__stress`.
- **Perf fix** (`PanZoomController`): the inherited custom property `--xy-zoom` moved from the viewport element to the edge label layer (the
  only consumer, edge toolbars). Writing it on the viewport restyled every node and edge on each zoom frame. Amends the plugins entry "Edge
  toolbar ... `--xy-zoom` ... on the viewport element".
- **Known core issue, not fixed**: initial `fit-view` ignores a `type: 'group'` node with explicit `width`/`height`.
- **Packaging**: new root script `check:packages` (`scripts/check-packages.mjs`). Package `files` exclude `*.d.ts.map` and include
  `THIRD_PARTY_NOTICES.md` (copied by `prepack`, `scripts/copy-notices.mjs`); `prepack` of `flow`, `ui` and `collab-yjs` also runs
  `pnpm manifest` so `exports["./custom-elements.json"]` resolves in a clean pack. Initial changesets are one `minor` per package. No
  dependency changes; `.gitignore` gained `tests/perf/results.json` and `packages/*/THIRD_PARTY_NOTICES.md`. Shared files touched:
  root `package.json` (script), `.gitignore`, every `packages/*/package.json`.

### Documentation site

- **Manifests are generated, not committed.** `packages/*/custom-elements.json` is git-ignored; `pnpm manifest` and `prepack` produce it. The Storybook build runs `pnpm manifest` as a pre-step. `apps/docs/scripts/check-manifest.mjs` (also
  `pnpm --filter @xy-lit/docs check:manifest`) verifies every `static properties` entry and its attribute, every `<slot name>`,
  `part=`, `new CustomEvent` name, every `FlowEventMap` event on `<xy-flow>` and every `--xy-*` override variable of the vendored
  stylesheets against the manifests (300 declarations).
- **A cem plugin keeps the manifest to public API** (`config/cem.mjs`, passed by the `manifest` script of `flow`, `ui`, `collab-yjs` with
  `--config ../../config/cem.mjs`): members, attributes and events without a description are dropped (so `@internal` members, Lit
  `state: true` properties, controller fields and the bogus `flowContext` event of the analyzer disappear), as are private members.
  `packagejson: false` stops the analyzer from rewriting `package.json` (it did so when run into another `--outdir`).
- **`<xy-flow>` JSDoc**: all 50 `FlowEventMap` events as `@fires` (generated from `types/events.ts`), and 43 `@cssprop` entries with
  light and dark defaults. Every element has `@tag`. `@xy-lit/pro`'s `<xy-helper-lines>` is documented with parts and the colour
  variable; pro has no manifest script (nothing ships), the API generator analyzes it into a temp directory.
- **JSDoc**: `node scripts/check-jsdoc.mjs --members` (every export of every package entry point and the public members of exported
  classes and interfaces) is clean.
- **LICENSE**: MIT, "Copyright (c) 2026 Jaden Hoenes" at the root. `scripts/copy-notices.mjs` now copies it next to
  `THIRD_PARTY_NOTICES.md` in every package at `prepack` (git-ignored `packages/*/LICENSE`); `scripts/check-packages.mjs` fails when a
  tarball lacks `LICENSE`, `README.md` or the notice. Each package has a `README.md`; the root `README.md` is a real project README
  (the spec index moved to its end).
- **Docs site** (`apps/docs`): every page of spec/16, 18 guides, each with at least one live demo (`demos/*.ts` Lit modules or `.vue`
  components mounted by `<Demo>`; `data-render-complete="true"` once every `<xy-flow>` in a demo reported `render-complete`), a home page
  with a live hero demo, light and dark theme. `examples/index.md` is a gallery driven by `apps/examples/src/catalog.ts` (previews are
  iframes created on click), Deviations from spec/16: the API generator
  (`apps/docs/scripts/gen-api.mjs`, in `predev` and `prebuild`) reads the TypeScript **sources** through the compiler API instead of
  `dist/*.d.ts` (no build needed, member docs and tags included) and a fresh analyzer run instead of the committed manifests; its output
  `apps/docs/api/` is git-ignored. `vitepress preview` and `dev` take `--port ${DOCS_PORT:-5176}` because preview ignores
  `vite.server.port`. Config additions that are not obvious: `y-protocols` is aliased to `packages/collab-yjs/node_modules` (a peer
  dependency the docs app does not declare; the collaboration demo needs `Awareness`), and a small plugin points the pro layout worker at
  `worker.ts` from source. `apps/docs/tsconfig.json` repeats the `paths` map plus `y-protocols/*` and excludes the Vue theme files (`vue`
  is not a dependency of the app). Sidebar entries render as HTML, so element names are escaped.
- **Performance page**: states the measured table of `m8-examples.md` as is. 5k and 10k fully visible nodes do **not** meet the spec
  budgets on the reference host (software compositing); the calibrated limits are regression guards; windowed (culled) runs meet the spec
  at every size.
- **Not done / known**: React 19, Angular and Svelte snippets are not exercised by tests (Vue is, as a live demo); WebKit was not run
  (host); fit-view with group nodes was a documented known issue on the sub-flows page, since fixed (see Integration fixes).
- Shared files touched: `.gitignore`, `scripts/copy-notices.mjs`, `scripts/check-packages.mjs`, `config/cem.mjs` (new), the `manifest`
  script of `packages/{flow,ui,collab-yjs}/package.json`, comments in `packages/*/src`. No dependency changes.

### Storybook

- **72 stories in 28 files** (`apps/storybook/stories`): every title of the spec/16 table, plus an Introduction page. `UI/*` has one title per
  `@xy-lit/ui` component (17). Autodocs are on for every title
  (`tags: ['autodocs']` in `preview.ts`), source snippets use `docs.source.type: 'code'` (the dynamic HTML of a flow is unreadable).
- **Manifests**: `scripts/manifest.ts` (`predev`, `prebuild`) runs each package's own `manifest` script (flow, ui, collab-yjs), copies the
  result to `apps/storybook/.manifests/<pkg>/` (git-ignored) and removes the package copy again when it did not exist before.
  `preview.ts` loads them with `import.meta.glob`, derives a missing `tagName` from the class name, and does nothing when none exists.
- **Colour mode**: the `colorMode` global sets `data-mode` on a `.sb-frame` wrapper that every story is rendered in (100% wide, 520px high;
  `parameters.frame.height` overrides). A `MutationObserver` on that frame sets `color-mode` on every `<xy-flow>` in it, including flows
  that stories add later; `data-fixed-mode` on a flow opts out (Basics/DarkMode). The decorator also sets the page background.
- **`.source=${x}` / `.nodes=${x}` bindings go through `once()`** (a `guard([])`): Lit re-sets object-valued property bindings on every
  render, and for a Yjs source that meant `detach()` (cursor and drag presence cleared) on each render.
- **Vite plugin in `.storybook/main.ts`** marks the `define.js` entries of the workspace aliases as having side effects: the packages
  declare only `dist/define.js` in `sideEffects`, so Rollup dropped the aliased sources and no element was registered in the static build.
- **Smoke test** (`tests/smoke.spec.ts`, `pnpm --filter @xy-lit/storybook test`): the built Storybook is served by `scripts/serve.ts`
  (port `STORYBOOK_PORT`); every story id and every docs page of `index.json` must load with no `console.error`/page error and every
  `<xy-flow>` must resolve `whenRendered()` (the promise of `render-complete`). `A11Y=1` prints axe-core violations per story (informal).
- **Dependencies**: none added. `@playwright/test` comes from the root; axe-core is resolved through `@storybook/addon-a11y`.
- Other files: `scripts/screenshots.ts` (visual review helper) and `scripts/dev.ts` forwards SIGINT/SIGTERM to Storybook.

### Integration fixes

Fixes found while running the whole suite together.

- **Edge labels**: `releaseEdgeLabels()` replaces `removeEdgeLabels()` in `<xy-edge>.disconnectedCallback` (no change-in-update warning); the `ui.spec.ts` ignore is removed.
- **Escape on an edge**: Escape on a focused edge also unselects every node (React parity).
- **`fitView` with group nodes**: the frame-driven measure batch (`MeasureController.flush(false)`) no longer resolves a queued `fitView`; the resize-observer batch does, so group nodes with a declared size are in the initial fit. The `node-resizer` workaround and the docs "Known issue" are gone.
- **Keyboard connecting**: decision, no keyboard connect mode (React Flow parity); the accessibility guide says so.
- **UI accessibility**: `<xy-control-button>` forwards `aria-label` and `title`; `buttonHandle` puts the button in a sibling anchor (no nested interactive); the `muted` ui token goes from 58% to 72% of `currentColor` (AA in light mode).
- **Presence label**: presence label counts everyone in the room including you; arrowheads already match React Flow (verified and pinned by a test, no change).
- No dependency changes.

### Test infrastructure and gate determinism

Determinism of the test gate.

- **Flaky first runs**: root cause of the first-run failures: a dev server or test run that is watching a module-graph file reloads the page when the file is rewritten (`gen-styles` rewrote `generated/*.css.ts` on every build; reproduced by touching the file during `lit/ui.spec.ts`, 6 of 11 failed), and a page that connects before the dependency optimizer has finished can be reloaded when it finds a dependency late. Fixes: `gen-styles` writes only when the content changed; the Playwright dev servers run with `XY_TEST_SERVER=1` (`config/vite-dev.ts`: no file watcher, and `/__xy-root.json` answers 503 until the dependency scan is done, every module under `src/` was transformed once and the optimizer has nothing left to discover); `pnpm test` runs with `XY_TEST_SERVER=1` (no watcher) and the vitest browser project pre-bundles from every `packages/*/src/**/*.ts` and browser test, so a lazy import such as `lit/directives/if-defined.js` is found up front. `pnpm test` and `pnpm e2e` pass 5 times cold under load.
- **Server reuse**: Playwright reuses a server only if `/__xy-root.json?root=<checkout>` answers 200 (Vite plugin for the examples app, an `onRequest` hook in the collab server); another checkout's server answers 409 and the busy port then fails loudly. Docs and Storybook (static builds) never reuse a server. `XY_ISOLATED_PORTS=1` still disables reuse.
- **Generated files**: `gen-styles.mjs` formats the CSS with the repository's Prettier config and skips unchanged files; the committed generated files were regenerated once. The `.vitepress/cache` entries of `.gitignore` were anchored to the repository root and 40 cache files of `apps/docs` had been committed: untracked, and the ignore patterns are now `**/.vitepress/{cache,dist}`. `pnpm build` and every gate command leave `git status` clean.
- **IndexedDB teardown**: the error is Firefox closing IndexedDB under a connected page (context close) while updates still arrive: y-indexeddb's update listener throws `InvalidStateError`. `apps/examples` collab session replaces that listener with a guard that stops persisting once the database is closed (`guardPersistence`) and tears the session down on `pagehide`; the collab e2e helper destroys each session before closing its context. `packages/collab-yjs` has no y-indexeddb code and is unchanged. In-flight transactions aborted by a forced teardown can still log `AbortError` under a flood of edits (3 peers, one update every 3 ms); the test suite does not produce them.
- **Vendoring**: `scripts/vendor-xyflow.sh` copies the pristine upstream files, runs Prettier on the CSS and re-applies `scripts/patches/conformance.patch` and `fixtures.patch` with `git apply`; idempotent (verified: `git status` unchanged after two runs). `XYFLOW_REMOTE` overrides the clone URL.
- **CI**: `.github/workflows/ci.yml` runs the whole gate on ubuntu with `playwright install --with-deps chromium firefox webkit` (no `XY_BROWSERS`), so WebKit runs there; it ends with a clean-tree check. WebKit was never run locally.
- **autoPan conformance tests**: the autoPan conformance tests run first and alone, chained in `<browser>-autopan` projects with `fullyParallel: false`; every other project depends on them. The vendored spec is unchanged. Passed 6 of 6 under a load average above 30.
- **Docs snippets**: `apps/docs/scripts/check-snippets.mjs` (`pnpm --filter @xy-lit/docs check:snippets`, part of the docs `test`) type-checks the React 19 (against the real `@types/react` found in the pnpm store, a Storybook dependency), Angular (minimal ambient `@angular/core`, template string not compiled) and Svelte (instance script with an ambient `$state`, markup not compiled) snippets of `guide/frameworks.md` against the real `@xy-lit/flow` types. The docs `gen-api.mjs` empties `api/` instead of deleting it, so a running `vitepress dev` keeps watching it. The "not covered by tests" warning of the page says what is covered.
- Shared files touched: root `package.json` (`test` sets `XY_TEST_SERVER=1`), `vitest.config.ts`, `.gitignore`, `config/*`, `scripts/*`, `apps/*/vite.config.ts` and Playwright configs, `apps/collab-server/src/server.ts` (`onRequest` root check), `apps/examples/src/collab/session.ts`, `apps/docs/guide/frameworks.md` (the coverage note).
