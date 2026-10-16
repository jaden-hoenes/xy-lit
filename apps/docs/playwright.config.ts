import { defineConfig, devices } from '@playwright/test';
import { ports, selectedBrowsers } from '../../config/ports.ts';

// Smoke test over every page of the built site (`pnpm --filter @xy-lit/docs test` builds first).
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 90_000,
  use: { baseURL: `http://localhost:${ports.docs}/` },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ].filter((p) => (selectedBrowsers() as string[]).includes(p.name)),
  webServer: {
    command: `pnpm exec vitepress preview --port ${ports.docs}`,
    url: `http://localhost:${ports.docs}/`,
    // serves a build: a server left over from another checkout would test the wrong build, so never reuse one
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
