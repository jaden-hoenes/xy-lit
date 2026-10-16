import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { centerOf, drag, inFlow, ready } from './helpers';

// Port of the Svelte Flow `subflows` example (apps/examples/src/examples/e2e-subflows.ts).
test.describe('sub flows', () => {
  // Firefox does not deliver mouse events outside the window, so the whole graph must fit
  test.use({ viewport: { width: 1600, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/e2e-subflows');
    await ready(page);
    await expect(page.locator('.lit-flow__node[data-id="5a"]')).toHaveCSS('visibility', 'visible');
  });

  const node = (page: Page, id: string) => page.locator(`.lit-flow__node[data-id="${id}"]`);
  const state = (page: Page, id: string) =>
    page.evaluate((nodeId) => {
      const flow = window.flow as unknown as {
        getNode(id: string): {
          position: { x: number; y: number };
          measured?: { width?: number; height?: number };
          width?: number;
          height?: number;
        };
        getInternalNode(id: string): { internals: { positionAbsolute: { x: number; y: number } } };
      };
      const n = flow.getNode(nodeId);
      return {
        position: n.position,
        absolute: flow.getInternalNode(nodeId).internals.positionAbsolute,
        width: n.width ?? n.measured?.width,
        height: n.height ?? n.measured?.height,
      };
    }, id);
  const zoom = (page: Page) => inFlow(page, (f) => f.getZoom());

  test('a child with extent "parent" cannot leave its parent', async ({ page }) => {
    const parent = await state(page, '5');
    const parentBox = (await node(page, '5').boundingBox())!;
    const child = node(page, '5a');
    const from = await centerOf(child);

    // beyond the parent's top left corner: stops at its corner
    await drag(page, from, { x: parentBox.x - 40, y: parentBox.y - 40 });
    await expect.poll(async () => (await state(page, '5a')).position).toEqual({ x: 0, y: 0 });

    // beyond the parent's bottom right corner: stops where the child touches it
    const at = await centerOf(child);
    await drag(page, at, {
      x: parentBox.x + parentBox.width + 40,
      y: parentBox.y + parentBox.height + 40,
    });
    await expect.poll(async () => (await state(page, '5a')).position.x).toBeGreaterThan(100);
    const settled = await state(page, '5a');
    expect(settled.position.x + settled.width!).toBeLessThanOrEqual(parent.width! + 0.5);
    expect(settled.position.y + settled.height!).toBeLessThanOrEqual(parent.height! + 0.5);
    expect(settled.position.x + settled.width!).toBeGreaterThan(parent.width! - 5);
  });

  test('a child with a numeric extent is clamped to it', async ({ page }) => {
    // 4a's extent is [[0, 0], [100, 100]] in its parent: the vertical range is [0, 100 - height]
    const child = node(page, '4a');
    const from = await centerOf(child);
    const z = await zoom(page);
    await drag(page, from, { x: from.x, y: from.y - 80 * z });
    await expect.poll(async () => (await state(page, '4a')).position.y).toBe(0);
    const at = await centerOf(child);
    await drag(page, at, { x: at.x, y: at.y + 300 * z });
    const low = await state(page, '4a');
    await expect.poll(async () => (await state(page, '4a')).position.y).toBeGreaterThan(40);
    expect(low.position.y + low.height!).toBeLessThanOrEqual(100.5);
  });

  test('dragging a parent moves its children with it', async ({ page }) => {
    const before = {
      parent: await state(page, '4'),
      child: await state(page, '4a'),
      grandchild: await state(page, '4b1'),
    };
    const parent = node(page, '4');
    const box = (await parent.boundingBox())!;
    // grab the parent where no child covers it (its bottom right area)
    const grab = { x: box.x + box.width - 20, y: box.y + box.height - 20 };
    const z = await zoom(page);
    await drag(page, grab, { x: grab.x + 60 * z, y: grab.y + 40 * z });
    await expect
      .poll(async () => (await state(page, '4')).position.x)
      .toBeGreaterThan(before.parent.position.x + 40);

    const after = {
      parent: await state(page, '4'),
      child: await state(page, '4a'),
      grandchild: await state(page, '4b1'),
    };
    const dx = after.parent.position.x - before.parent.position.x;
    const dy = after.parent.position.y - before.parent.position.y;
    // relative positions did not change, absolute positions moved by the same amount
    expect(after.child.position).toEqual(before.child.position);
    expect(after.grandchild.position).toEqual(before.grandchild.position);
    expect(after.child.absolute.x - before.child.absolute.x).toBeCloseTo(dx, 5);
    expect(after.child.absolute.y - before.child.absolute.y).toBeCloseTo(dy, 5);
    expect(after.grandchild.absolute.x - before.grandchild.absolute.x).toBeCloseTo(dx, 5);
    expect(after.grandchild.absolute.y - before.grandchild.absolute.y).toBeCloseTo(dy, 5);
  });

  test('expandParent grows the parent when the child is dragged out of it', async ({ page }) => {
    const before = await state(page, '5');
    const child = node(page, '5b');
    const from = await centerOf(child);
    const z = await zoom(page);
    await drag(page, from, { x: from.x + 120 * z, y: from.y + 80 * z });
    await expect
      .poll(async () => (await state(page, '5')).width!)
      .toBeGreaterThan(before.width! + 50);
    const after = await state(page, '5');
    expect(after.height!).toBeGreaterThan(before.height!);
    // the parent grew to the right and down, so it did not move
    expect(after.position).toEqual(before.position);
    const grown = await state(page, '5b');
    expect(grown.position.x + grown.width!).toBeLessThanOrEqual(after.width! + 0.5);
  });

  test('edges between nodes of different levels render above their parents', async ({ page }) => {
    const z = await page.evaluate(() => {
      const root = (window.flow as unknown as HTMLElement).shadowRoot!;
      const svg = (id: string) =>
        getComputedStyle(root.querySelector(`g[data-id="${id}"]`)!.closest('svg')!).zIndex;
      return { plain: svg('e1-2'), child: svg('e3-4b'), nested: svg('e4a-4b1') };
    });
    expect(z.plain).toBe('0');
    expect(Number(z.child)).toBeGreaterThanOrEqual(100);
    expect(Number(z.nested)).toBeGreaterThanOrEqual(1);
  });
});
