#!/usr/bin/env node
// Type-checks the React 19, Angular and Svelte snippets of guide/frameworks.md (the Vue snippet is a
// live demo in the docs test suite). The snippets import the real `@xy-lit/flow` (resolved from
// source through tsconfig.paths.json), so a renamed export or a changed signature breaks this check.
//
// What is and is not verified:
// - React: `.tsx` is compiled by TypeScript against the real `@types/react` (found in the pnpm
//   store: it is a transitive dependency of Storybook, not of this app), with a minimal ambient
//   stub when the store does not have it. JSX props and the `declare module 'react'` augmentation
//   are checked.
// - Angular: neither `@angular/core` nor its template compiler is installed, so the component class,
//   imports and the `@Component` options are type-checked against a minimal ambient `@angular/core`.
//   The template string is NOT compiled.
// - Svelte: the `svelte` compiler is not installed; the `<script lang="ts">` block is type-checked
//   with the `$state` rune declared ambiently. The markup is NOT compiled.
// Usage: node apps/docs/scripts/check-snippets.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../../..');
const docsDir = resolve(import.meta.dirname, '..');
const markdown = readFileSync(join(docsDir, 'guide/frameworks.md'), 'utf8');
const work = join(docsDir, '.vitepress/cache/snippets');

/** The fenced blocks of a `## <heading>` section: `{ lang, code }[]`. */
function blocks(heading) {
  const start = markdown.indexOf(`\n## ${heading}\n`);
  if (start < 0) throw new Error(`guide/frameworks.md has no "## ${heading}" section`);
  const rest = markdown.slice(start + 1);
  const next = rest.slice(3).search(/\n## /);
  const section = next < 0 ? rest : rest.slice(0, next + 3);
  return [...section.matchAll(/^```(\w+)\n([\s\S]*?)^```$/gm)].map((m) => ({
    lang: m[1],
    code: m[2],
  }));
}

function only(heading, lang) {
  const found = blocks(heading).filter((b) => b.lang === lang);
  if (found.length === 0) throw new Error(`"## ${heading}" has no \`\`\`${lang} block`);
  return found;
}

const files = new Map(); // relative path -> text

// React 19
only('React 19', 'tsx').forEach((b, i) => files.set(`react-${i}.tsx`, b.code));

// Angular (the `ts` blocks are one module each; the second block of the guide is the component)
only('Angular', 'ts').forEach((b, i) => files.set(`angular-${i}.ts`, b.code));
files.set(
  'angular-ambient.d.ts',
  `declare module '@angular/core' {
  export function Component(meta: {
    selector: string;
    standalone?: boolean;
    schemas?: readonly unknown[];
    template?: string;
    imports?: readonly unknown[];
  }): ClassDecorator;
  export const CUSTOM_ELEMENTS_SCHEMA: unknown;
}
`,
);

// Svelte: the instance script, wrapped as a module
only('Svelte', 'svelte').forEach((b, i) => {
  const script = /<script lang="ts">([\s\S]*?)<\/script>/.exec(b.code);
  if (!script) throw new Error('the Svelte snippet has no <script lang="ts"> block');
  files.set(`svelte-${i}.ts`, script[1]);
});
files.set(
  'svelte-ambient.d.ts',
  `declare const $state: { <T>(initial: T): T; raw<T>(initial: T): T };
`,
);

// React types: the real ones when the pnpm store has them, otherwise a minimal stand-in
const pnpmStore = join(root, 'node_modules/.pnpm');
const reactTypes = existsSync(pnpmStore)
  ? readdirSync(pnpmStore).find((d) => d.startsWith('@types+react@'))
  : undefined;
const reactDir = reactTypes && join(pnpmStore, reactTypes, 'node_modules/@types/react');
if (!reactDir) {
  console.warn('check-snippets: @types/react not in the pnpm store, using a minimal stub');
  files.set(
    'react-ambient.d.ts',
    `declare module 'react' {
  export interface RefObject<T> { current: T | null }
  export function useRef<T>(initial: T | null): RefObject<T>;
  export function useState<S>(initial: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export interface HTMLAttributes<T> { style?: Record<string, string | number>; className?: string; ref?: RefObject<T> }
  export type DetailedHTMLProps<A extends HTMLAttributes<T>, T> = A & { ref?: RefObject<T> };
  export namespace JSX {
    interface IntrinsicElements {}
    interface Element {}
  }
}
declare module 'react/jsx-runtime' {
  import type * as React from 'react';
  export namespace JSX {
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
    interface Element extends React.JSX.Element {}
  }
  export function jsx(type: unknown, props: unknown, key?: string): React.JSX.Element;
  export function jsxs(type: unknown, props: unknown, key?: string): React.JSX.Element;
}
`,
  );
}

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
for (const [name, text] of files) writeFileSync(join(work, name), text);

const pathsConfig = ts.readConfigFile(join(root, 'tsconfig.paths.json'), ts.sys.readFile);
const baseConfig = ts.readConfigFile(join(root, 'tsconfig.base.json'), ts.sys.readFile);
const paths = { ...pathsConfig.config.compilerOptions.paths };
if (reactDir) {
  paths.react = [join(reactDir, 'index.d.ts')];
  paths['react/jsx-runtime'] = [join(reactDir, 'jsx-runtime.d.ts')];
}
const { options } = ts.convertCompilerOptionsFromJson(
  {
    ...baseConfig.config.compilerOptions,
    ...pathsConfig.config.compilerOptions,
    paths,
    noEmit: true,
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    jsx: 'react-jsx',
    experimentalDecorators: true,
    types: [],
  },
  root,
);
options.pathsBasePath = root;
// Lit's own sources need the rest of the repository's type environment (vite/client is not needed)

const program = ts.createProgram({
  rootNames: [...files.keys()].map((f) => join(work, f)),
  options,
});
const diagnostics = ts
  .getPreEmitDiagnostics(program)
  // only report problems in the snippet files, not in the library sources they import
  .filter((d) => d.file && d.file.fileName.startsWith(work));

if (diagnostics.length > 0) {
  console.error(
    ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => work,
      getNewLine: () => '\n',
    }),
  );
  console.error(`check-snippets: ${diagnostics.length} problem(s) in guide/frameworks.md`);
  process.exit(1);
}
console.log(
  `check-snippets: React 19 (${reactDir ? '@types/react' : 'stub'}), Angular and Svelte snippets type-check (${[...files.keys()].filter((f) => !f.includes('ambient')).length} files)`,
);
