import { expect, test } from '@playwright/test';
import { ready } from './helpers';

const evil = '<img src=x onerror=window.__pwned=1>';

test('markup in node and edge labels is rendered as text', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await page.goto('/examples/e2e-xss');
  await ready(page);
  // an injected <img> would have fired its error handler by now
  await page.waitForTimeout(300);

  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(dialogs).toEqual([]);

  await expect(page.locator('.lit-flow__node[data-id="a"]')).toContainText(evil);
  const labels = page.locator('.lit-flow__edgelabel-renderer');
  await expect(labels).toContainText(evil);
  await expect(labels).toContainText(`start ${evil}`);
  await expect(labels).toContainText(`end ${evil}`);

  // no element was created from the data
  const created = await page.evaluate(() => {
    const root = (window.flow as unknown as HTMLElement).shadowRoot!;
    return root.querySelectorAll('img, script, iframe').length;
  });
  expect(created).toBe(0);
});
