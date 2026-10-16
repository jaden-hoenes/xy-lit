import { expect, test } from '@playwright/test';
import { inFlow, ready } from './helpers';

test('content size changes are measured without ever setting node.width or node.height', async ({
  page,
}) => {
  await page.goto('/examples/e2e-measurement');
  await ready(page);

  const read = () =>
    inFlow(page, (flow) => {
      const node = flow.getNode('g')!;
      return {
        width: node.width,
        height: node.height,
        measured: node.measured,
        keys: Object.keys(node).sort(),
      };
    });

  const small = await read();
  expect(small.measured).toEqual({ width: 100, height: 40 });
  expect(small.width).toBeUndefined();
  expect(small.height).toBeUndefined();

  await page.evaluate(() => window.toggleSize!());
  await expect.poll(async () => (await read()).measured).toEqual({ width: 220, height: 120 });
  const big = await read();
  expect(big.width).toBeUndefined();
  expect(big.height).toBeUndefined();
  expect(big.keys).not.toContain('width');
  expect(big.keys).not.toContain('height');

  // and back
  await page.evaluate(() => window.toggleSize!());
  await expect.poll(async () => (await read()).measured).toEqual({ width: 100, height: 40 });
  // the node element itself never got an inline size either
  const inline = await page
    .locator('.lit-flow__node[data-id="g"]')
    .evaluate((el) => [(el as HTMLElement).style.width, (el as HTMLElement).style.height]);
  expect(inline).toEqual(['', '']);
});
