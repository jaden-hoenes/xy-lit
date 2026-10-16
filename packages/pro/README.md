# @xy-lit/pro

Editing features for XY Lit flows that compose on one `<xy-flow>`: undo/redo (`LocalHistory`), clipboard, helper
lines (alignment guides), animated node positions, auto layout (dagre, ELK, tree, force; runs in a worker),
expand/collapse and grouping.

## Install

```sh
pnpm add @xy-lit/pro @xy-lit/flow
# only the layout algorithms you use (optional peer dependencies)
pnpm add @dagrejs/dagre        # algorithm: 'dagre'
pnpm add elkjs                 # algorithm: 'elk'
pnpm add d3-hierarchy          # algorithm: 'tree'
pnpm add d3-force              # algorithm: 'force'
```

## Usage

```ts
import '@xy-lit/flow/define.js';
import '@xy-lit/pro/define.js'; // registers <xy-helper-lines>
import { LocalHistory, installClipboard, installHelperLines, applyLayout } from '@xy-lit/pro';

const flow = document.querySelector('xy-flow')!;
const history = new LocalHistory(flow);        // Mod+Z / Mod+Shift+Z / Mod+Y work
const stopClipboard = installClipboard(flow);  // Mod+C / X / V / D
const stopLines = installHelperLines(flow);

await applyLayout(flow, { algorithm: 'dagre', direction: 'LR', animate: 300, fitView: true });
```

Every function takes the `<xy-flow>` element or a `FlowInstance`; the `install*` functions return a disposer.
With a Yjs source (`@xy-lit/collab-yjs`) the source's own undo manager wins and `LocalHistory` stays inert.

Applications built with Vite need `worker: { format: 'es' }` for the layout worker (it falls back to the main thread
when the worker cannot start).

Documentation: [Pro features guide](https://jaden-hoenes.github.io/xy-lit/guide/pro-features). Source and issues: <https://github.com/jaden-hoenes/xy-lit>.
MIT licensed; ported xyflow code is credited in `THIRD_PARTY_NOTICES.md`.
