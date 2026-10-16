import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { centerOf, inFlow, ready } from './helpers';

const scrollTop = (page: Page) =>
  page.evaluate(
    () =>
      (window.flow as unknown as { shadowRoot: ShadowRoot }).shadowRoot.querySelector('.scroller')!
        .scrollTop,
  );
const zoom = (page: Page) => inFlow(page, (flow) => flow.getZoom());

test.describe('wheel over scrollable node content', () => {
  test('scrolls the content and leaves the viewport alone until the end', async ({ page }) => {
    await page.goto('/examples/e2e-wheel');
    await ready(page);
    const at = await centerOf(page.locator('.scroller'));
    const z = await zoom(page);
    await page.mouse.move(at.x, at.y);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);
    expect(await zoom(page)).toBe(z);

    // 50px above the bottom: this wheel still scrolls the content, the next one (at the limit) zooms
    await page.evaluate(() => {
      const el = (window.flow as unknown as { shadowRoot: ShadowRoot }).shadowRoot.querySelector(
        '.scroller',
      )!;
      el.scrollTop = el.scrollHeight - el.clientHeight - 50;
    });
    await page.mouse.wheel(0, 30);
    await expect.poll(async () => (await scrollTop(page)) > 0).toBe(true);
    expect(await zoom(page)).toBe(z);
    await page.evaluate(() => {
      const el = (window.flow as unknown as { shadowRoot: ShadowRoot }).shadowRoot.querySelector(
        '.scroller',
      )!;
      el.scrollTop = el.scrollHeight;
    });
    await page.mouse.wheel(0, 200);
    await expect.poll(() => zoom(page)).not.toBe(z);
  });

  test('wheel over a node without scrollable content zooms', async ({ page }) => {
    await page.goto('/examples/e2e-wheel');
    await ready(page);
    const at = await centerOf(page.locator('.lit-flow__node[data-id="b"]'));
    const z = await zoom(page);
    await page.mouse.move(at.x, at.y);
    await page.mouse.wheel(0, -200);
    await expect.poll(() => zoom(page)).not.toBe(z);
  });

  test('wheel-scroll-detection="off" zooms the canvas instead', async ({ page }) => {
    await page.goto('/examples/e2e-wheel?off');
    await ready(page);
    const at = await centerOf(page.locator('.scroller'));
    const z = await zoom(page);
    await page.mouse.move(at.x, at.y);
    await page.mouse.wheel(0, -200);
    await expect.poll(() => zoom(page)).not.toBe(z);
    expect(await scrollTop(page)).toBe(0);
  });

  test('ctrl+wheel over the content still zooms', async ({ page }) => {
    await page.goto('/examples/e2e-wheel');
    await ready(page);
    const at = await centerOf(page.locator('.scroller'));
    const z = await zoom(page);
    await page.mouse.move(at.x, at.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -200);
    await page.keyboard.up('Control');
    await expect.poll(() => zoom(page)).not.toBe(z);
  });
});
