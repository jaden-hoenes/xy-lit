import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

function* files(dir: string, suffix = '.ts'): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path, suffix);
    else if (entry.name.endsWith(suffix) && !entry.name.endsWith('.d.ts')) yield path;
  }
}

/**
 * The routes of apps/examples (see its `src/router.ts`), one concrete URL path each: examples,
 * generic-test fixtures, and the pages (a parametrised page contributes the URLs of its exported
 * `links`).
 */
export function exampleRoutes(src: string): string[] {
  const routes: string[] = [];
  const rel = (dir: string, file: string): string => file.slice(dir.length + 1).replace(/\.ts$/, '');
  const examples = join(src, 'examples');
  for (const f of files(examples)) routes.push(`/examples/${rel(examples, f)}`);
  const generic = join(src, 'generic-tests');
  for (const dir of readdirSync(generic, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === 'components') continue;
    for (const f of files(join(generic, dir.name))) routes.push(`/tests/generic/${dir.name}/${rel(join(generic, dir.name), f)}`);
  }
  const pages = join(src, 'pages');
  for (const f of readdirSync(pages).filter((n) => n.endsWith('.ts'))) {
    const pattern = '/' + f.replace(/\.ts$/, '').split('.').map((s) => s.replace(/^\[(.+)\]$/, ':$1')).join('/');
    const links = /export const links = \[([^\]]*)\]/.exec(readFileSync(join(pages, f), 'utf8'));
    if (links) routes.push(...[...links[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!));
    else if (!pattern.includes(':')) routes.push(pattern);
  }
  return routes;
}

/**
 * Static hosts without a single-page-app fallback (GitHub Pages) answer 404 for a route that has
 * no file. After the build, every route of the app gets a copy of `index.html` in its own
 * directory, so a direct visit or reload of `<base>/examples/basic` works. The copies are plain
 * build output; `vite dev` and `vite preview` do not need them.
 */
export function spaRouteCopies(src: string): Plugin {
  let outDir = '';
  return {
    name: 'xy-spa-route-copies',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    closeBundle() {
      const index = join(outDir, 'index.html');
      for (const route of exampleRoutes(src)) {
        const dir = join(outDir, route);
        mkdirSync(dir, { recursive: true });
        copyFileSync(index, join(dir, 'index.html'));
      }
    },
  };
}
