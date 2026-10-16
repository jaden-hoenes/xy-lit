import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { nodePosition, ready } from './helpers';

const focusedId = (page: Page) =>
  page.evaluate(
    () =>
      (window.flow as unknown as { shadowRoot: ShadowRoot }).shadowRoot.activeElement?.getAttribute(
        'data-id',
      ) ?? null,
  );

const liveText = (page: Page) =>
  page.evaluate(
    () =>
      (window.flow as unknown as { shadowRoot: ShadowRoot }).shadowRoot
        .querySelector('[aria-live]')
        ?.textContent?.trim() ?? '',
  );

test.describe('keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/e2e-keyboard');
    await ready(page);
  });

  test('Tab reaches the nodes in order', async ({ page }) => {
    await page.keyboard.press('Tab');
    expect(await focusedId(page)).toBe('a');
    await page.keyboard.press('Tab');
    expect(await focusedId(page)).toBe('b');
  });

  test('Enter selects, arrows move (Shift x4), Escape deselects, aria-live announces moves', async ({
    page,
  }) => {
    const node = page.locator('.lit-flow__node[data-id="a"]');
    await page.keyboard.press('Tab');
    expect(await focusedId(page)).toBe('a');

    await page.keyboard.press('Enter');
    await expect(node).toHaveClass(/selected/);

    await page.keyboard.press('ArrowRight');
    await expect.poll(() => nodePosition(page, 'a')).toEqual({ x: 105, y: 100 });
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(() => nodePosition(page, 'a')).toEqual({ x: 105, y: 120 });
    // the message names the direction and the position before the move (as upstream)
    await expect
      .poll(() => liveText(page))
      .toBe('Moved selected node down. New position, x: 105, y: 100');

    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => nodePosition(page, 'a')).toEqual({ x: 100, y: 120 });

    await page.keyboard.press('Escape');
    await expect(node).not.toHaveClass(/selected/);
    // the node is blurred on the next frame
    await expect.poll(() => focusedId(page)).toBeNull();
    // unselected nodes do not move with the arrow keys
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowRight');
    expect(await nodePosition(page, 'a')).toEqual({ x: 100, y: 120 });
  });

  test('Space selects too, and Delete deletes the selected node', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await focusedId(page)).toBe('b');
    await page.keyboard.press('Space');
    await expect(page.locator('.lit-flow__node[data-id="b"]')).toHaveClass(/selected/);
    await page.keyboard.press('Delete');
    await expect(page.locator('.lit-flow__node[data-id="b"]')).toHaveCount(0);
    await expect(page.locator('.lit-flow__node')).toHaveCount(1);
  });

  test('the live region and the descriptions exist', async ({ page }) => {
    const info = await page.evaluate(() => {
      const root = (window.flow as unknown as { shadowRoot: ShadowRoot }).shadowRoot;
      return {
        live: root.querySelector('[aria-live]')?.getAttribute('aria-live'),
        describedBy: root.querySelector('.lit-flow__node')?.getAttribute('aria-describedby'),
        description: root.getElementById('lit-flow__node-desc-1')?.textContent?.trim(),
      };
    });
    expect(info.live).toBe('assertive');
    expect(info.describedBy).toBe('lit-flow__node-desc-1');
    expect(info.description).toContain('arrow keys');
  });
});
