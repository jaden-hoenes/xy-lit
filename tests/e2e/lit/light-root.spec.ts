import { expect, test } from '@playwright/test';
import { centerOf, drag, inFlow, nodePosition, ready } from './helpers';

test.describe('render-root="light"', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/e2e-light-root');
    await ready(page);
  });

  test('renders without a shadow root, in the document', async ({ page }) => {
    expect(await page.evaluate(() => (window.flow as unknown as Element).shadowRoot)).toBeNull();
    // plain document queries find the nodes
    expect(await page.evaluate(() => document.querySelectorAll('.lit-flow__node').length)).toBe(2);
  });

  test('a global utility class styles node content (Tailwind-like)', async ({ page }) => {
    const card = page.locator('[data-testid="card"]').first();
    await expect(card).toHaveCSS('background-color', 'rgb(244, 63, 94)');
    await expect(card).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(card).toHaveCSS('border-radius', '12px');
  });

  test('dragging a node moves it', async ({ page }) => {
    const before = await nodePosition(page, 'a');
    const node = page.locator('.lit-flow__node[data-id="a"]');
    const at = await centerOf(node);
    await drag(page, at, { x: at.x + 100, y: at.y + 60 });
    const after = await nodePosition(page, 'a');
    expect(after.x).toBeGreaterThan(before.x + 50);
    expect(after.y).toBeGreaterThan(before.y + 30);
  });

  test('connecting two handles adds an edge', async ({ page }) => {
    const source = page.locator('.lit-flow__handle.source[data-nodeid="a"]');
    const target = page.locator('.lit-flow__handle.target[data-nodeid="b"]');
    await drag(page, await centerOf(source), await centerOf(target));
    await expect(page.locator('.lit-flow__edge')).toHaveCount(1);
    expect(await inFlow(page, (flow) => flow.getEdges().map((e) => [e.source, e.target]))).toEqual([
      ['a', 'b'],
    ]);
  });

  test('plugins are projected into the flow and work', async ({ page }) => {
    const wrapper = page.locator('.lit-flow');
    await expect(wrapper.locator('xy-controls')).toHaveCount(1);
    const z = await inFlow(page, (flow) => flow.getZoom());
    await page.locator('xy-controls .lit-flow__controls-zoomout').click();
    await expect.poll(() => inFlow(page, (flow) => flow.getZoom())).toBeLessThan(z);
    await expect(wrapper.locator('xy-minimap .lit-flow__minimap-node')).toHaveCount(2);
    await expect(wrapper.locator('xy-background svg')).toHaveCount(1);
  });
});
