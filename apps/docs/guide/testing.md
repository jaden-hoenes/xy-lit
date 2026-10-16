# Testing

## Wait for the render, not for a timeout

A flow measures its nodes asynchronously. Await `whenRendered()` before you assert on geometry, the viewport or edges:

```ts
const flow = document.querySelector('xy-flow')!;
flow.nodes = nodes;
flow.edges = edges;
await flow.whenRendered(); // resolves with { revision, nodeCount, edgeCount, durationMs }
expect(flow.getNode('a')!.measured).toBeDefined();
```

It resolves immediately when the current revision is complete, and on the next `render-complete` otherwise. After
adding or removing nodes, await it again. A controlled flow must apply `dimensions` changes or it never completes.

<Demo name="testing" :height="340" caption="The same calls a test makes, on a live flow. The panel shows what they return." />

## Unit tests in a browser

Element tests need a DOM and real layout: use Vitest browser mode, Web Test Runner or Playwright component testing.
Mount a flow with a size, wait for it, drive it with the API:

```ts
import '@xy-lit/flow/define.js';

const flow = document.createElement('xy-flow');
flow.style.cssText = 'display:block;width:600px;height:400px';
document.body.append(flow);
flow.nodes = [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } }];
await flow.whenRendered();

await flow.fitView();
flow.updateNodeData('a', { label: 'B' });
expect(flow.getNodes()[0].data.label).toBe('B');
```

Tips from this repository's own tests:

- Give the flow a size. Without a height it completes after the fit timeout and reports `004`.
- Everything lives in an **open shadow root**: `flow.shadowRoot.querySelector('.lit-flow__node[data-id="a"]')`.
  Playwright's CSS locators pierce open shadow roots, so `page.locator('.lit-flow__node[data-id="a"]')` works.
- Useful selectors: `.lit-flow__node[data-id]`, `.lit-flow__handle.source[data-nodeid="a"]`, `g[data-id="edge-id"]`
  (an edge), `.lit-flow__pane`, `.lit-flow__controls`, `.lit-flow__minimap`.
- **Synthetic events**: a synthetic `PointerEvent` has no live pointer, so `setPointerCapture` throws; the flow wraps it in
  try/catch. The drag engine ignores the first pointer step (threshold arming): a test that drags 100 px lands about 12%
  short, so assert ranges or drag 8/7 of the distance.
- **Listeners**: flush the store with `flow.store.flush()` when you call store methods directly and check results at
  once; notifications otherwise coalesce per microtask.
- Prefer asserting on events and data (`nodes-change`, `flow.getNodes()`) over pixels.

## End-to-end with Playwright

```ts
import { test, expect } from '@playwright/test';

test('connect two nodes', async ({ page }) => {
  await page.goto('/my-flow');
  await page.evaluate(() => (document.querySelector('xy-flow') as any).whenRendered());

  const from = page.locator('.lit-flow__handle.source[data-nodeid="a"]');
  const to = page.locator('.lit-flow__handle.target[data-nodeid="b"]');
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect(page.locator('g[data-id^="xy-edge"]')).toHaveCount(1);
});
```

- Give the browser window room. Playwright-Firefox drops mouse events that leave the window, so keep drag targets
  inside it (or use a bigger `viewport`). Never run a path filter such as `lit` that also matches your repository folder.
- Read results through the instance: `await page.evaluate(() => document.querySelector('xy-flow').toObject())`.
- Expose the flow as `window.flow` on your test pages, as the repository's e2e pages do.

## What this repository tests

| Layer | Tool | Command |
|---|---|---|
| Store, middleware, placement | Vitest (Node) | `pnpm test` |
| Elements and controllers | Vitest browser mode, Chromium and Firefox | `pnpm test` |
| Upstream behaviour | the xyflow Playwright specs, run against XY Lit | `pnpm e2e` |
| Collaboration | fast-check convergence fuzzing, multi-client Playwright | `pnpm fuzz`, `pnpm e2e:collab` |
| Performance | Playwright, frame-time budgets | `pnpm perf` |
| Accessibility | axe-core in Playwright | part of `pnpm e2e` |
| This documentation | Playwright smoke over every page: no console errors, demos reach `render-complete`, no broken links | `pnpm --filter @xy-lit/docs test` |
