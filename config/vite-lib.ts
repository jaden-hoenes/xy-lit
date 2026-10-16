import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { UserConfig } from 'vite';

interface LibOptions {
  /** Absolute package directory (pass `import.meta.dirname`). */
  dir: string;
  /** Public entry points: output name → source path relative to the package. */
  entry: Record<string, string>;
}

/**
 * Shared Vite library-mode config (spec/01 §Packages): ESM only, every dependency and peer
 * dependency external, one output file per source module so tree shaking works. Declarations are
 * emitted separately by `tsc -p tsconfig.build.json`.
 */
export function libConfig({ dir, entry }: LibOptions): UserConfig {
  const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  const names = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ];
  const external = [
    /^node:/,
    ...names.map((n) => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(/|$)`)),
  ];
  return {
    build: {
      target: 'es2022',
      sourcemap: true,
      minify: false,
      emptyOutDir: true,
      outDir: 'dist',
      lib: {
        entry: Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, resolve(dir, v)])),
        formats: ['es'],
      },
      rolldownOptions: {
        external,
        output: {
          preserveModules: true,
          preserveModulesRoot: 'src',
          entryFileNames: '[name].js',
        },
      },
    },
  };
}
