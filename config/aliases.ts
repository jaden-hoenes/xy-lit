import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * Workspace package entry points resolved from source (no build needed in dev, tests, Storybook
 * or docs). More specific entries first. Keep in sync with `tsconfig.paths.json` and with the
 * `exports` maps of the packages.
 */
export const workspaceEntries: Record<string, string> = {
  '@xy-lit/store/internal': 'packages/store/src/internal.ts',
  '@xy-lit/store': 'packages/store/src/index.ts',
  '@xy-lit/flow/define.js': 'packages/flow/src/define.ts',
  '@xy-lit/flow': 'packages/flow/src/index.ts',
  '@xy-lit/collab-yjs/server': 'packages/collab-yjs/src/server.ts',
  '@xy-lit/collab-yjs/define.js': 'packages/collab-yjs/src/define.ts',
  '@xy-lit/collab-yjs': 'packages/collab-yjs/src/index.ts',
  '@xy-lit/pro/define.js': 'packages/pro/src/define.ts',
  '@xy-lit/pro': 'packages/pro/src/index.ts',
  '@xy-lit/ui/define.js': 'packages/ui/src/define.ts',
  '@xy-lit/ui': 'packages/ui/src/index.ts',
};

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Vite `resolve.alias` array form (exact-match regexes so `@xy-lit/flow` never captures `@xy-lit/flow/define.js`). */
export const workspaceAliases = Object.entries(workspaceEntries).map(([name, file]) => ({
  find: new RegExp(`^${escapeRegExp(name)}$`),
  replacement: root + file,
}));
