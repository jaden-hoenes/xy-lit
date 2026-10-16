#!/usr/bin/env node
// Builds the documentation site, Storybook and the examples app for static hosting under one URL
// prefix (GitHub Pages: https://jaden-hoenes.github.io/xy-lit/) and assembles them in one directory:
//
//   <out>/            VitePress docs
//   <out>/storybook/  Storybook
//   <out>/examples-app/  examples app (no collaboration server: the collab demo says so); not
//                        /examples/, which is the gallery page of the docs
//
// Environment (all optional):
//   PAGES_BASE    URL path prefix, starts and ends with "/" (default /xy-lit/)
//   PAGES_ORIGIN  scheme and host the docs links to for Storybook and examples
//                 (default https://jaden-hoenes.github.io)
//   PAGES_OUT     output directory (default .pages, git-ignored)
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const base = process.env.PAGES_BASE ?? '/xy-lit/';
const origin = (process.env.PAGES_ORIGIN ?? 'https://jaden-hoenes.github.io').replace(/\/$/, '');
const out = resolve(root, process.env.PAGES_OUT ?? '.pages');
if (!base.startsWith('/') || !base.endsWith('/')) throw new Error(`PAGES_BASE must start and end with "/": ${base}`);

const pnpm = (args, env = {}) =>
  execFileSync('pnpm', args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. docs, linking to the other two apps by their deployed URLs
pnpm(['--filter', '@xy-lit/docs', 'build'], {
  DOCS_BASE: base,
  DOCS_EXAMPLES_URL: `${origin}${base}examples-app/`,
  DOCS_STORYBOOK_URL: `${origin}${base}storybook/`,
});
cpSync(resolve(root, 'apps/docs/.vitepress/dist'), out, { recursive: true });

// 2. Storybook (a static build uses relative asset paths, so it needs no base)
pnpm(['--filter', '@xy-lit/storybook', 'build']);
cpSync(resolve(root, 'apps/storybook/dist'), resolve(out, 'storybook'), { recursive: true });

// 3. examples; an empty VITE_COLLAB_URL means "no collaboration server": no connection attempt
pnpm(['--filter', '@xy-lit/examples', 'build'], { EXAMPLES_BASE: `${base}examples-app/`, VITE_COLLAB_URL: '' });
cpSync(resolve(root, 'apps/examples/dist'), resolve(out, 'examples-app'), { recursive: true });

writeFileSync(resolve(out, '.nojekyll'), '');
console.log(`assembled ${out} for ${origin}${base}`);
