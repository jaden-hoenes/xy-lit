import { expect, test } from '@playwright/test';
import { centerOf, drag, inFlow, nodePosition, ready } from './helpers';

test.describe('uncontrolled flow (the flow owns its state)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/e2e-uncontrolled');
    await ready(page);
  });

  test('connecting two handles adds an edge', async ({ page }) => {
    const source = page.locator('.lit-flow__handle.source[data-nodeid="a"]');
    const target = page.locator('.lit-flow__handle.target[data-nodeid="b"]');
    await expect(page.locator('.lit-flow__edge')).toHaveCount(0);
    await drag(page, await centerOf(source), await centerOf(target));
    await expect(page.locator('.lit-flow__edge')).toHaveCount(1);
    expect(await inFlow(page, (flow) => flow.getEdges().map((e) => [e.source, e.target]))).toEqual([
      ['a', 'b'],
    ]);
    await expect(page.locator('.lit-flow__connectionline')).toHaveCount(0);
  });

  test('the delete key removes the selected node and its edges', async ({ page }) => {
    const source = page.locator('.lit-flow__handle.source[data-nodeid="a"]');
    const target = page.locator('.lit-flow__handle.target[data-nodeid="b"]');
    await drag(page, await centerOf(source), await centerOf(target));
    await expect(page.locator('.lit-flow__edge')).toHaveCount(1);

    await page.locator('.lit-flow__node[data-id="b"]').click();
    await expect(page.locator('.lit-flow__node[data-id="b"]')).toHaveClass(/selected/);
    await page.keyboard.press('Delete');
    await expect(page.locator('.lit-flow__node[data-id="b"]')).toHaveCount(0);
    await expect(page.locator('.lit-flow__edge')).toHaveCount(0);
    await expect(page.locator('.lit-flow__node')).toHaveCount(2);
  });

  test('the delete key removes a selected edge', async ({ page }) => {
    await drag(
      page,
      await centerOf(page.locator('.lit-flow__handle.source[data-nodeid="a"]')),
      await centerOf(page.locator('.lit-flow__handle.target[data-nodeid="c"]')),
    );
    const edge = page.locator('.lit-flow__edge').first();
    await expect(edge).toHaveCount(1);
    await edge.locator('.lit-flow__edge-interaction').click();
    await expect(edge).toHaveClass(/selected/);
    await page.keyboard.press('Delete');
    await expect(page.locator('.lit-flow__edge')).toHaveCount(0);
    await expect(page.locator('.lit-flow__node')).toHaveCount(3);
  });

  test('a dragged node stays where it was dropped', async ({ page }) => {
    const node = page.locator('.lit-flow__node[data-id="a"]');
    const before = await nodePosition(page, 'a');
    const from = await centerOf(node);
    await drag(page, from, { x: from.x + 120, y: from.y + 60 });
    await expect.poll(async () => (await nodePosition(page, 'a')).x).toBeGreaterThan(before.x + 90);
    const after = await nodePosition(page, 'a');
    // XYDrag swallows the first pointer step (threshold arming), so the node lags by up to a step
    expect(after.x).toBeLessThanOrEqual(before.x + 120);
    expect(after.y).toBeGreaterThan(before.y + 40);
    expect(after.y).toBeLessThanOrEqual(before.y + 60);

    // later interaction elsewhere does not move it back
    await page.locator('.lit-flow__node[data-id="c"]').click();
    expect(await nodePosition(page, 'a')).toEqual(after);
    await expect(node).toHaveCSS('transform', new RegExp(`${after.x}`));
  });
});
