# Contributing to XY Lit

Thanks for helping. Bug reports, documentation fixes, examples and code are all welcome. By taking
part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, follow
[SECURITY.md](SECURITY.md) instead of opening an issue.

For anything bigger than a small fix, open an issue first so we can agree on the approach before
you spend time on it.

## Setup

You need Node 22 or newer and [pnpm](https://pnpm.io) 11 (the exact version is pinned in
`packageManager` in `package.json`; `corepack enable` picks it up).

```sh
git clone https://github.com/jaden-hoenes/xy-lit.git
cd xy-lit
pnpm install
pnpm exec playwright install chromium firefox webkit   # browsers for unit and e2e tests
pnpm build
```

`pnpm dev` starts the examples app on http://localhost:5174, `pnpm dev:docs` the documentation site
and `pnpm dev:storybook` Storybook. Workspace packages are resolved from source in dev, tests,
Storybook and the docs, so those need no prior build.

The design documents in [`spec/`](spec) describe how the packages are meant to work
(see [`spec/README.md`](spec/README.md)). The conformance tests and the CSS come from
[xyflow](https://github.com/xyflow/xyflow) at a pinned commit; `pnpm vendor` checks it out into
`.vendor/xyflow` and re-applies XY Lit's patches (`scripts/patches`, listed in
`tests/e2e/conformance/PATCHES.md`). Run it when you need to read the upstream code a port refers to.

## The local gate

CI runs the following, in order, on Chromium, Firefox and WebKit. A change is ready when all of it
passes:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm typecheck
pnpm test                                    # unit tests (store in Node, elements in browser mode)
pnpm e2e                                     # conformance and own end-to-end tests
FUZZ_RUNS=10000 pnpm fuzz                    # collaboration convergence fuzzing
pnpm e2e:collab                              # multi-client tests against a local Hocuspocus server
pnpm perf                                    # stress pages and frame-time budgets
pnpm manifest
pnpm check:packages                          # packs every package and checks the tarballs
pnpm --filter @xy-lit/storybook build && pnpm --filter @xy-lit/storybook test
pnpm --filter @xy-lit/docs build && pnpm --filter @xy-lit/docs test
git status --porcelain                       # must be empty: no command may leave generated files
```

Playwright's WebKit does not run on every Linux distribution. If it cannot run on your machine, set
`XY_BROWSERS=chromium,firefox`; CI always runs WebKit, so a WebKit-only failure shows up in your pull
request. Narrow runs while you work, for example `pnpm e2e -- lit/pro.spec.ts` or
`pnpm vitest run --project store`.

### Ports

Dev servers and test servers get their ports from `config/ports.ts`: `EXAMPLES_PORT` (5174),
`DOCS_PORT` (5176), `STORYBOOK_PORT` (6006) and `COLLAB_PORT` (1234). If you run two checkouts or
git worktrees at the same time, give each its own block and set `XY_ISOLATED_PORTS=1` so Playwright
never reuses a server another checkout started:

```sh
export XY_ISOLATED_PORTS=1 EXAMPLES_PORT=5320 DOCS_PORT=5322 STORYBOOK_PORT=5323 COLLAB_PORT=5324
```

### The hosted sites

`.github/workflows/pages.yml` publishes the docs, Storybook (`/storybook/`) and the examples app
(`/examples-app/`) to GitHub Pages under one prefix. `node scripts/build-pages.mjs` builds and
assembles the same layout into `.pages` (set `PAGES_BASE`, `PAGES_ORIGIN` and `PAGES_OUT` to test a
different prefix); serve that directory under the prefix with any static server to check it. The
apps read their base path from `DOCS_BASE` and `EXAMPLES_BASE`; without them everything is served
from `/` as in development.

## Code ground rules

The full list is in [`CLAUDE.md`](CLAUDE.md). In short:

- Only `packages/store/src/engine.ts` imports `@xyflow/system`; everything else imports engine symbols
  from `@xy-lit/store`. ESLint enforces this.
- No decorators: Lit properties are declared with `static properties` and `declare` fields.
- One DOM tree per flow: nodes, handles and edges render inside `<xy-flow>`'s single root and never
  get a shadow root of their own.
- No HTML from data: no `unsafeHTML`, `unsafeStatic`, `.innerHTML` or tag names built from node or
  edge data.
- No persistent `document` or `window` listeners per element; gesture listeners are removed when the
  gesture ends.
- Code ported from xyflow carries the header `// Ported from xyflow (MIT) <path>@3d35b57` and keeps
  the structure of the source.
- Strict TypeScript, no `any` in public types, a reason comment on every `eslint-disable`.
- Every public element, controller and function has a test.
- A new dependency needs a reason in `spec/00-decisions.md` §Changelog.

## Changesets and pull requests

Changes that users of a published package can see (`@xy-lit/store`, `flow`, `collab-yjs`, `pro`,
`ui`) need a changeset:

```sh
pnpm changeset
```

Pick the affected packages and the bump (`patch` for fixes, `minor` for features and, while the
version is 0.x, breaking changes), and write one or two sentences for the release notes. Documentation,
tests and internal changes need none. Maintainers publish by merging the "Version packages" pull
request that the release workflow opens.

Keep pull requests focused, add or update tests and docs for what you change, and fill in the pull
request template. A change that alters a locked decision or deviates from a design document adds an
entry to `spec/00-decisions.md` §Changelog.
