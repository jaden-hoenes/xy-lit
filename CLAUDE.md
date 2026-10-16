# Maintaining XY Lit

XY Lit is a Lit port of React Flow on `@xyflow/system`. The design documents in `spec/` describe the
0.1 design (see `spec/README.md`); `spec/00-decisions.md` holds the locked decisions and a changelog
of every deviation. When the code and a design document disagree, the changelog usually says why.
When a behaviour is not covered there, do what `.vendor/xyflow/packages/react` does (React is the
reference binding for behaviour; Svelte is the reference for structure).

## Ground rules

1. **Only `packages/store/src/engine.ts` imports `@xyflow/system`.** Everything else imports engine
   symbols from `@xy-lit/store` (or `./engine.js` inside the store package). ESLint enforces this.
2. **No decorators.** Lit elements declare reactive properties with `static properties` and
   `declare` fields (see `spec/01-workspace.md` §Lit conventions). This keeps the build independent
   of decorator transforms.
3. **One DOM tree per flow.** Nodes, handles and edges render inside `<xy-flow>`'s single shadow
   root (or the document in `render-root="light"`). Never give `<xy-node>`, `<xy-handle>`,
   `<xy-edge>` or a node renderer its own shadow root. See `spec/05-nodes.md` §Single-tree rule.
4. **No HTML from data.** Never use `unsafeHTML`, `unsafeStatic`, `.innerHTML` or tag names derived
   from node/edge data. Labels are text or registered renderers.
5. **No persistent `document`/`window` listeners per element.** The only global listeners are the
   shared `KeyboardTracker` (one per page) and temporary gesture listeners that are removed when the
   gesture ends.
6. **Ported code** carries a header: `// Ported from xyflow (MIT) <path>@3d35b57`. Keep the logic
   structure close to the source so future upstream fixes can be diffed in.
7. **Strict TypeScript**, no `any` in public types. `// eslint-disable` needs a reason comment.
8. **Every public element, controller and function has a test** (unit or e2e).
9. **Dependencies.** Use `pnpm`. A new dependency needs a reason, recorded in
   `spec/00-decisions.md` §Changelog (and a version in its pinned-versions table).
10. **Changes that users can see need a changeset** (`pnpm changeset`). A change that alters a
    locked decision or deviates from a design document adds a line to
    `spec/00-decisions.md` §Changelog.

## Commands

```sh
pnpm install
pnpm build                    # all packages (pnpm build:apps builds the apps)
pnpm test                     # unit tests (store in Node, elements in browser mode)
pnpm e2e                      # conformance + own e2e (FRAMEWORK=lit), Chromium/Firefox/WebKit
pnpm e2e:collab               # multi-client tests against the local Hocuspocus server
pnpm fuzz                     # collaboration convergence fuzzing (FUZZ_RUNS=10000 in CI)
pnpm perf                     # stress pages, frame-time budget
pnpm lint && pnpm typecheck
pnpm manifest && pnpm check:packages   # custom-elements manifests, publishing dry run
pnpm --filter @xy-lit/storybook build && pnpm --filter @xy-lit/storybook test
pnpm --filter @xy-lit/docs build && pnpm --filter @xy-lit/docs test
pnpm dev                      # examples app on http://localhost:5174
pnpm dev:docs | dev:storybook | dev:collab
pnpm vendor                   # checks out xyflow at the pinned commit into .vendor/xyflow
```

CI (`.github/workflows/ci.yml`) runs the whole list above on Chromium, Firefox and WebKit and ends
by checking that the working tree is clean: no command may leave generated files behind. On a
machine where WebKit cannot run, set `XY_BROWSERS=chromium,firefox`. To run servers of two
checkouts at the same time, use different port blocks (`EXAMPLES_PORT`, `DOCS_PORT`,
`STORYBOOK_PORT`, `COLLAB_PORT`, see `config/ports.ts`) and `XY_ISOLATED_PORTS=1`.

## Where to look in upstream

`scripts/vendor-xyflow.sh` (`pnpm vendor`) checks out xyflow at `3d35b57` into `.vendor/xyflow` and
re-applies XY Lit's patches to the vendored CSS, conformance specs and fixtures. The design
documents cite files there by path, for example `.vendor/xyflow/packages/react/src/store/index.ts`.
Read the cited file before changing ported code.

## When you are stuck

- If an engine behaviour seems to require a change to `@xyflow/system`, do not patch it. Add a
  workaround in the binding and record it in `spec/00-decisions.md` §Changelog with the upstream
  change you would propose.
- If a vendored e2e test cannot pass for a reason the design accepts (see `spec/13-testing.md`
  §Allowed patches), patch the vendored copy with a `// XY Lit:` comment explaining why, and list
  it in `tests/e2e/conformance/PATCHES.md`.
