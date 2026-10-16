// Run by every publishable package's `prepack`: the ported xyflow code is MIT-licensed and its
// notice must travel with the published files, and so must the package's own LICENSE. `files` can
// only list paths inside the package, so both are copied in from the repository root (the copies
// are git-ignored). README.md lives in each package directory and needs no copy.
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

for (const file of ['THIRD_PARTY_NOTICES.md', 'LICENSE']) {
  copyFileSync(resolve(import.meta.dirname, '..', file), resolve(process.cwd(), file));
}
