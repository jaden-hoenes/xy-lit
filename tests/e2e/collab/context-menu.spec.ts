import { expect, test } from '@playwright/test';
import { addNodeWithTitle, close, expectConverged, openPeer, seeded, uniqueRoom } from './helpers';

test('the context menu adds a node that the other client sees', async ({ browser }, info) => {
  const room = uniqueRoom('menu');
  const a = await openPeer(browser, info, room, 'Ada');
  await seeded(a);
  const b = await openPeer(browser, info, room, 'Grace');
  await seeded(b);

  // an empty spot on the canvas
  await a.page.mouse.click(120, 620, { button: 'right' });
  await expect(a.page.getByTestId('context-menu')).toBeVisible();
  await a.page.getByTestId('menu-add-idea').click();
  await expect(a.page.getByTestId('context-menu')).toHaveCount(0);
  await expect(a.page.locator('xy-node input:focus')).toHaveCount(1);
  await a.page.keyboard.type('Pricing');
  await a.page.keyboard.press('Enter');

  await expect(a.page.locator('.lit-flow__node')).toHaveCount(7);
  await expect(b.page.locator('.lit-flow__node')).toHaveCount(7, { timeout: 10_000 });
  await expect(b.page.locator('xy-node input[aria-label^="Idea"]').last()).toHaveValue('Pricing');
  await expectConverged(a, b);

  // the node menu deletes it again
  const node = a.page
    .locator('xy-node', { has: a.page.locator('input[aria-label^="Idea"]:not([value]), input') })
    .last();
  await node.click({ button: 'right', position: { x: 100, y: 25 } });
  await a.page.getByTestId('menu-delete').click();
  await expect(b.page.locator('.lit-flow__node')).toHaveCount(6, { timeout: 10_000 });
  await close(a, b);
});

test('a read-only client sees changes but cannot make them', async ({ browser }, info) => {
  const room = uniqueRoom('ro');
  const a = await openPeer(browser, info, room, 'Ada');
  await seeded(a);
  const viewer = await openPeer(browser, info, room, 'Viewer', '&ro=1');
  await seeded(viewer);
  await expect(viewer.page.getByText('View only').first()).toBeVisible();
  await expect(viewer.page.getByTestId('add-idea')).toHaveCount(0);
  await addNodeWithTitle(a.page, 'idea', 'For the viewer');
  await expect(viewer.page.locator('.lit-flow__node')).toHaveCount(7, { timeout: 10_000 });
  await close(a, viewer);
});
