import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { libConfig } from '../../config/vite-lib.ts';

/*
 * `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })` is the pattern an
 * application's bundler recognises and bundles the worker for. Vite's own lib build would
 * recognise it first and turn it into an absolute `/assets/worker-*.js` URL or a data URL, which
 * breaks the published package. So the library build hides the whole expression behind a
 * placeholder call and puts the literal pattern back in the emitted chunk.
 */
const SOURCE = "new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })";
const PLACEHOLDER = '__xyKeepWorker()';
const keepWorkerPattern = (): Plugin => ({
  name: 'xy-keep-worker-pattern',
  apply: 'build',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/layout/layout.ts')) return null;
    if (!code.includes(SOURCE)) {
      this.error('layout.ts must contain the literal worker constructor expression');
    }
    return { code: code.replace(SOURCE, PLACEHOLDER), map: null };
  },
  renderChunk(code) {
    return code.includes(PLACEHOLDER)
      ? {
          code: code.replace(
            PLACEHOLDER,
            'new Worker(new URL("./worker.js", import.meta.url), { type: "module" })',
          ),
          map: null,
        }
      : null;
  },
});

const base = libConfig({
  dir: import.meta.dirname,
  entry: {
    index: 'src/index.ts',
    define: 'src/define.ts',
    'layout/worker': 'src/layout/worker.ts',
  },
});

export default defineConfig({ ...base, plugins: [keepWorkerPattern()] });
