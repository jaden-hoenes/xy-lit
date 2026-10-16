import { defineConfig, devices } from '@playwright/test';
import { ports, selectedBrowsers } from '../../config/ports.ts';

const url = `http://localhost:${ports.storybook}/`;

// Smoke test over the *built* Storybook (`pnpm build` first): visits every story from index.json.
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 45_000,
  use: { baseURL: url, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ].filter((p) => (selectedBrowsers() as string[]).includes(p.name)),
  webServer: {
    command: 'tsx scripts/serve.ts',
    url,
    // serves a build: a server left over from another checkout would test the wrong build, so never reuse one
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
