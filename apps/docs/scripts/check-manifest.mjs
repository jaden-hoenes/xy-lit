#!/usr/bin/env node
// Verifies that every `custom-elements.json` lists what the element sources declare:
// every reactive property (and its attribute), slot, CSS part, event and CSS custom property that
// the TypeScript source declares or uses must be in the manifest of the owning element.
// Usage: node apps/docs/scripts/check-manifest.mjs   (run `pnpm manifest` first)
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../../..');
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const problems = [];
let checked = 0;

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (p.endsWith('.ts')) yield p;
  }
}

for (const pkg of ['flow', 'collab-yjs', 'ui']) {
  const manifestPath = join(root, 'packages', pkg, 'custom-elements.json');
  if (!existsSync(manifestPath)) {
    problems.push(`${pkg}: no custom-elements.json (run pnpm manifest)`);
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const byClass = new Map();
  for (const mod of manifest.modules)
    for (const d of mod.declarations ?? []) if (d.tagName) byClass.set(d.name, d);

  for (const file of walk(join(root, 'packages', pkg, 'src'))) {
    const text = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
    ts.forEachChild(sf, function visit(node) {
      if (ts.isClassDeclaration(node) && node.name && byClass.has(node.name.text)) {
        const decl = byClass.get(node.name.text);
        const label = `${pkg}/${decl.tagName}`;
        const fields = new Set((decl.members ?? []).map((m) => m.name));
        const attrs = new Set((decl.attributes ?? []).map((a) => a.name));
        // reactive properties
        for (const m of node.members) {
          if (
            !ts.isPropertyDeclaration(m) ||
            !(ts.getCombinedModifierFlags(m) & ts.ModifierFlags.Static) ||
            m.name.getText() !== 'properties' ||
            !m.initializer ||
            !ts.isObjectLiteralExpression(m.initializer)
          )
            continue;
          for (const p of m.initializer.properties) {
            if (!ts.isPropertyAssignment(p)) continue;
            const name = p.name.getText().replace(/['"]/g, '');
            const opts = ts.isObjectLiteralExpression(p.initializer) ? p.initializer.getText() : '';
            if (/state:\s*true/.test(opts)) continue;
            checked++;
            if (!fields.has(name)) problems.push(`${label}: property ${name} missing (or undocumented)`);
            if (!/attribute:\s*false/.test(opts)) {
              const m2 = /attribute:\s*'([^']+)'/.exec(opts);
              const attr = m2 ? m2[1] : name.toLowerCase();
              const expected = m2 ? attr : kebab(name);
              // Lit lower-cases property names for the default attribute name
              if (!attrs.has(expected) && !attrs.has(attr))
                problems.push(`${label}: attribute ${expected} missing`);
            }
          }
        }
        // slots and parts used in the class body
        const body = node.getText();
        for (const m of body.matchAll(/<slot name="([a-z-]+)"/g)) {
          checked++;
          if (!(decl.slots ?? []).some((s) => s.name === m[1]))
            problems.push(`${label}: slot "${m[1]}" missing`);
        }
        for (const m of body.matchAll(/\bpart="([a-z-]+)"/g)) {
          checked++;
          if (!(decl.cssParts ?? []).some((s) => s.name === m[1]))
            problems.push(`${label}: part "${m[1]}" missing`);
        }
        for (const m of body.matchAll(/new CustomEvent(?:<[^>]*>)?\(\s*'([a-z-]+)'/g)) {
          checked++;
          if (!(decl.events ?? []).some((s) => s.name === m[1]))
            problems.push(`${label}: event "${m[1]}" missing`);
        }
      }
      ts.forEachChild(node, visit);
    });
  }
}

// every `xy-flow` event of FlowEventMap must be listed on <xy-flow>
const flowManifest = JSON.parse(
  readFileSync(join(root, 'packages/flow/custom-elements.json'), 'utf8'),
);
const flowDecl = flowManifest.modules
  .flatMap((m) => m.declarations ?? [])
  .find((d) => d.tagName === 'xy-flow');
const events = readFileSync(join(root, 'packages/store/src/types/events.ts'), 'utf8');
const mapBody = events.slice(events.indexOf('export interface FlowEventMap'));
for (const m of mapBody.matchAll(/^ {2}'?([a-z][a-z-]*)'?: /gm)) {
  checked++;
  if (!flowDecl.events.some((e) => e.name === m[1])) problems.push(`flow/xy-flow: event "${m[1]}" missing`);
}
// every --xy-* override variable the stylesheets read must be listed as a CSS custom property
const vendor = readFileSync(join(root, 'packages/flow/src/styles/vendor/style.css'), 'utf8') +
  readFileSync(join(root, 'packages/flow/src/styles/vendor/init.css'), 'utf8') +
  readFileSync(join(root, 'packages/flow/src/styles/vendor/node-resizer.css'), 'utf8');
const props = new Set(
  [...vendor.matchAll(/var\(\s*(--xy-[a-z0-9-]+),/g)]
    .map((m) => m[1])
    .filter((n) => !n.endsWith('-props')), // `-props` variables are set by the plugin elements themselves
);
for (const name of props) {
  checked++;
  if (!flowDecl.cssProperties.some((p) => p.name === name)) {
    // the background pattern variants are documented through --xy-background-pattern-color
    if (/--xy-background-pattern-(dots|lines|cross)-color/.test(name)) continue;
    problems.push(`flow/xy-flow: CSS custom property ${name} missing`);
  }
}

// the migration guide must mention every attribute of <xy-flow>
const migration = readFileSync(join(root, 'apps/docs/guide/migrating-from-react-flow.md'), 'utf8');
for (const a of flowDecl.attributes) {
  checked++;
  if (!migration.includes('`' + a.name + '`') && !migration.includes('`' + a.name + '=')) {
    problems.push(`migrating-from-react-flow.md does not mention the attribute ${a.name}`);
  }
}

if (problems.length) {
  console.error(`${problems.length} manifest problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`custom-elements.json files are complete (${checked} declarations checked)`);
