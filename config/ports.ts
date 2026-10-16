/**
 * Single source of truth for dev-server ports. Every Vite/Playwright/Storybook/VitePress/Hocuspocus
 * config imports this file; nothing else may hard-code a port. Two checkouts that run servers at the
 * same time (for example a second git worktree) use different ports through the environment
 * (`EXAMPLES_PORT`, `DOCS_PORT`, `STORYBOOK_PORT`, `COLLAB_PORT`) together with `XY_ISOLATED_PORTS=1`.
 */
const fromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const parsed = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const ports = {
  examples: fromEnv('EXAMPLES_PORT', 5174),
  docs: fromEnv('DOCS_PORT', 5176),
  storybook: fromEnv('STORYBOOK_PORT', 6006),
  collab: fromEnv('COLLAB_PORT', 1234),
} as const;

/** `XY_ISOLATED_PORTS=1` → Playwright never reuses a server another checkout started. */
export const isolatedPorts = process.env.XY_ISOLATED_PORTS === '1';

/**
 * Playwright `webServer.reuseExistingServer` value. A reused server is always verified: the
 * readiness URLs are `/__xy-root.json?root=<this checkout>` (config/root-check.ts), which a server of
 * another checkout answers with 409, so it is never reused.
 */
export const reuseExistingServer = !process.env.CI && !isolatedPorts;

/** Hocuspocus WebSocket URL baked into the apps as `import.meta.env.VITE_COLLAB_URL`. */
export const collabUrl = process.env.VITE_COLLAB_URL ?? `ws://localhost:${ports.collab}`;

export type BrowserName = 'chromium' | 'firefox' | 'webkit';

/**
 * Browsers to run in Vitest browser mode and Playwright. Defaults to all three; set
 * `XY_BROWSERS=chromium,firefox` on hosts where WebKit's system libraries are unavailable (for
 * example distributions Playwright does not support). Never set it in CI.
 */
export function selectedBrowsers(): BrowserName[] {
  const all: BrowserName[] = ['chromium', 'firefox', 'webkit'];
  const raw = process.env.XY_BROWSERS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!raw?.length) return all;
  const picked = all.filter((b) => raw.includes(b));
  if (picked.length === 0) throw new Error(`XY_BROWSERS has no valid browser: ${raw.join(',')}`);
  return picked;
}
