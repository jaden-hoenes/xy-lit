import { expect, test } from '@playwright/test';
import { centerOf, drag, inFlow, ready } from './helpers';

test.describe('reconnecting edges', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/e2e-reconnect');
    await ready(page);
  });

  test('anchors appear only when edges-reconnectable is on', async ({ page }) => {
    const anchors = page.locator('.lit-flow__edgeupdater');
    await expect(page.locator('.lit-flow__edge')).toHaveCount(1);
    await expect(anchors).toHaveCount(0);

    await page.getByTestId('reconnectable').check();
    await expect(anchors).toHaveCount(2);
    await expect(page.locator('.lit-flow__edgeupdater-source')).toHaveCount(1);
    await expect(page.locator('.lit-flow__edgeupdater-target')).toHaveCount(1);

    await page.getByTestId('reconnectable').uncheck();
    await expect(anchors).toHaveCount(0);
  });

  test('dragging the target anchor to another handle replaces the edge', async ({ page }) => {
    await page.getByTestId('reconnectable').check();
    const anchor = page.locator('.lit-flow__edgeupdater-target');
    await expect(anchor).toHaveCount(1);
    const to = page.locator('.lit-flow__handle.target[data-nodeid="c"]');
    await drag(page, await centerOf(anchor), await centerOf(to), 12);

    await expect
      .poll(() => inFlow(page, (f) => f.getEdges().map((e) => [e.id, e.source, e.target])))
      .toEqual([['e', 'a', 'c']]);
    await expect(page.locator('.lit-flow__edge')).toHaveCount(1);
    await expect(page.locator('.lit-flow__connectionline')).toHaveCount(0);
    const events = await page.evaluate(() => window.__events);
    expect(events).toEqual(['reconnect-start', 'reconnect', 'reconnect-end']);
    // the edge was not selected by the click that ends the drag
    expect(await inFlow(page, (f) => f.getEdge('e')!.selected ?? false)).toBe(false);
  });

  test('dropping an end on empty space keeps the edge', async ({ page }) => {
    await page.getByTestId('reconnectable').check();
    const anchor = page.locator('.lit-flow__edgeupdater-source');
    const from = await centerOf(anchor);
    await drag(page, from, { x: from.x + 500, y: from.y - 20 }, 10);
    await expect(page.locator('.lit-flow__connectionline')).toHaveCount(0);
    expect(await inFlow(page, (f) => f.getEdges().map((e) => [e.source, e.target]))).toEqual([
      ['a', 'b'],
    ]);
    await expect(page.locator('g[data-id="e"] .lit-flow__edge-path')).toHaveCount(1);
    const events = await page.evaluate(() => window.__events);
    expect(events).toEqual(['reconnect-start', 'reconnect-end']);
  });
});
