import { defineConfig } from 'vite';
import { libConfig } from '../../config/vite-lib.ts';

export default defineConfig(
  libConfig({
    dir: import.meta.dirname,
    entry: {
      index: 'src/index.ts',
      internal: 'src/internal.ts',
    },
  }),
);
