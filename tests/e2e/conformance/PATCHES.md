# Patches to the vendored conformance specs

The files in this directory are copied from xyflow (`tests/playwright/e2e/*.ts`, MIT, commit
`3d35b57`) by `scripts/vendor-xyflow.sh`. Only the edits listed here are allowed (spec/13 §Allowed
patches). Every edit carries a `// XY Lit:` comment. Anything else that fails is a bug in XY Lit.
Patches 1 to 3 live as `scripts/patches/conformance.patch` (and the fixture imports as
`scripts/patches/fixtures.patch`); `scripts/vendor-xyflow.sh` copies the pristine upstream files and then
re-applies them with `git apply`, so re-running it is idempotent and leaves `git status` clean. After
changing a patched file by hand, regenerate the patch (diff the pristine upstream copy in `.vendor/xyflow`
against the file) in the same commit. A patch that no longer applies after an upstream bump fails the
script loudly.

| # | File | Change | Why |
|---|---|---|---|
| 1 | `constants.ts` | `FRAMEWORK` is `process.env.FRAMEWORK ?? 'lit'` | The suite selects everything as `.${FRAMEWORK}-flow__…`; XY Lit's engine `lib` is `lit`. `tests/e2e/playwright.config.ts` also sets the variable. |
| 2 | `nodes.spec.ts` "selecting multiple nodes with shift drag" | Both locator ternaries are `FRAMEWORK === 'svelte' ? '.svelte-flow__selection' : ``.${FRAMEWORK}-flow__nodesselection`` (and `…__selection` for the rectangle) | The Svelte branch hard-codes `.svelte-flow__selection`. XY Lit renders React's selection DOM (`.lit-flow__nodesselection` for the selected-nodes box, `.lit-flow__selection` for the rectangle). |
| 3 | `nodes.spec.ts` "panning from a multi-selection rectangle with the middle mouse button" | `test.skip(FRAMEWORK === 'svelte', …)` instead of `FRAMEWORK !== 'react'`; the three `.react-flow__` locators are `.${FRAMEWORK}-flow__` | XY Lit has React's selection rectangle with its own drag handler, so the test applies to it. |

No spec is skipped for XY Lit.

## Environment notes (not patches)

`tests/e2e/playwright.config.ts` runs `Pane default › autoPan › autoPanOnNodeDrag` in a second Firefox
project, `firefox-wide` (a 2100x2100 window), and excludes it from the normal `firefox` project. The test
moves the mouse to (2000, 2000), outside Playwright's 1280x720 window. Playwright-Firefox cannot
deliver mouse events there (they arrive as (0, -86) and the `mouse.up()` is dropped), so the node
drag never ends and the test reads the viewport mid auto-pan. The two axes of that pan cancel out
depending on frame timing: the unpatched test fails in about 90% of the runs with XY Lit's fast
handlers and never with 1 ms of artificial work per mouse move. The test file is unchanged and still
runs in Chromium at the default size. Other tests must keep the default window because their
geometry (selection rectangles relative to node boxes) depends on the fit-view zoom.

## Skipped tests

The gate allows these skips and no others (all come from the upstream specs, none from XY Lit):

- `pane.spec.ts` "touch drag pans when primary mouse drag is reserved for selection" and "selection key
  keeps touch drag in selection mode": `test.skip(browserName !== 'chromium', ...)`, because touch input
  is driven through CDP. They run in Chromium and are skipped in Firefox and WebKit (2 skips per
  non-Chromium browser).

The two `autoPan` tests of `pane.spec.ts` (`autoPanOnNodeDrag`, `autoPanOnConnect`) are timing-sensitive: the
viewport pans in a timer-driven loop and the spec reads the transform right after a burst of mouse moves, so
they fail when other browsers compete for the CPU. `tests/e2e/playwright.config.ts` runs them first and alone,
in the `<browser>-autopan` projects (and `firefox-wide`), chained one after the other with
`fullyParallel: false`; all other projects depend on them. The spec file is unchanged.
