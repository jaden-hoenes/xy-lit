import { expect, test } from '@playwright/test';
import { centerOf, inFlow, ready } from './helpers';

// spec/06 §Pointer capture: releasing the mouse outside the flow host must not leave a connection stuck.
test('a connection released outside the flow ends and removes the connection line', async ({
  page,
}) => {
  await page.goto('/examples/e2e-connection-outside');
  await ready(page);
  const source = page.locator('.lit-flow__handle.source[data-nodeid="a"]');
  const start = await centerOf(source);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y + 40, { steps: 5 });
  await expect(page.locator('.lit-flow__connectionline')).toHaveCount(1);

  // leave the flow host (it has a 200px margin around it) and release on the page
  const host = await page.locator('xy-flow').boundingBox();
  expect(host).not.toBeNull();
  await page.mouse.move(host!.x - 120, host!.y - 120, { steps: 10 });
  await expect(page.locator('.lit-flow__connectionline')).toHaveCount(1);
  await page.mouse.up();

  await expect(page.locator('.lit-flow__connectionline')).toHaveCount(0);
  const events = await page.evaluate(() => window.__events);
  expect(events).toEqual(['connect-start', 'connect-end']);
  expect(await inFlow(page, (flow) => flow.getEdges().length)).toBe(0);
  // the flow is usable afterwards: a normal connection still works
  const target = page.locator('.lit-flow__handle.target[data-nodeid="b"]');
  const from = await centerOf(source);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const to = await centerOf(target);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.lit-flow__edge')).toHaveCount(1);
});
