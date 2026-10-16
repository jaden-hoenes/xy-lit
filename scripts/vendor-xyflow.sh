#!/usr/bin/env bash
# Checks out xyflow at the pinned commit into .vendor/xyflow (gitignored, read-only reference)
# and copies the assets XY Lit reuses into the workspace:
#   - system CSS            -> packages/flow/src/styles/vendor/
#   - Playwright e2e specs  -> tests/e2e/conformance/   (patched later, see spec/13-testing.md)
#   - generic-test fixtures -> apps/examples/src/generic-tests/ (Svelte originals kept as *.svelte.txt)
# Then re-applies XY Lit's changes to the copies:
#   - scripts/patches/conformance.patch  the allowed spec patches (tests/e2e/conformance/PATCHES.md)
#   - scripts/patches/fixtures.patch     the fixture imports ported from Svelte to XY Lit
#   - the vendored CSS is run through Prettier (the committed copy is formatted)
# Files that exist only in XY Lit (generic-tests/components/*.ts, types.d.ts, PATCHES.md) are never
# touched. Idempotent: every run starts from the pristine upstream copy and re-applies the patches,
# so running it twice leaves `git status` unchanged. Set XYFLOW_REMOTE to clone from a mirror.
set -euo pipefail

COMMIT=3d35b57
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/.vendor/xyflow"

if [ ! -d "$VENDOR/.git" ]; then
  mkdir -p "$ROOT/.vendor"
  git clone --filter=blob:none "${XYFLOW_REMOTE:-https://github.com/xyflow/xyflow.git}" "$VENDOR"
fi
git -C "$VENDOR" fetch --quiet origin
git -C "$VENDOR" -c advice.detachedHead=false checkout --quiet "$COMMIT"
echo "xyflow checked out at $(git -C "$VENDOR" rev-parse --short HEAD)"

# 1. CSS (MIT). Prefix rewrite happens in packages/flow/scripts/gen-styles.mjs.
CSS_DST="$ROOT/packages/flow/src/styles/vendor"
mkdir -p "$CSS_DST"
for f in init.css base.css style.css node-resizer.css; do
  cp "$VENDOR/packages/system/src/styles/$f" "$CSS_DST/$f"
done
cp "$VENDOR/LICENSE" "$CSS_DST/LICENSE.xyflow"
(cd "$ROOT" && pnpm exec prettier --write --log-level warn --ignore-path /dev/null \
  "$CSS_DST/init.css" "$CSS_DST/base.css" "$CSS_DST/style.css" "$CSS_DST/node-resizer.css")

# 2. Playwright conformance specs (MIT).
E2E_DST="$ROOT/tests/e2e/conformance"
mkdir -p "$E2E_DST"
cp "$VENDOR"/tests/playwright/e2e/*.ts "$E2E_DST/"
cp "$VENDOR/LICENSE" "$E2E_DST/LICENSE.xyflow"

# 3. Generic-test fixtures: configs are plain data; component files are kept for reference only.
FIX_SRC="$VENDOR/examples/svelte/src/generic-tests"
FIX_DST="$ROOT/apps/examples/src/generic-tests"
mkdir -p "$FIX_DST"
(cd "$FIX_SRC" && find . -type f) | while read -r rel; do
  mkdir -p "$FIX_DST/$(dirname "$rel")"
  case "$rel" in
    *.svelte) cp "$FIX_SRC/$rel" "$FIX_DST/${rel}.txt" ;;
    *) cp "$FIX_SRC/$rel" "$FIX_DST/$rel" ;;
  esac
done

# 4. XY Lit changes on top of the pristine copies. `git apply` fails loudly when upstream moved.
for patch in conformance fixtures; do
  git -C "$ROOT" apply --whitespace=nowarn "$ROOT/scripts/patches/$patch.patch"
  echo "applied scripts/patches/$patch.patch"
done

echo "Vendored CSS, e2e specs and fixtures, patches re-applied (see tests/e2e/conformance/PATCHES.md)."
