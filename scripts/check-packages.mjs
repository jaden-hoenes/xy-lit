#!/usr/bin/env node
// Publishing dry run. For every publishable package under packages/*:
//   1. `pnpm pack` into a temp directory (runs `prepack`, rewrites `workspace:*`),
//   2. every file named by `exports`, `main`, `module`, `types`, `customElements` exists in the tarball,
//   3. nothing but dist, the manifest, the notice, LICENSE, README.md and package.json is shipped,
//   4. a consumer project that imports every entry point type-checks against the tarballs,
//   5. the entry points that do not need a DOM import in Node.
// Run after `pnpm build`.
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pkgDirs = readdirSync(join(root, 'packages')).filter((d) =>
  existsSync(join(root, 'packages', d, 'package.json')),
);
const only = process.argv.slice(2);
const tmp = mkdtempSync(join(tmpdir(), 'xy-lit-pack-'));
const failures = [];
const fail = (pkg, msg) => failures.push(`${pkg}: ${msg}`);

/** Every relative file path an `exports` value (string or conditions object) points to. */
function targets(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) targets(v, out);
  return out;
}

const packed = [];
for (const dir of pkgDirs) {
  const pkgPath = join(root, 'packages', dir);
  const pkg = JSON.parse(readFileSync(join(pkgPath, 'package.json'), 'utf8'));
  if (pkg.private || (only.length && !only.includes(dir))) continue;
  const out = join(tmp, 'tarballs');
  mkdirSync(out, { recursive: true });
  execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: pkgPath, stdio: 'pipe' });
  const tgz = join(out, `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`);
  const extract = join(tmp, 'extract', dir);
  mkdirSync(extract, { recursive: true });
  execFileSync('tar', ['-xzf', tgz, '-C', extract]);
  const base = join(extract, 'package');
  const shipped = packedPkg(base);

  // 2. every declared file exists in the tarball
  for (const t of targets(shipped.exports)) {
    if (!t.startsWith('./')) fail(pkg.name, `exports target ${t} is not relative`);
    else if (!existsSync(join(base, t)))
      fail(pkg.name, `exports target ${t} is missing from the tarball`);
  }
  // `customElements` follows the manifest convention: a plain relative path
  for (const t of [shipped.main, shipped.module, shipped.types, shipped.customElements].filter(
    Boolean,
  )) {
    if (!existsSync(join(base, t))) fail(pkg.name, `${t} is missing from the tarball`);
  }
  for (const [subpath, value] of Object.entries(shipped.exports ?? {})) {
    if (typeof value === 'object' && !value.types)
      fail(pkg.name, `export ${subpath} has no "types" condition`);
  }
  // 3. nothing unexpected
  const files = execFileSync('tar', ['-tzf', tgz], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((f) => f.replace(/^package\//, ''));
  for (const f of files) {
    if (
      !/^(dist\/|package\.json$|THIRD_PARTY_NOTICES\.md$|custom-elements\.json$|README\.md$|LICENSE$|CHANGELOG\.md$)/.test(
        f,
      )
    )
      fail(pkg.name, `unexpected file in tarball: ${f}`);
    if (/\.(test|spec)\./.test(f) || f.endsWith('.d.ts.map'))
      fail(pkg.name, `file should not ship: ${f}`);
  }
  // the layout worker is loaded with `new URL('./worker.js', import.meta.url)` and must sit next to layout.js
  if (dir === 'pro' && !files.includes('dist/layout/worker.js'))
    fail(pkg.name, 'dist/layout/worker.js is missing');
  // the layout worker is loaded with `new URL('./worker.js', import.meta.url)` next to layout.js
  if (dir === 'pro' && !files.includes('dist/layout/worker.js'))
    fail(pkg.name, 'dist/layout/worker.js is missing');
  for (const required of ['THIRD_PARTY_NOTICES.md', 'LICENSE', 'README.md'])
    if (!files.includes(required)) fail(pkg.name, `${required} is missing from the tarball`);
  if (
    shipped.dependencies &&
    Object.values(shipped.dependencies).some((v) => String(v).startsWith('workspace:'))
  )
    fail(pkg.name, 'workspace: protocol left in dependencies');
  packed.push({ dir, name: pkg.name, base, pkg: shipped, size: files.length });
  console.log(`packed ${pkg.name}: ${files.length} files`);
}

function packedPkg(base) {
  return JSON.parse(readFileSync(join(base, 'package.json'), 'utf8'));
}

// 4. consumer project: node_modules/@xy-lit/<pkg> = the extracted tarball; third-party dependencies
// are linked from the workspace install, so no network is needed.
const consumer = join(tmp, 'consumer');
mkdirSync(join(consumer, 'node_modules', '@xy-lit'), { recursive: true });
const link = (target, path) => {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) symlinkSync(target, path, 'dir');
};
for (const p of packed) {
  // a copy, not a link: Node resolves dependencies from the real path of the importing file
  cpSync(p.base, join(consumer, 'node_modules', p.name), { recursive: true });
  const pkgSrc = join(root, 'packages', p.dir, 'node_modules');
  for (const dep of [
    ...Object.keys(p.pkg.dependencies ?? {}),
    ...Object.keys(p.pkg.peerDependencies ?? {}),
  ]) {
    if (dep.startsWith('@xy-lit/')) continue;
    const from = join(pkgSrc, dep);
    if (existsSync(from)) link(realpathSync(from), join(consumer, 'node_modules', dep));
  }
}
const imports = [];
for (const p of packed) {
  for (const sub of Object.keys(p.pkg.exports ?? {})) {
    if (!sub.startsWith('.') || sub.endsWith('.json')) continue;
    imports.push(`${p.name}${sub === '.' ? '' : sub.slice(1)}`);
  }
}
writeFileSync(
  join(consumer, 'check.ts'),
  imports.map((spec, i) => `import * as m${i} from '${spec}';\nvoid m${i};`).join('\n') +
    `\n${packed.some((p) => p.name === '@xy-lit/flow') ? "import { XyFlowElement, defineNodeType } from '@xy-lit/flow';\nconst t: typeof XyFlowElement = XyFlowElement;\nvoid t; void defineNodeType;\n" : ''}`,
);
writeFileSync(
  join(consumer, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2023', 'DOM', 'DOM.Iterable'],
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
    },
    files: ['check.ts'],
  }),
);
try {
  execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', consumer], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  console.log(`types resolve: ${imports.length} entry points`);
} catch (e) {
  fail('consumer', `type-check of the entry points failed:\n${e.stdout || e.message}`);
}

// 5. Node-safe entry points actually load
const nodeSafe = ['@xy-lit/store', '@xy-lit/collab-yjs/server'].filter((s) => imports.includes(s));
for (const spec of nodeSafe) {
  try {
    execFileSync('node', ['--input-type=module', '-e', `await import(${JSON.stringify(spec)})`], {
      cwd: consumer,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    console.log(`imports in Node: ${spec}`);
  } catch (e) {
    fail(spec, `import failed in Node:\n${e.stderr || e.message}`);
  }
}

rmSync(tmp, { recursive: true, force: true });
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('all packages are publishable');
