#!/usr/bin/env node
// Generates the API reference (spec/16 §Documentation) into apps/docs/api/:
//   api/index.md            overview with every element and entry point
//   api/elements/<tag>.md   one page per custom element, from the custom-elements.json manifests
//   api/functions.md        functions, classes and constants of every package entry point
//   api/types.md            interfaces, type aliases and enums
// Elements come from a fresh run of the custom-elements analyzer (the same config as `pnpm manifest`). Functions and types come from the TypeScript
// sources through the compiler API, so signatures and JSDoc are exactly what the code says.
// The output is git-ignored; `predev` and `prebuild` run this script.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../../..');
const out = resolve(import.meta.dirname, '../api');
// Empty `api/` and `api/elements/` but keep the directories themselves: a running `vitepress dev`
// stops watching a directory that is deleted and re-created, which made every API page 404 after a
// manual `pnpm gen:api`.
mkdirSync(join(out, 'elements'), { recursive: true });
for (const dir of [join(out, 'elements'), out])
  for (const name of readdirSync(dir))
    if (dir === out ? name !== 'elements' : true) rmSync(join(dir, name), { recursive: true, force: true });

// ---------------------------------------------------------------------------------- markdown utils
/** Escape text for Markdown that VitePress compiles as Vue: no live tags or interpolation outside code. */
function esc(text = '') {
  return text
    .split(/(`[^`]*`)/g)
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\{/g, '&#123;')
            .replace(/\}/g, '&#125;'),
    )
    .join('');
}
const cell = (text = '') => esc(text).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
const code = (text = '') => '`' + String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/`/g, "'") + '`';
const fence = (text, lang = 'ts') => '```' + lang + '\n' + text + '\n```';
const pkgs = [
  { dir: 'store', name: '@xy-lit/store' },
  { dir: 'flow', name: '@xy-lit/flow' },
  { dir: 'collab-yjs', name: '@xy-lit/collab-yjs' },
  { dir: 'pro', name: '@xy-lit/pro' },
  { dir: 'ui', name: '@xy-lit/ui' },
];

// ------------------------------------------------------------------------------------- elements
function manifestOf(dir) {
  // always analyze fresh into a temp dir (also for pro, which has no `manifest` script because
  // nothing of it ships), so the API pages never depend on a stale custom-elements.json
  if (dir === 'store') return null; // no custom elements
  const cem = join(root, 'packages/flow/node_modules/.bin/cem');
  const cwd = join(root, 'packages', dir);
  const tmp = mkdtempSync(join(tmpdir(), 'xy-cem-'));
  try {
    execFileSync(
      cem,
      ['analyze', '--litelement', '--globs', 'src/**/*.ts', '--outdir', relative(cwd, tmp), '--config', join(root, 'config/cem.mjs')],
      { cwd, stdio: 'pipe' },
    );
    return JSON.parse(readFileSync(join(tmp, 'custom-elements.json'), 'utf8'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const elements = [];
for (const pkg of pkgs) {
  const manifest = manifestOf(pkg.dir);
  if (!manifest) continue;
  for (const mod of manifest.modules)
    for (const d of mod.declarations ?? []) if (d.tagName) elements.push({ pkg, decl: d });
}
elements.sort((a, b) => a.decl.tagName.localeCompare(b.decl.tagName));

const typeText = (t) => (t?.text ?? '').replace(/\s+/g, ' ');
const sig = (m) =>
  `${m.name}(${(m.parameters ?? []).map((p) => `${p.name}${p.optional ? '?' : ''}${p.type ? `: ${typeText(p.type)}` : ''}`).join(', ')})${m.return?.type ? `: ${typeText(m.return.type)}` : ''}`;

for (const { pkg, decl } of elements) {
  const tag = decl.tagName;
  const lines = [`---`, `title: <${tag}>`, `aside: false`, `---`, ``, `# \`<${tag}>\``, ``];
  if (decl.description) lines.push(esc(decl.description), '');
  const importLine =
    pkg.dir === 'pro'
      ? `import '@xy-lit/pro/define.js';`
      : `import '${pkg.name}/define.js';`;
  lines.push(
    `**Package** \`${pkg.name}\` · **Class** \`${decl.name}\` · **Register** ${code(importLine)}`,
    '',
  );

  const attrs = decl.attributes ?? [];
  const fieldByName = new Map((decl.members ?? []).filter((m) => m.kind === 'field').map((m) => [m.name, m]));
  if (attrs.length) {
    lines.push('## Attributes', '', '| Attribute | Property | Type | Default | Description |', '|---|---|---|---|---|');
    for (const a of attrs) {
      const field = fieldByName.get(a.fieldName ?? a.name);
      lines.push(
        `| ${code(a.name)} | ${code(a.fieldName ?? a.name)} | ${code(typeText(a.type ?? field?.type))} | ${a.default ? code(a.default) : ''} | ${cell(a.description ?? field?.description)} |`,
      );
    }
    lines.push('');
  }
  const attributeFields = new Set(attrs.map((a) => a.fieldName ?? a.name));
  const props = (decl.members ?? []).filter((m) => m.kind === 'field' && !m.static && !attributeFields.has(m.name));
  if (props.length) {
    lines.push('## Properties', '', 'Properties without an attribute, and read-only state.', '', '| Property | Type | Description |', '|---|---|---|');
    for (const p of props)
      lines.push(`| ${code(p.name)}${p.readonly ? ' (read-only)' : ''} | ${code(typeText(p.type))} | ${cell(p.description)} |`);
    lines.push('');
  }
  const methods = (decl.members ?? []).filter(
    (m) => m.kind === 'method' && !m.static && !['addEventListener', 'removeEventListener'].includes(m.name),
  );
  if (methods.length) {
    lines.push('## Methods', '');
    const seen = new Set();
    for (const m of methods) {
      const key = sig(m);
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`### \`${m.name}()\``, '', fence(key), '');
      if (m.description) lines.push(esc(m.description), '');
      const ps = (m.parameters ?? []).filter((p) => p.description);
      for (const p of ps) lines.push(`- ${code(p.name)}: ${esc(p.description.replace(/\s+/g, ' '))}`);
      if (ps.length) lines.push('');
      if (m.return?.description) lines.push(`Returns: ${esc(m.return.description)}`, '');
    }
  }
  if (decl.events?.length) {
    lines.push('## Events', '', 'Events bubble and are composed, so they reach listeners outside the shadow root.', '', '| Event | Description |', '|---|---|');
    for (const e of decl.events) lines.push(`| ${code(e.name)} | ${cell(e.description)} |`);
    lines.push('');
  }
  if (decl.slots?.length) {
    lines.push('## Slots', '', '| Slot | Description |', '|---|---|');
    for (const s of decl.slots) lines.push(`| ${s.name ? code(s.name) : '(default)'} | ${cell(s.description)} |`);
    lines.push('');
  }
  if (decl.cssParts?.length) {
    lines.push('## CSS parts', '', '| Part | Description |', '|---|---|');
    for (const s of decl.cssParts) lines.push(`| ${code(s.name)} | ${cell(s.description)} |`);
    lines.push('');
  }
  if (decl.cssProperties?.length) {
    lines.push('## CSS custom properties', '', '| Property | Description |', '|---|---|');
    for (const s of decl.cssProperties) lines.push(`| ${code(s.name)} | ${cell(s.description)} |`);
    lines.push('');
  }
  writeFileSync(join(out, 'elements', `${tag}.md`), lines.join('\n'));
}

// ------------------------------------------------------------------------- functions and types
const entries = [];
for (const pkg of pkgs) {
  const pkgJson = JSON.parse(readFileSync(join(root, 'packages', pkg.dir, 'package.json'), 'utf8'));
  for (const [sub, value] of Object.entries(pkgJson.exports ?? {})) {
    const types = typeof value === 'object' ? value.types : undefined;
    if (!types || sub.endsWith('define.js') || sub === './internal') continue;
    const src = join(root, 'packages', pkg.dir, types.replace('./dist/', 'src/').replace(/\.d\.ts$/, '.ts'));
    if (existsSync(src)) entries.push({ pkg, sub, src });
  }
}
const program = ts.createProgram(
  entries.map((e) => e.src),
  {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    paths: ts.readConfigFile(join(root, 'tsconfig.paths.json'), ts.sys.readFile).config.compilerOptions.paths,
    baseUrl: root,
  },
);
const checker = program.getTypeChecker();

const docOf = (symbol) => ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();
const tagsOf = (symbol) => symbol.getJsDocTags(checker).map((t) => ({ name: t.name, text: ts.displayPartsToString(t.text).trim() }));
const stripExport = (t) => t.replace(/^export\s+(declare\s+)?(default\s+)?/, '');
const squeeze = (t, max) => (t.length > max ? t.slice(0, max) + '\n  // …' : t);

/** The declaration without its body, as written in the source. */
function headerOf(decl) {
  const text = decl.getText();
  const body = decl.body ?? (ts.isClassDeclaration(decl) ? null : null);
  if (body && ts.isBlock(body)) return stripExport(text.slice(0, body.getStart() - decl.getStart()).trim());
  return stripExport(text.replace(/;$/, ''));
}

function describe(symbol) {
  const lines = [];
  const doc = docOf(symbol);
  if (doc) lines.push(esc(doc), '');
  const tags = tagsOf(symbol);
  const dep = tags.find((t) => t.name === 'deprecated');
  if (dep) lines.push(`::: warning Deprecated\n${esc(dep.text)}\n:::`, '');
  for (const t of tags.filter((x) => x.name === 'param')) {
    const [name, ...rest] = t.text.split(/\s+/);
    lines.push(`- ${code(name)}${rest.length ? ': ' + esc(rest.join(' ').replace(/^-\s*/, '')) : ''}`);
  }
  if (tags.some((t) => t.name === 'param')) lines.push('');
  const ret = tags.find((t) => t.name === 'returns' || t.name === 'return');
  if (ret) lines.push(`Returns: ${esc(ret.text)}`, '');
  for (const t of tags.filter((x) => x.name === 'example')) lines.push(t.text.startsWith('```') ? t.text : fence(t.text), '');
  return lines;
}

const functionsByPkg = new Map();
const typesByPkg = new Map();
const engineNames = new Map();
const seen = new Set();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

for (const entry of entries) {
  const sf = program.getSourceFile(entry.src);
  const mod = checker.getSymbolAtLocation(sf);
  if (!mod) continue;
  for (const exp of checker.getExportsOfModule(mod)) {
    let sym = exp;
    if (sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
    const decl = sym.declarations?.[0];
    if (!decl) continue;
    const file = decl.getSourceFile().fileName;
    if (file.includes('/node_modules/')) {
      const list = engineNames.get(entry.pkg.name) ?? [];
      list.push(exp.name);
      engineNames.set(entry.pkg.name, list);
      continue;
    }
    const owner = pkgs.find((p) => file.startsWith(join(root, 'packages', p.dir) + '/'));
    if (!owner) continue;
    const key = `${owner.name}#${sym.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = (() => {
      if (sym.flags & ts.SymbolFlags.Class) return 'class';
      if (sym.flags & ts.SymbolFlags.Function) return 'function';
      if (sym.flags & (ts.SymbolFlags.Variable | ts.SymbolFlags.Property)) return 'const';
      if (sym.flags & ts.SymbolFlags.Interface) return 'interface';
      if (sym.flags & ts.SymbolFlags.TypeAlias) return 'type';
      if (sym.flags & ts.SymbolFlags.Enum) return 'enum';
      return 'other';
    })();
    const target = ['function', 'class', 'const'].includes(kind) ? functionsByPkg : typesByPkg;
    const list = target.get(owner.name) ?? [];
    list.push({ sym, decl, kind, name: sym.name, via: entry.sub });
    target.set(owner.name, list);
  }
}

const elementClasses = new Map(elements.map((e) => [e.decl.name, e.decl.tagName]));

function renderFunctions() {
  const lines = [
    '---',
    'title: Functions and classes',
    '---',
    '',
    '# Functions, classes and constants',
    '',
    'Generated from the TypeScript sources of every package entry point. `@xy-lit/flow` re-exports the whole `@xy-lit/store` API, which is listed under the store. Custom elements have their own pages under [Elements](/api/).',
    '',
  ];
  for (const pkg of pkgs) {
    const list = (functionsByPkg.get(pkg.name) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) continue;
    lines.push(`## ${pkg.name}`, '');
    for (const item of list) {
      const { sym, decl, kind, name } = item;
      lines.push(`### ${name} {#${slug(pkg.name)}-${slug(name)}}`, '');
      if (kind === 'class' && elementClasses.has(name)) {
        const tag = elementClasses.get(name);
        lines.push(`The class of [\`<${tag}>\`](/api/elements/${tag}).`, '');
        continue;
      }
      if (kind === 'function') {
        const decls = (sym.declarations ?? []).filter((d) => ts.isFunctionDeclaration(d));
        const shown = decls.filter((d) => d.body || decls.length === 1);
        lines.push(fence(squeeze((shown.length ? shown : decls).map(headerOf).join('\n'), 1800)), '');
        lines.push(...describe(sym));
      } else if (kind === 'const') {
        const type = checker.typeToString(checker.getTypeOfSymbolAtLocation(sym, decl), decl, ts.TypeFormatFlags.NoTruncation);
        lines.push(fence(squeeze(`const ${name}: ${type}`, 900)), '');
        lines.push(...describe(sym));
      } else {
        // class: constructor and public members
        const heritage = decl.heritageClauses?.map((h) => h.getText()).join(' ') ?? '';
        lines.push(fence(`class ${name}${decl.typeParameters ? '<' + decl.typeParameters.map((t) => t.getText()).join(', ') + '>' : ''}${heritage ? ' ' + heritage : ''}`), '');
        lines.push(...describe(sym));
        const members = [];
        for (const m of decl.members) {
          const flags = ts.getCombinedModifierFlags(m);
          if (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue;
          if (m.name && (ts.isPrivateIdentifier(m.name) || m.name.getText().startsWith('_'))) continue;
          const msym = m.name ? checker.getSymbolAtLocation(m.name) : undefined;
          if (ts.isConstructorDeclaration(m) && !m.body) continue;
          const mdoc = msym ? docOf(msym) : '';
          const internal = msym?.getJsDocTags(checker).some((t) => t.name === 'internal');
          if (internal) continue;
          let header = m.getText();
          if ((ts.isMethodDeclaration(m) || ts.isConstructorDeclaration(m) || ts.isGetAccessor(m) || ts.isSetAccessor(m)) && m.body)
            header = header.slice(0, m.body.getStart() - m.getStart()).trim();
          else if (ts.isPropertyDeclaration(m) && m.initializer)
            header = header.slice(0, m.initializer.getStart() - m.getStart()).replace(/\s*=\s*$/, '');
          header = header.replace(/;$/, '');
          members.push({ header: squeeze(header, 400), doc: mdoc });
        }
        if (members.length) {
          lines.push('**Members**', '');
          for (const m of members) lines.push(fence(m.header), m.doc ? esc(m.doc) + '\n' : '');
        }
      }
    }
    const engine = engineNames.get(pkg.name);
    if (engine?.length) {
      lines.push(`### Re-exported from @xyflow/system {#${slug(pkg.name)}-engine}`, '', `\`${pkg.name}\` re-exports these upstream helpers and values so applications need one import. They behave as in the xyflow engine documentation.`, '', engine.sort().map((n) => '`' + n + '`').join(', '), '');
    }
  }
  writeFileSync(join(out, 'functions.md'), lines.join('\n'));
}

function renderTypes() {
  const lines = [
    '---',
    'title: Types',
    '---',
    '',
    '# Types',
    '',
    'Interfaces, type aliases and enums of every package entry point, generated from the TypeScript sources. `@xy-lit/flow` re-exports every `@xy-lit/store` type.',
    '',
  ];
  for (const pkg of pkgs) {
    const list = (typesByPkg.get(pkg.name) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) continue;
    lines.push(`## ${pkg.name}`, '');
    for (const { sym, decl, name, kind } of list) {
      lines.push(`### ${name} {#${slug(pkg.name)}-${slug(name)}}`, '');
      lines.push(...describe(sym));
      let text = stripExport(decl.getText());
      if (kind === 'interface' && decl.members.length > 60) text = squeeze(text, 6000);
      else text = squeeze(text, 4500);
      lines.push(fence(text), '');
    }
  }
  writeFileSync(join(out, 'types.md'), lines.join('\n'));
}

renderFunctions();
renderTypes();

// ----------------------------------------------------------------------------------------- index
const index = [
  '---',
  'title: API reference',
  '---',
  '',
  '# API reference',
  '',
  'Generated from the `custom-elements.json` manifests and the TypeScript sources by `apps/docs/scripts/gen-api.mjs`.',
  '',
  '- [Functions, classes and constants](/api/functions)',
  '- [Types](/api/types)',
  '',
  '## Packages and entry points',
  '',
  '| Package | Entry points |',
  '|---|---|',
  ...pkgs.map((p) => {
    const subs = entries.filter((e) => e.pkg === p).map((e) => '`' + (e.sub === '.' ? p.name : p.name + e.sub.slice(1)) + '`');
    return `| \`${p.name}\` | ${subs.join(', ')} |`;
  }),
  '',
  '## Elements',
  '',
  '| Element | Package | Description |',
  '|---|---|---|',
  ...elements.map(({ pkg, decl }) => {
    const first = (decl.description ?? '').split(/\n\s*\n/)[0];
    return `| [\`<${decl.tagName}>\`](/api/elements/${decl.tagName}) | \`${pkg.name}\` | ${cell(first)} |`;
  }),
  '',
];
writeFileSync(join(out, 'index.md'), index.join('\n'));
console.log(
  `api: ${elements.length} element pages, ${[...functionsByPkg.values()].flat().length} functions/classes/constants, ${[...typesByPkg.values()].flat().length} types`,
);
