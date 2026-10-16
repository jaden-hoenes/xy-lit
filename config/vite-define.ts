import type { Plugin } from 'vite';
import { workspaceEntries } from './aliases.ts';

// The packages declare only `dist/define.js` as a side-effect file; the workspace aliases point at
// the sources, so a production build (Storybook, the examples app) would tree-shake the `define.js`
// entry points away and no element would be registered. Mark them as having side effects.
const defineFiles = Object.entries(workspaceEntries)
  .filter(([name]) => name.endsWith('/define.js'))
  .map(([, file]) => file);

export const keepDefineSideEffects: Plugin = {
  name: 'xy-lit:keep-define-side-effects',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    // the alias plugin runs first, so `source` is already the absolute source path
    if (!defineFiles.some((file) => source.endsWith(file))) return null;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    return resolved ? { ...resolved, moduleSideEffects: true } : null;
  },
};
