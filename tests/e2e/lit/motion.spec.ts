import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ready } from './helpers';

declare global {
  interface Window {
    __entered?: { nodes: string[]; edges: string[] };
  }
}

const entered = (page: Page) => page.evaluate(() => window.__entered ?? { nodes: [], edges: [] });
const stillEntering = (page: Page) =>
  page.evaluate(
    () =>
      (window.flow as unknown as { shadowRoot: ShadowRoot }).shadowRoot.querySelectorAll(
        'xy-node.entering, g.lit-flow__edge.entering',
      ).length,
  );

test.describe('motion', () => {
  test('motion="enter": nodes and edges enter once, then the classes are removed', async ({
    page,
  }) => {
    await page.goto('/examples/e2e-motion');
    await ready(page);
    await expect.poll(async () => (await entered(page)).nodes.sort()).toEqual(['a', 'b', 'c']);
    await expect.poll(async () => (await entered(page)).edges.sort()).toEqual(['a-b', 'b-c']);
    // the animation (300ms + stagger) ends and every entering class is gone
    await expect.poll(() => stillEntering(page), { timeout: 5000 }).toBe(0);
    const dash = await page.evaluate(() =>
      [
        ...(
          window.flow as unknown as { shadowRoot: ShadowRoot }
        ).shadowRoot.querySelectorAll<SVGPathElement>('.lit-flow__edge-path'),
      ].map((p) => p.style.strokeDasharray + p.style.strokeDashoffset),
    );
    expect(dash).toEqual(['', '']);
    // nothing is left invisible
    await expect(page.locator('.lit-flow__node[data-id="a"]')).toBeVisible();
  });

  test('prefers-reduced-motion disables entrance motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/examples/e2e-motion');
    await ready(page);
    await page.waitForTimeout(600);
    expect(await entered(page)).toEqual({ nodes: [], edges: [] });
    await expect(page.locator('.lit-flow__node[data-id="c"]')).toBeVisible();
  });

  test('a node added later does not animate in plain "enter" mode', async ({ page }) => {
    await page.goto('/examples/e2e-motion');
    await ready(page);
    await expect.poll(() => stillEntering(page), { timeout: 5000 }).toBe(0);
    await page.evaluate(() =>
      (window.flow as unknown as { addNodes(n: unknown): void }).addNodes({
        id: 'late',
        position: { x: 100, y: 300 },
        data: { label: 'late' },
      }),
    );
    await expect(page.locator('.lit-flow__node[data-id="late"]')).toBeVisible();
    await page.waitForTimeout(300);
    expect((await entered(page)).nodes).not.toContain('late');
  });
});
