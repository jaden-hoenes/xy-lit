# 01 · Workspace

## Layout

```
.
├─ package.json                 root scripts, devDependencies, packageManager
├─ pnpm-workspace.yaml          packages/*, apps/*, tests/*
├─ tsconfig.base.json
├─ eslint.config.js
├─ .prettierrc.json
├─ vitest.workspace.ts          (or vitest.config.ts with `projects`)
├─ .changeset/config.json
├─ .gitignore                   node_modules, dist, .vendor, test-results, playwright-report, *.tsbuildinfo
├─ THIRD_PARTY_NOTICES.md       xyflow MIT licence text + list of ported files
├─ tsconfig.paths.json          paths -> sibling package sources (typecheck/IDE only)
├─ config/                      shared by every config file
│  ├─ ports.ts                  the only place ports/defaults live; XY_ISOLATED_PORTS, XY_BROWSERS
│  ├─ aliases.ts                workspace package entry -> source (Vite/Vitest/Storybook/VitePress)
│  └─ vite-lib.ts               libConfig(): shared library-mode Vite config
├─ scripts/
│  └─ vendor-xyflow.sh          (exists)
├─ packages/
│  ├─ store/                    @xy-lit/store      no Lit, no rendering
│  ├─ flow/                     @xy-lit/flow       Lit elements, controllers, styles
│  ├─ collab-yjs/               @xy-lit/collab-yjs
│  ├─ pro/                      @xy-lit/pro
│  └─ ui/                       @xy-lit/ui
├─ apps/
│  ├─ examples/                 Vite app: conformance fixtures, examples, demos, stress pages
│  ├─ storybook/                Storybook 10 (16)
│  ├─ docs/                     VitePress docs site (16)
│  └─ collab-server/            Hocuspocus server (sqlite persistence) for demos and e2e
└─ tests/
   ├─ e2e/                      Playwright: conformance/ (vendored), lit/ (ours), collab/
   └─ perf/                     Playwright perf scripts
```

## Root files

`package.json`

```json
{
  "name": "xy-lit",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.25.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "vendor": "bash scripts/vendor-xyflow.sh",
    "build": "pnpm -r --filter './packages/*' build",
    "dev": "pnpm --filter @xy-lit/examples dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "pnpm --filter @xy-lit/e2e test",
    "e2e:collab": "pnpm --filter @xy-lit/e2e test:collab",
    "fuzz": "pnpm --filter @xy-lit/collab-yjs fuzz",
    "perf": "pnpm --filter @xy-lit/perf test",
    "lint": "eslint .",
    "typecheck": "pnpm -r typecheck",
    "format": "prettier --write .",
    "manifest": "pnpm -r --filter './packages/*' manifest"
  },
  "devDependencies": {
    "@changesets/cli": "^3.0.3",
    "@playwright/test": "1.64.1",
    "@types/node": "^26.6.5",
    "@vitest/browser-playwright": "^5.0.4",
    "eslint": "^10.12.0",
    "eslint-plugin-lit": "^2.3.1",
    "eslint-plugin-wc": "^3.1.0",
    "prettier": "^3.9.10",
    "tsx": "^4.23.15",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.71.2",
    "vite": "^8.3.4",
    "vitest": "^5.0.4"
  }
}
```

`pnpm-workspace.yaml`

```yaml
packages:
  - packages/*
  - apps/*
  - tests/*
```

`tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "useDefineForClassFields": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`useDefineForClassFields: false` is required by the Lit conventions below (it stops class
fields from shadowing Lit's reactive accessors). Each package's `tsconfig.json` extends the
base, sets `rootDir: "src"`, `outDir: "dist"`, and `include: ["src"]`. A `tsconfig.test.json`
per package includes `test/`.

`eslint.config.js` (flat config) must contain:

- `typescript-eslint` recommended-type-checked for `packages/*/src`.
- `eslint-plugin-lit` recommended, `eslint-plugin-wc` recommended.
- `no-restricted-imports`: forbid `@xyflow/system` everywhere except
  `packages/store/src/engine.ts`; forbid `lit/directives/unsafe-html.js`,
  `lit/directives/unsafe-svg.js`, `lit/static-html.js` in all packages.
- `no-restricted-syntax`: forbid `MemberExpression[property.name='innerHTML']` assignments in
  `packages/*/src`; forbid `Decorator`.
- `no-restricted-globals` / custom rule: forbid `document.addEventListener` and
  `window.addEventListener` outside `packages/store/src/keyboard/key-tracker.ts`,
  `packages/flow/src/elements/xy-handle.ts` (gesture fallback) and test files.

## Packages

All packages are ESM-only, `"type": "module"`, `"sideEffects": false` except `@xy-lit/flow`
which lists `["./dist/define.js"]`. Build: `vite build` in library mode plus `tsc -p
tsconfig.build.json --emitDeclarationOnly`. Externalise every dependency and peer dependency
(`rollupOptions.external: [/^lit/, /^@lit\//, /^@xyflow\//, /^yjs/, /^y-/, /^lib0/, /^@xy-lit\//, …]`).
Use `build.lib.entry` as a map so every public entry point is its own chunk, and
`preserveModules`-style output (`output.preserveModules: true`) so tree shaking works.
Vite 8 bundles with Rolldown: put these under `build.rolldownOptions` (if your Vite version
still documents `build.rollupOptions`, use that; the keys are the same).

### `@xy-lit/store`

```json
{
  "name": "@xy-lit/store",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./internal": { "types": "./dist/internal.d.ts", "import": "./dist/internal.js" }
  },
  "files": ["dist"],
  "sideEffects": false,
  "scripts": {
    "build": "vite build && tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.test.json --noEmit"
  },
  "dependencies": { "@xyflow/system": "0.0.83", "rbush": "^4.0.1" },
  "devDependencies": { "@types/rbush": "^4.0.0" }
}
```

Source files (each is specified in `03-store.md` unless noted):

```
packages/store/src/
  index.ts                  public exports (see 03-store.md §Exports)
  internal.ts               engine internals for sibling packages (XYDrag, XYHandle, …, STORE_SYMBOL)
  engine.ts                 the only @xyflow/system import; named re-exports only
  constants.ts              LIB, LIB_NAME, DOCS_URL, DEFAULTS, ARIA ids
  types/                    02-types.md
    nodes.ts edges.ts changes.ts events.ts instance.ts source.ts options.ts index.ts
  changes.ts                applyNodeChanges, applyEdgeChanges, getElementsDiffChanges, …
  flow-store.ts             FlowStore class
  state.ts                  FlowState type, createInitialState()
  visible.ts                getVisibleNodes, getLayoutedEdges (+ parallel offsets)
  selection.ts              selection-change helpers
  instance.ts               createFlowInstance(store): FlowInstance
  batch.ts                  SetQueue (BatchProvider port)
  sources/array-source.ts   ArraySource
  keyboard/key-tracker.ts   KeyboardTracker singleton + keyCode matching
  keyboard/key-code.ts      parseKeyCode, matchesKeyCode (useKeyPress port)
  placement.ts              findFreePosition + NodeSpatialIndex (rbush)
  markers.ts                createMarkerDefs (upstream createMarkerIds + custom markers)
  edges/end-labels.ts       getEdgeEndLabelPosition
  edges/parallel.ts         assignParallelOffsets
  dev.ts                    devWarn, error reporting helper
  utils.ts                  isNode, isEdge, shallow, arrowKeyDiffs, toPx
```

### `@xy-lit/flow`

```json
{
  "name": "@xy-lit/flow",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./define.js": { "types": "./dist/define.d.ts", "import": "./dist/define.js" },
    "./custom-elements.json": "./custom-elements.json"
  },
  "customElements": "custom-elements.json",
  "files": ["dist", "custom-elements.json"],
  "sideEffects": ["./dist/define.js"],
  "scripts": {
    "gen:styles": "node scripts/gen-styles.mjs",
    "build": "pnpm gen:styles && vite build && tsc -p tsconfig.build.json",
    "manifest": "cem analyze --litelement --globs 'src/**/*.ts' --outdir .",
    "typecheck": "tsc -p tsconfig.test.json --noEmit"
  },
  "dependencies": { "@xy-lit/store": "workspace:*", "lit": "^3.3.3", "@lit/context": "^1.1.6" },
  "devDependencies": {
    "@custom-elements-manifest/analyzer": "^0.11.0",
    "postcss": "^8.5.30",
    "postcss-nested": "^8.0.1",
    "postcss-rename": "^0.8.1"
  }
}
```

```
packages/flow/src/
  index.ts                  public exports (classes, controllers, helpers, re-exported store API)
  define.ts                 customElements.define for every element (idempotent: skip if defined)
  context.ts                flowContext, nodeIdContext, edgeIdContext, nodeConnectableContext
  elements/
    xy-flow.ts              04-flow-element.md
    xy-flow/                helpers owned by xy-flow (not elements)
      panzoom.ts            PanZoomController (XYPanZoom lifecycle)
      pane.ts               PaneController (click, context menu, user selection, auto-pan)
      keys.ts               FlowKeysController (KeyboardTracker → store, delete, active flow)
      measure.ts            MeasureController (shared ResizeObserver, rAF batching)
      render-complete.ts    RenderCompleteController
      templates.ts          layer templates (edges, labels, nodes, toolbars, selection, a11y)
      attributes.ts         attribute converters (booleans, numbers, JSON arrays, key codes)
      connection-hub.ts     ConnectionHub (06 §Connection highlight)
      container-size.ts     ContainerSizeController
    xy-flow-provider.ts
    xy-node.ts              05-nodes.md
    xy-handle.ts            06-handles-connections.md
    xy-edge.ts              07-edges.md
  nodes/
    define-node-type.ts     defineNodeType, NodeTypeDefinition
    flow-node-element.ts    FlowNodeElement base class
    builtin.ts              default, input, output, group
    node-toolbar.ts         nodeToolbar() directive + toolbar registry types
  edges/
    define-edge-type.ts     defineEdgeType, EdgeTypeDefinition, EdgeRenderResult
    base-edge.ts            baseEdge() → SVGTemplateResult
    edge-text.ts            edgeText() label template
    builtin.ts              default(bezier), straight, step, smoothstep, simplebezier
    simple-bezier.ts        getSimpleBezierPath (React port)
    offset-bezier.ts        getOffsetBezierPath (parallel edges)
    markers.ts              markerDefs() → SVGTemplateResult
    reconnect-anchors.ts    reconnect anchor templates + pointer handler
    edge-toolbar.ts         edgeToolbar() helper
  connection-line.ts        default + custom connection line rendering
  drag.ts                   createDragStoreItems(), handleNodeClick() (05 §Dragging)
  controllers/              09-controllers-context.md (one file per controller)
  plugins/                  08-plugins.md (one file per element)
  styles/
    vendor/                 copied by vendor-xyflow.sh (do not edit)
    generated/              output of scripts/gen-styles.mjs (committed)
    sheets.ts               shared constructable stylesheets, adoptInto(root)
    extra.css.ts            XY Lit additions (loading overlay, motion, remote selection, toolbar layer)
  motion.ts                 entrance motion helpers
  wheel.ts                  wheel-scroll detection listener
  dev.ts                    dev-only checks (nested shadow roots, missing heights)
packages/flow/scripts/gen-styles.mjs
```

### `@xy-lit/collab-yjs`

Entry points: `.` and `./server` (11 §Server entry). Dependencies: `@xy-lit/store` (workspace), `fractional-indexing ^4.0.0`, `perfect-cursors ^1.0.5`,
`lit ^3.3.3`, `@lit/context ^1.1.6`. Peer: `yjs ^13.6.33`, `y-protocols ^1.0.7`.
Dev: `fast-check ^4.10.2`, `yjs`, `y-protocols`, `@xy-lit/flow` (workspace). Script `fuzz`:
`vitest run --project collab-fuzz`.

```
packages/collab-yjs/src/
  index.ts
  yjs-flow-source.ts        YjsFlowSource implements FlowDataSource
  schema.ts                 SCHEMA_VERSION, key lists, toYNode/toYEdge, fromY*
  materialize.ts            incremental cache, observeDeep handling
  overlay.ts                LocalOverlay (selected, dragging, resizing, measured)
  order.ts                  fractional index helpers
  repair.ts                 orderAndRepair(), healing writer
  migrations.ts             migration registry
  awareness.ts              PresenceState, PresenceChannel (throttled awareness writes)
  undo.ts                   UndoController wiring Y.UndoManager
  origins.ts                LOCAL, REMOTE_HEAL, MIGRATION, SERVER symbols/strings
  elements/xy-remote-cursors.ts
  elements/xy-presence-avatars.ts
  controllers/presence-controller.ts
  server.ts                 validateDoc, healDoc (no Lit, no DOM)
  define.ts
```

### `@xy-lit/pro` and `@xy-lit/ui`

See `12-pro-ui.md` for files. `@xy-lit/pro` depends on store + flow; optional peers
`@dagrejs/dagre`, `elkjs`, `d3-force`, `d3-hierarchy`. `@xy-lit/ui` depends on flow.

## Ports and isolation

Every dev server and Playwright config reads its port from `config/ports.ts`, which takes the
environment variables `EXAMPLES_PORT` (5174), `DOCS_PORT` (5176), `STORYBOOK_PORT` (6006) and
`COLLAB_PORT` (1234). `XY_ISOLATED_PORTS=1` stops Playwright from reusing a server that is
already running, so two checkouts can run their tests side by side on different port blocks. No
port is hard-coded anywhere else.

## Dependencies

Every dependency of every package and app (versions in `00-decisions.md`):

| Package/app | dependencies | devDependencies |
|---|---|---|
| store | `@xyflow/system`, `rbush` | `@types/rbush` |
| flow | store, `lit`, `@lit/context` | `@custom-elements-manifest/analyzer`, `postcss`, `postcss-nested`, `postcss-rename` |
| collab-yjs | store, flow, `lit`, `@lit/context`, `fractional-indexing`, `perfect-cursors`; peers `yjs`, `y-protocols` | `yjs`, `y-protocols`, `lib0`, `fast-check` |
| pro | store, flow, `lit`, `rbush`; optional peers `@dagrejs/dagre`, `elkjs`, `d3-force`, `d3-hierarchy` | those four, `@types/d3-force`, `@types/d3-hierarchy`, `@types/rbush` |
| ui | store, flow, `lit`, `@lit/context` | — |
| apps/examples | all `@xy-lit/*`, `lit`, `yjs`, `y-protocols`, `@hocuspocus/provider`, `y-indexeddb`, `@dagrejs/dagre`, `elkjs`, `d3-force`, `d3-hierarchy` | — |
| apps/storybook | all `@xy-lit/*`, `lit`, `yjs`, `y-protocols` | `storybook`, `@storybook/web-components-vite`, `@storybook/web-components`, `@storybook/addon-docs`, `@storybook/addon-a11y`, `@fontsource-variable/inter` |
| apps/docs | all `@xy-lit/*`, `lit`, `yjs` | `vitepress`, `@fontsource-variable/inter` |
| apps/collab-server | collab-yjs, `@hocuspocus/server`, `@hocuspocus/extension-sqlite`, `@hocuspocus/extension-logger`, `yjs` | `tsx` |
| tests/e2e, tests/perf | — | `@playwright/test`, `@axe-core/playwright`, `yjs` |

Workspace packages use `workspace:*`.

Also installed at the root (not in the table above): `@eslint/js` (ESLint 10 no longer
ships its recommended config with the core package). pnpm 11 requires build-script approval:
`pnpm-workspace.yaml` sets `allowBuilds` for `better-sqlite3`, `esbuild`, `rs-module-lexer`.

### Cross-package type resolution

`tsconfig.json` of a package (rootDir `src`) has no `paths`, so `tsc -p tsconfig.build.json`
resolves sibling packages through `node_modules` → their `dist` (builds run in topological order).
`tsconfig.test.json` and every app/test tsconfig extend `tsconfig.paths.json` instead, which maps
`@xy-lit/*` entries to sources, so `pnpm typecheck` needs no prior build. When you add a package
entry point, update `package.json#exports`, `vite.config.ts`, `config/aliases.ts` and
`tsconfig.paths.json`.

## Apps

### `apps/examples` (`@xy-lit/examples`, private)

Vite app (no framework) with a tiny router in `src/main.ts`. Routes are **auto-discovered**
with `import.meta.glob('./examples/**/*.ts')` (and the same for fixtures), so adding a page needs no edit of a
shared route table:

- `/` index page listing every route.
- `/tests/generic/:topic/:example` → loads `src/generic-tests/${topic}/${example}.ts` via
  `import.meta.glob('./generic-tests/**/*.ts')` and mounts `mountFixture(config)` (see
  `13-testing.md`). Unknown route → `<h1>404</h1>`.
- `/examples/:name` → `src/examples/${name}.ts` default export `(root: HTMLElement) => void`.
- `/collab/:room` → collaboration demo (Hocuspocus + y-indexeddb).
- `/stress/:count` → stress page (1k/5k/10k nodes).

As built (`src/router.ts`): parametrised pages live in `src/pages/` and the **file name is
the route** (dots are slashes, `[p]` is a param): `pages/collab.[room].ts` → `/collab/:room`,
`pages/stress.[count].ts` → `/stress/:count`. A page module default-exports
`(root, params) => void` and may export `links: string[]` for the index page. Fixtures are
discovered from `src/generic-tests/*/*.ts` (not `components/`), and `src/fixture.ts`
(`mountFixture`) is looked up lazily.

`vite.config.ts`: `server.port = ports.examples` (`config/ports.ts`, i.e. `EXAMPLES_PORT`, default 5174), `strictPort: true`, `appType: 'spa'`. Resolve
workspace packages from source with `resolve.alias` → `packages/*/src/index.ts` so dev does
not need a build. Dependencies: all `@xy-lit/*` (workspace), `yjs`, `@hocuspocus/provider`,
`y-indexeddb`.

### `apps/collab-server` (`@xy-lit/collab-server`, private)

`src/server.ts` (run with `tsx`): Hocuspocus `Server` on `COLLAB_PORT` (default 1234) with `@hocuspocus/extension-sqlite`
(`database: process.env.DB ?? ':memory:'`) and `@hocuspocus/extension-logger`. Implements
`onAuthenticate` accepting a `token` of the form `user:<id>[:ro]`; `:ro` sets
`connection.readOnly = true`. Implements an `onChange` debounce (2 s) that runs the shared
`orderAndRepair` validator from `@xy-lit/collab-yjs/server` (see `11-collab-yjs.md`
§Server validation) and writes fixes with origin `'server'`.

## Tests

### Perf (`tests/perf`, package `@xy-lit/perf`)

Own `playwright.config.ts` (Chromium only, `workers: 1`, same `webServer` as e2e), script
`test` → `playwright test`. See `13-testing.md` §Performance.

### Vitest (`vitest.config.ts` at root)

```ts
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'store', include: ['packages/store/test/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'collab', include: ['packages/collab-yjs/test/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'collab-fuzz', include: ['packages/collab-yjs/fuzz/**/*.fuzz.ts'], environment: 'node', testTimeout: 600_000 } },
      {
        test: {
          name: 'browser',
          include: ['packages/{flow,pro,ui,collab-yjs}/test/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
          },
        },
      },
    ],
  },
});
```

`pnpm test` runs every project except `collab-fuzz` (exclude it via `--project` flags in the
script: `vitest run --project store --project collab --project browser`).

As built (`vitest.config.ts`):

- Every project uses `extends: true` so the root `resolve.alias` (`config/aliases.ts`, workspace
  packages from source) applies to all of them.
- The Node projects (`store`, `collab`) exclude `**/*.browser.test.ts`, otherwise the
  `*.test.ts` glob would also pick up browser tests.
- Browser instances come from `selectedBrowsers()` in `config/ports.ts`: all three by default;
  `XY_BROWSERS=chromium,firefox` narrows them on hosts where WebKit's system libraries are
  missing (Playwright does not support every Linux distribution). Never set it in CI.

### Playwright (`tests/e2e`, package `@xy-lit/e2e`)

`playwright.config.ts`:

- `testDir: '.'`, projects `chromium`, `firefox`, `webkit` (Desktop devices), `fullyParallel`.
- `webServer`: `pnpm --filter @xy-lit/examples dev` (the port comes from `EXAMPLES_PORT` via
  `config/ports.ts`), `reuseExistingServer: !CI && XY_ISOLATED_PORTS !== '1'`.
- `use.baseURL: http://localhost:${EXAMPLES_PORT}/`.
- `process.env.FRAMEWORK ??= 'lit'` at the top of the config (conformance specs read it).
- Scripts: `test` → `node run.mjs` (runs `playwright test` over `conformance/**` and `lit/**`;
  `run.mjs` drops the literal `--` that `pnpm e2e -- <file>` forwards, so a file argument
  narrows the run); `test:collab` → `XY_COLLAB=1 node run.mjs`, which adds `apps/collab-server`
  (port `COLLAB_PORT`) as a second `webServer` entry and runs only `collab/**` (Chromium and
  Firefox). Positional filters are matched against absolute paths, so write `lit/foo.spec.ts`,
  never a bare `lit` (the repo folder is called `lit-flow`).

## Lit conventions

```ts
import { LitElement, html, type PropertyValues } from 'lit';

export class XyPanel extends LitElement {
  static override properties = {
    position: { type: String, reflect: true },
  };
  declare position: PanelPosition;

  constructor() {
    super();
    this.position = 'top-right';
  }
}
```

- Reactive properties: `static properties` + `declare` + defaults in the constructor.
- Internal state: `{ state: true }` entries in `static properties`.
- Light render root where required: `protected override createRenderRoot() { return this; }`.
- Attribute names are kebab-case and set explicitly (`attribute: 'fit-view'`).
- Boolean attributes that default to `true` (e.g. `nodes-draggable`) use the converter
  `booleanAttr(defaultValue)` from `elements/xy-flow/attributes.ts`: attribute absent → default;
  `"false"` → false; any other value → true. Plain Lit `Boolean` cannot express default-true.
- Elements never `customElements.define` themselves in their module. `define.ts` does it.
- Every element class exports a `HTMLElementTagNameMap` augmentation from `define.ts`.
