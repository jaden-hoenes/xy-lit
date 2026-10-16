import { defineConfig, devices } from '@playwright/test';
import { ports, reuseExistingServer } from '../../config/ports.ts';
import { rootCheckUrl } from '../../config/root-check.ts';

const examplesUrl = `http://localhost:${ports.examples}/`;

// Chromium only, one worker (spec/01 §Tests → Perf, spec/13 §Performance).
export default defineConfig({
  testDir: '.',
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: examplesUrl },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @xy-lit/examples dev',
    url: rootCheckUrl(ports.examples),
    reuseExistingServer,
    env: { XY_TEST_SERVER: '1' },
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
