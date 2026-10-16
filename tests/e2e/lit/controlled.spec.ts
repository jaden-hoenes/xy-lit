import { expect, test } from '@playwright/test';
import { centerOf, drag, inFlow, nodePosition, ready } from './helpers';

test.describe('controlled flow: the app applies the changes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/e2e-controlled');
    await ready(page);
  });

  test('dragging moves the node', async ({ page }) => {
    const node = page.locator('.lit-flow__node[data-id="a"]');
    const before = await nodePosition(page, 'a');
    const from = await centerOf(node);
    await drag(page, from, { x: from.x + 100, y: from.y + 50 });
    await expect.poll(async () => (await nodePosition(page, 'a')).x).toBeGreaterThan(before.x + 80);
    expect(Math.round((await nodePosition(page, 'a')).y - before.y)).toBeGreaterThan(30);
    // the app was asked for every change
    expect(await page.evaluate(() => window.__events)).toContain('nodes-change');
  });

  test('selecting and deleting work', async ({ page }) => {
    const node = page.locator('.lit-flow__node[data-id="b"]');
    await node.click();
    await expect(node).toHaveClass(/selected/);
    await page.keyboard.press('Delete');
    await expect(node).toHaveCount(0);
    expect(await inFlow(page, (flow) => flow.getNodes().map((n) => n.id))).toEqual(['a']);
  });

  test('connecting adds an edge through the app', async ({ page }) => {
    await drag(
      page,
      await centerOf(page.locator('.lit-flow__handle.source[data-nodeid="a"]')),
      await centerOf(page.locator('.lit-flow__handle.target[data-nodeid="b"]')),
    );
    await expect(page.locator('.lit-flow__edge')).toHaveCount(1);
  });
});

test.describe('controlled flow: the app ignores every change', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/e2e-controlled-ignore');
    await ready(page);
  });

  test('nothing moves, selects or disappears', async ({ page }) => {
    const node = page.locator('.lit-flow__node[data-id="a"]');
    const before = await nodePosition(page, 'a');
    const from = await centerOf(node);
    await drag(page, from, { x: from.x + 150, y: from.y + 80 });
    await page.waitForTimeout(100);
    expect(await nodePosition(page, 'a')).toEqual(before);
    // the app was asked, though
    const events = await page.evaluate(() => window.__events);
    expect(events).toContain('nodes-change');

    await node.click();
    await expect(node).not.toHaveClass(/selected/);
    await page.keyboard.press('Delete');
    await expect(page.locator('.lit-flow__node')).toHaveCount(2);

    await drag(
      page,
      await centerOf(page.locator('.lit-flow__handle.source[data-nodeid="a"]')),
      await centerOf(page.locator('.lit-flow__handle.target[data-nodeid="b"]')),
    );
    await expect(page.locator('.lit-flow__edge')).toHaveCount(0);
  });
});
