// Pre-step for `dev` and `build`: generate a Custom Elements Manifest per package into
// `.manifests/<package>/` (git-ignored) so Storybook's autodocs can read attribute tables.
// It runs each package's own `manifest` script (the analyzer writes next to the package.json),
// copies the result and removes it again when it did not exist before: the docs app owns the
// packages' own `custom-elements.json`. A package whose analysis fails is skipped: the stories
// work without a manifest.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const packages = ['flow', 'ui', 'collab-yjs'];

for (const name of packages) {
  const file = `${here}../../packages/${name}/custom-elements.json`;
  const existed = existsSync(file);
  const result = spawnSync('pnpm', ['--filter', `@xy-lit/${name}`, 'manifest'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (result.status === 0 && existsSync(file)) {
    mkdirSync(`${here}.manifests/${name}`, { recursive: true });
    copyFileSync(file, `${here}.manifests/${name}/custom-elements.json`);
  } else {
    console.warn(`storybook: no manifest for @xy-lit/${name} (continuing)`);
  }
  if (!existed) rmSync(file, { force: true });
}
