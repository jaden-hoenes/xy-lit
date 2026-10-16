import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin, ServerOptions } from 'vite';
import { answerRootCheck } from './root-check.ts';

/**
 * `XY_TEST_SERVER=1` is set by the Playwright configs for the dev servers they start. Such a server
 * is not for editing: it must not reload a page because a file changed under it (a concurrent
 * `pnpm build` rewrites generated sources; a Vite full reload mid-test fails every test of the
 * file), and it must be fully warmed (dependencies pre-bundled, every module transformed once)
 * before the first browser connects, so Vite's dependency optimizer cannot discover a new
 * dependency and reload the page during a test.
 */
export const testServer = process.env.XY_TEST_SERVER === '1';

/** `server` options shared by the app dev servers (the caller adds the port). */
export const testServerOptions: Pick<ServerOptions, 'watch'> = testServer ? { watch: null } : {};

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) yield path;
  }
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Serves `/__xy-root.json` (see root-check.ts). Under `XY_TEST_SERVER=1` the endpoint answers 503 until
 * the server is warm: the dependency scan is done, every `.ts` module under `warm` (absolute
 * directories) has been transformed once and the optimizer has nothing left to discover. That is
 * what Playwright's `webServer.url` waits for.
 */
export function xyTestServer(options: { warm: string[] }): Plugin {
  let ready = !testServer;
  return {
    name: 'xy-test-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const answer = answerRootCheck(req.url);
        if (!answer) return next();
        const status = answer.status === 200 && !ready ? 503 : answer.status;
        res.writeHead(status, { 'content-type': 'application/json' }).end(answer.body);
      });
      if (!testServer) return;
      server.httpServer?.once('listening', () => {
        void (async () => {
          const client = server.environments.client;
          await client.depsOptimizer?.scanProcessing;
          const root = server.config.root;
          const files = options.warm.flatMap((dir) => [...sourceFiles(dir)]);
          await Promise.allSettled(
            files.map((file) =>
              client.warmupRequest('/' + file.slice(root.length + 1).replace(/\\/g, '/')),
            ),
          );
          // a dependency found while transforming is bundled in a second pass: wait until none is left
          for (let i = 0; i < 100; i++) {
            await client.waitForRequestsIdle();
            await delay(300);
            const pending = Object.keys(client.depsOptimizer?.metadata.discovered ?? {});
            if (pending.length === 0) break;
          }
          ready = true;
        })();
      });
    },
  };
}
