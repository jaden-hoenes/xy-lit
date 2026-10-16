import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type UserConfig } from 'vitepress';

/** VitePress brings its own Vite (5), so the plugin type comes from its config, not from the root Vite. */
type VitePlugin = Extract<NonNullable<NonNullable<UserConfig['vite']>['plugins']>[number], { name: string }>;
import { workspaceAliases } from '../../../config/aliases.ts';
import { ports } from '../../../config/ports.ts';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const docsRoot = fileURLToPath(new URL('../', import.meta.url));

/**
 * Where the other apps run in development. Override to point the links at deployed copies (the
 * GitHub Pages workflow sets `DOCS_EXAMPLES_URL` and `DOCS_STORYBOOK_URL`).
 */
export const urls = {
  examples: process.env.DOCS_EXAMPLES_URL ?? `http://localhost:${ports.examples}`,
  storybook: process.env.DOCS_STORYBOOK_URL ?? `http://localhost:${ports.storybook}`,
};

/** The generated API pages (sidebar text is rendered as HTML, so the angle brackets are escaped): `api/elements/<tag>.md` (written by `scripts/gen-api.mjs`). */
function elementPages(): { text: string; link: string }[] {
  const dir = `${docsRoot}api/elements`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => ({ text: `&lt;${f.slice(0, -3)}&gt;`, link: `/api/elements/${f.slice(0, -3)}` }));
}

/**
 * `@xy-lit/pro` creates its layout worker with `new URL('./worker.js', import.meta.url)`, which
 * names the build output. From source the file is `worker.ts`, so the docs point the expression
 * at it (the library's own build keeps the literal `.js`).
 */
const proWorkerFromSource = (): VitePlugin => ({
  name: 'xy-docs-pro-worker-from-source',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/packages/pro/src/layout/layout.ts')) return null;
    return code.replace("new URL('./worker.js', import.meta.url)", "new URL('./worker.ts', import.meta.url)");
  },
});

export default defineConfig({
  // `DOCS_BASE=/xy-lit/` serves the site from a sub-path (GitHub Pages project site); it must start and end with `/`
  base: process.env.DOCS_BASE ?? '/',
  title: 'XY Lit',
  description:
    'Node-based UIs as web components: a Lit port of React Flow on @xyflow/system, with Yjs collaboration.',
  cleanUrls: true,
  lastUpdated: false,
  appearance: true,
  head: [
    ['meta', { name: 'theme-color', content: '#6366f1' }],
    [
      'link',
      {
        rel: 'icon',
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%236366f1'/%3E%3Ccircle cx='9' cy='10' r='3' fill='white'/%3E%3Ccircle cx='23' cy='22' r='3' fill='white'/%3E%3Cpath d='M9 10 C 18 10, 14 22, 23 22' stroke='white' stroke-width='2' fill='none'/%3E%3C/svg%3E",
      },
    ],
  ],
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  themeConfig: {
    siteTitle: 'XY Lit',
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Examples', link: '/examples/', activeMatch: '/examples/' },
      { text: 'API', link: '/api/', activeMatch: '/api/' },
      { text: 'Storybook', link: urls.storybook },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Start',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Concepts', link: '/guide/concepts' },
            { text: 'Controlled vs uncontrolled', link: '/guide/controlled-vs-uncontrolled' },
            { text: 'Lifecycle', link: '/guide/lifecycle' },
          ],
        },
        {
          text: 'Building a flow',
          items: [
            { text: 'Custom nodes', link: '/guide/custom-nodes' },
            { text: 'Custom edges', link: '/guide/custom-edges' },
            { text: 'Handles and connections', link: '/guide/handles-and-connections' },
            { text: 'Sub-flows', link: '/guide/sub-flows' },
            { text: 'Interaction', link: '/guide/interaction' },
          ],
        },
        {
          text: 'Quality',
          items: [
            { text: 'Theming', link: '/guide/theming' },
            { text: 'Accessibility', link: '/guide/accessibility' },
            { text: 'Performance', link: '/guide/performance' },
            { text: 'Testing', link: '/guide/testing' },
          ],
        },
        {
          text: 'More packages',
          items: [
            { text: 'Collaboration', link: '/guide/collaboration' },
            { text: 'Pro features', link: '/guide/pro-features' },
            { text: 'UI components', link: '/guide/ui-components' },
          ],
        },
        {
          text: 'Using XY Lit',
          items: [
            { text: 'Frameworks', link: '/guide/frameworks' },
            { text: 'Migrating from React Flow', link: '/guide/migrating-from-react-flow' },
          ],
        },
      ],
      '/examples/': [{ text: 'Examples', items: [{ text: 'Gallery', link: '/examples/' }] }],
      '/api/': [
        {
          text: 'Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Functions and classes', link: '/api/functions' },
            { text: 'Types', link: '/api/types' },
          ],
        },
        { text: 'Elements', collapsed: false, items: elementPages() },
      ],
    },
    socialLinks: [],
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    footer: {
      message: 'Released under the MIT license. Ported xyflow code is credited in THIRD_PARTY_NOTICES.md.',
      copyright: 'Copyright © 2026 Jaden Hoenes',
    },
  },
  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
  },
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.startsWith('xy-'),
      },
    },
  },
  vite: {
    plugins: [proWorkerFromSource()],
    define: { __XY_URLS__: JSON.stringify(urls) },
    // workspace packages come from source, so the docs need no prior `pnpm build`
    resolve: {
      alias: [
        ...workspaceAliases,
        // a peer dependency of @xy-lit/collab-yjs that the docs app does not depend on itself
        {
          find: /^y-protocols\/(.*)$/,
          replacement: `${repoRoot}packages/collab-yjs/node_modules/y-protocols/$1`,
        },
      ],
    },
    server: {
      port: ports.docs,
      strictPort: true,
      fs: { allow: [repoRoot] },
    },
    preview: { port: ports.docs, strictPort: true },
    worker: { format: 'es' },
    build: { chunkSizeWarningLimit: 2500 },
  },
});
