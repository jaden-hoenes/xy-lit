import { defineConfig } from 'vite';
import { workspaceAliases } from '../../config/aliases.ts';
import { collabUrl, ports } from '../../config/ports.ts';
import { keepDefineSideEffects } from '../../config/vite-define.ts';
import { testServerOptions, xyTestServer } from '../../config/vite-dev.ts';
import { spaRouteCopies } from '../../config/vite-spa.ts';

export default defineConfig({
  appType: 'spa',
  // `EXAMPLES_BASE=/xy-lit/examples/` serves the built app from a sub-path (the GitHub Pages site)
  base: process.env.EXAMPLES_BASE ?? '/',
  plugins: [
    xyTestServer({ warm: [import.meta.dirname + '/src'] }),
    { ...keepDefineSideEffects, apply: 'build' },
    spaRouteCopies(import.meta.dirname + '/src'),
  ],
  resolve: { alias: workspaceAliases },
  define: { 'import.meta.env.VITE_COLLAB_URL': JSON.stringify(collabUrl) },
  // @xy-lit/pro's layout worker is an ES module with dynamic imports (code splitting)
  worker: { format: 'es' },
  server: { port: ports.examples, strictPort: true, ...testServerOptions },
  preview: { port: ports.examples, strictPort: true },
});
