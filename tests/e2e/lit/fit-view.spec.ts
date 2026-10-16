import { expect, test } from '@playwright/test';
import { ready } from './helpers';

/** The initial `fit-view` includes `type: 'group'` nodes that declare a width and height. */
test('node-resizer: the initial fit shows the group node at the bottom', async ({ page }) => {
  await page.goto('/examples/node-resizer');
  await ready(page);
  const paneBox = await page.locator('xy-flow').boundingBox();
  const groupBox = await page.locator('.lit-flow__node[data-id="group"]').boundingBox();
  expect(paneBox).not.toBeNull();
  expect(groupBox).not.toBeNull();
  // the whole group (the lowest node) is inside the flow's box
  expect(groupBox!.y).toBeGreaterThanOrEqual(paneBox!.y);
  expect(groupBox!.y + groupBox!.height).toBeLessThanOrEqual(paneBox!.y + paneBox!.height + 1);
  expect(groupBox!.x + groupBox!.width).toBeLessThanOrEqual(paneBox!.x + paneBox!.width + 1);
});
