import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Identifies the checkout a test server belongs to, so Playwright never reuses a server that
 * another checkout or worktree left running on the same port (see `XY_ISOLATED_PORTS` in config/ports.ts). Every server a
 * Playwright config may reuse answers `GET /__xy-root.json?root=<path>` with 200 when `<path>` is its own
 * checkout, 409 when it is another one. Playwright only reuses a server whose URL answers 2xx, so
 * a foreign server is never reused (and starting a second one then fails loudly on the busy port).
 */
export const repoRoot = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
export const rootCheckPath = '/__xy-root.json';

/** URL for Playwright's `webServer.url`. */
export const rootCheckUrl = (port: number): string =>
  `http://localhost:${port}${rootCheckPath}?root=${encodeURIComponent(repoRoot)}`;

/** The response of a server in this checkout to a request for `url`, or `undefined` if `url` is not the root check. */
export function answerRootCheck(
  url: string | undefined,
): { status: number; body: string } | undefined {
  const parsed = new URL(url ?? '/', 'http://localhost');
  if (parsed.pathname !== rootCheckPath) return undefined;
  const asked = parsed.searchParams.get('root');
  const match = asked === null || asked === repoRoot;
  return { status: match ? 200 : 409, body: JSON.stringify({ root: repoRoot }) };
}
