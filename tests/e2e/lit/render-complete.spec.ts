import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { inFlow, ready } from './helpers';

type Detail = { revision: number; nodeCount: number; edgeCount: number; durationMs: number };
const events = (page: Page) => page.evaluate(() => window.__renderComplete as unknown as Detail[]);

test.describe('render-complete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/e2e-render-complete');
    await ready(page);
  });

  test('fires once for the first revision, with the counts', async ({ page }) => {
    // let any stray second event show up
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
    const list = await events(page);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ nodeCount: 3, edgeCount: 3 });
    expect(list[0]!.durationMs).toBeGreaterThan(0);
  });

  test('fires again once per structure revision, not for data changes', async ({ page }) => {
    const first = (await events(page))[0]!;
    await inFlow(page, (f) => {
      (f as never as { updateNodeData(id: string, d: unknown): void }).updateNodeData('a', {
        label: 'changed',
      });
    });
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(await events(page)).toHaveLength(1);

    await inFlow(page, (f) => {
      (f as never as { addNodes(n: unknown): void }).addNodes({
        id: 'd',
        position: { x: 500, y: 300 },
        data: { label: 'D' },
      });
    });
    await expect.poll(async () => (await events(page)).length).toBe(2);
    const second = (await events(page))[1]!;
    expect(second.revision).toBeGreaterThan(first.revision);
    expect(second.nodeCount).toBe(4);
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(await events(page)).toHaveLength(2);
  });

  test('the loading overlay is hidden afterwards', async ({ page }) => {
    await expect(page.locator('.lit-flow__loading')).toBeHidden();
    await expect(page.locator('.lit-flow__node').first()).toHaveCSS('visibility', 'visible');
  });

  test('the viewport is final when it fires (fit-view applied)', async ({ page }) => {
    const transform = await inFlow(page, (f) => {
      const store = (f as never as { store: { getState(): { transform: number[] } } }).store;
      return store.getState().transform;
    });
    // nodes start at (60, 60): a fitted viewport is no longer the identity
    expect(transform).not.toEqual([0, 0, 1]);
  });

  test('a screenshot taken after whenRendered() is deterministic', async ({ page }) => {
    const shoot = async () => {
      await ready(page);
      return page.locator('xy-flow').screenshot({ animations: 'disabled' });
    };
    const first = await shoot();
    await page.reload();
    const second = await shoot();
    expect(second.equals(first)).toBe(true);
  });
});
