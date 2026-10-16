// Conformance specs read the binding name from the environment (spec/13 §Conformance suite).
process.env.FRAMEWORK ??= 'lit';

import { defineConfig, devices } from '@playwright/test';
import type { Project } from '@playwright/test';
import { ports, reuseExistingServer, selectedBrowsers } from '../../config/ports.ts';
import { rootCheckUrl } from '../../config/root-check.ts';

/**
 * conformance/pane.spec.ts "autoPanOnNodeDrag" moves the mouse to (2000, 2000), outside Playwright's
 * default 1280x720 window. Playwright-Firefox cannot deliver mouse events there: they arrive as
 * (0, -86) and the following `mouse.up()` is dropped, so the drag never ends and the test reads the
 * viewport in the middle of an auto-pan whose axes cancel out depending on frame timing (it fails
 * almost always with fast handlers and never with 1 ms of busy work per mouse move; React Flow runs the
 * same engine code and is presumably just slower). Chromium is not affected.
 * That one test therefore runs in the `firefox-wide` project, a Firefox with a 2100x2100 window, so the
 * pointer stays inside the page. Everything else runs in the normal `firefox` project: other tests
 * depend on the 1280x720 layout. See tests/e2e/conformance/PATCHES.md.
 */
const FIREFOX_WIDE_TESTS = /autoPanOnNodeDrag/;

/**
 * The autoPan tests of conformance/pane.spec.ts pan the viewport with a timer-driven loop and read the
 * transform right after a burst of 100 mouse moves, so they fail when the machine is busy: in a full
 * run, the other workers' browsers compete for the CPU. They run first, alone, in a `<browser>-autopan`
 * project (one worker, `fullyParallel: false`); every other project of that browser depends on it, so
 * nothing else runs while they do. The vendored spec stays unchanged (PATCHES.md).
 */
const AUTOPAN_TESTS = /autoPan/;
const AUTOPAN_FILE = 'conformance/pane.spec.ts';

const examplesUrl = `http://localhost:${ports.examples}/`;
// the readiness URL also proves the server on the port belongs to this checkout (config/root-check.ts)
const collab = process.env.XY_COLLAB === '1';

const browsers = [
  { browser: 'chromium', device: devices['Desktop Chrome'] },
  { browser: 'firefox', device: devices['Desktop Firefox'] },
  { browser: 'webkit', device: devices['Desktop Safari'] },
].filter(({ browser }) => (selectedBrowsers() as string[]).includes(browser));

function projects(): Project[] {
  // Collaboration tests run in Chromium and Firefox only (see spec/13-testing.md).
  if (collab) {
    return browsers
      .filter(({ browser }) => browser !== 'webkit')
      .map(({ browser, device }) => ({ name: browser, use: { ...device } }));
  }
  // The autoPan projects run one after the other, before everything else.
  const autopan: Project[] = [];
  const add = (project: Project): void => {
    const previous = autopan[autopan.length - 1];
    autopan.push({
      testMatch: AUTOPAN_FILE,
      fullyParallel: false,
      ...project,
      dependencies: previous?.name ? [previous.name] : [],
    });
  };
  for (const { browser, device } of browsers) {
    // Firefox cannot run autoPanOnNodeDrag in a 1280x720 window (see above): `firefox-wide` does
    add({
      name: `${browser}-autopan`,
      grep: browser === 'firefox' ? /autoPanOnConnect/ : AUTOPAN_TESTS,
      use: { ...device },
    });
    if (browser === 'firefox') {
      add({
        name: 'firefox-wide',
        grep: FIREFOX_WIDE_TESTS,
        use: { ...device, viewport: { width: 2100, height: 2100 } },
      });
    }
  }
  const last = autopan[autopan.length - 1]?.name;
  return [
    ...autopan,
    ...browsers.map(({ browser, device }) => ({
      name: browser,
      dependencies: last ? [last] : [],
      grepInvert: AUTOPAN_TESTS,
      use: { ...device },
    })),
  ];
}

export default defineConfig({
  testDir: '.',
  // `pnpm e2e` = conformance + lit; `pnpm e2e:collab` (XY_COLLAB=1) = collab only. Narrow further
  // with a path argument, e.g. `pnpm e2e -- conformance/nodes.spec.ts`.
  testMatch: collab ? 'collab/**/*.spec.ts' : ['conformance/**/*.spec.ts', 'lit/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: examplesUrl, trace: 'retain-on-failure' },
  projects: projects(),
  webServer: [
    {
      // Ports come from EXAMPLES_PORT / COLLAB_PORT in the environment (config/ports.ts).
      command: 'pnpm --filter @xy-lit/examples dev',
      url: rootCheckUrl(ports.examples),
      reuseExistingServer,
      env: { XY_TEST_SERVER: '1' },
      stdout: 'ignore',
      stderr: 'pipe',
    },
    ...(collab
      ? [
          {
            command: 'pnpm --filter @xy-lit/collab-server dev',
            url: rootCheckUrl(ports.collab),
            reuseExistingServer,
            env: { DB: ':memory:' },
            stdout: 'ignore' as const,
            stderr: 'pipe' as const,
          },
        ]
      : []),
  ],
});
