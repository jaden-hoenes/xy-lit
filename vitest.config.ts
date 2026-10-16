import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { workspaceAliases } from './config/aliases.ts';
import { selectedBrowsers } from './config/ports.ts';
import { testServerOptions } from './config/vite-dev.ts';

const notBrowser = ['**/node_modules/**', '**/*.browser.test.ts'];

// `pnpm test` runs every project except `collab-fuzz` (`pnpm fuzz` runs that one).
export default defineConfig({
  resolve: { alias: workspaceAliases },
  // `pnpm test` sets XY_TEST_SERVER=1: no file watcher, so a source file rewritten mid-run (for example
  // by a concurrent `pnpm build`) cannot reload the test iframe
  server: { ...testServerOptions },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'store',
          include: ['packages/store/test/**/*.test.ts'],
          exclude: notBrowser,
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'collab',
          include: ['packages/collab-yjs/test/**/*.test.ts'],
          exclude: notBrowser,
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'collab-fuzz',
          include: ['packages/collab-yjs/fuzz/**/*.fuzz.ts'],
          environment: 'node',
          testTimeout: 600_000,
        },
      },
      {
        extends: true,
        // Pre-bundle every dependency of every library source and test up front, whether or not
        // the first test imports it: the layout algorithms of @xy-lit/pro are lazy peer imports and
        // its worker is not followed by the scanner. A dependency found mid-run makes Vite's
        // optimizer reload the test page.
        optimizeDeps: {
          entries: [
            'packages/*/src/**/*.ts',
            'packages/*/test/**/*.browser.test.ts',
            'packages/pro/src/layout/algorithms.ts',
          ],
        },
        test: {
          name: 'browser',
          include: ['packages/{flow,pro,ui,collab-yjs}/test/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: selectedBrowsers().map((browser) => ({ browser })),
          },
        },
      },
    ],
  },
});
