#!/usr/bin/env node
// Lists public symbols without a JSDoc comment. For every package entry point
// (`exports` of package.json mapped to its src file) it walks the exported symbols and, for
// classes and interfaces, their public members. Exit code 1 when anything is missing.
// Usage: node scripts/check-jsdoc.mjs [--members] [package...]
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const withMembers = args.includes('--members');
const only = args.filter((a) => !a.startsWith('--'));

const entries = [];
for (const dir of readdirSync(join(root, 'packages'))) {
  const pkgPath = join(root, 'packages', dir, 'package.json');
  if (!existsSync(pkgPath) || (only.length && !only.includes(dir))) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  for (const [sub, value] of Object.entries(pkg.exports ?? {})) {
    const types = typeof value === 'object' ? value.types : undefined;
    if (!types) continue;
    const src = join(root, 'packages', dir, types.replace('./dist/', 'src/').replace(/\.d\.ts$/, '.ts'));
    if (existsSync(src)) entries.push({ pkg: pkg.name, sub, src, dir });
  }
}

const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  experimentalDecorators: false,
  paths: ts.readConfigFile(join(root, 'tsconfig.paths.json'), ts.sys.readFile).config.compilerOptions.paths,
  baseUrl: root,
};
const program = ts.createProgram(
  entries.map((e) => e.src),
  options,
);
const checker = program.getTypeChecker();
const missing = new Map();

const hasDoc = (symbol) => ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim().length > 0 ||
  symbol.getJsDocTags(checker).length > 0;

function declOf(symbol) {
  let s = symbol;
  if (s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s);
  return s;
}

const seen = new Set();
for (const entry of entries) {
  const sf = program.getSourceFile(entry.src);
  const mod = checker.getSymbolAtLocation(sf);
  if (!mod) continue;
  for (const exp of checker.getExportsOfModule(mod)) {
    const sym = declOf(exp);
    const decl = sym.declarations?.[0];
    if (!decl) continue;
    const file = decl.getSourceFile().fileName;
    if (file.includes('node_modules') || !file.startsWith(root + '/packages/')) continue;
    // only report symbols owned by this package
    if (!file.startsWith(join(root, 'packages', entry.dir) + '/')) continue;
    const key = `${file}#${sym.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rel = file.slice(root.length + 1);
    const add = (name) => {
      const list = missing.get(entry.pkg) ?? [];
      list.push(`${rel}: ${name}`);
      missing.set(entry.pkg, list);
    };
    if (!hasDoc(sym)) add(sym.name);
    if (withMembers && sym.members && (sym.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface))) {
      for (const [name, m] of sym.members) {
        const d = m.declarations?.[0];
        if (!d || ts.isTypeParameterDeclaration(d) || name.startsWith('__') || name === 'constructor') continue;
        const flags = ts.getCombinedModifierFlags(d);
        if (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue;
        if (d.name && ts.isPrivateIdentifier(d.name)) continue;
        if (name.startsWith('_') || name.startsWith('#')) continue;
        if (!hasDoc(m)) add(`${sym.name}.${name}`);
      }
    }
  }
}

let total = 0;
for (const [pkg, list] of missing) {
  console.log(`\n${pkg}: ${list.length} without JSDoc`);
  for (const l of list) console.log(`  ${l}`);
  total += list.length;
}
console.log(total ? `\n${total} public symbol(s) without JSDoc` : 'every public symbol has JSDoc');
process.exit(total ? 1 : 0);
