import { expect, test } from '@playwright/test';
import {
  addNodeWithTitle,
  close,
  docPosition,
  expectConverged,
  nodeBox,
  openPeer,
  seeded,
  uniqueRoom,
} from './helpers';

test("undo only reverts the local user's changes", async ({ browser }, info) => {
  const room = uniqueRoom('undo');
  const a = await openPeer(browser, info, room, 'Ada');
  await seeded(a);
  const b = await openPeer(browser, info, room, 'Grace');
  await seeded(b);

  const id = 'seed-eng';
  const start = (await docPosition(a.page, id))!;

  // Ada drags Engineering
  const box = await nodeBox(a.page, id);
  await a.page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
  await a.page.mouse.down();
  await a.page.mouse.move(box.x + box.width - 30 + 100, box.y + box.height / 2 + 70, { steps: 6 });
  await a.page.mouse.up();
  await expectConverged(a, b);
  const moved = (await docPosition(a.page, id))!;
  expect(moved.x).toBeGreaterThan(start.x + 40);

  // Grace then renames another node, much later than the capture window
  await b.page.waitForTimeout(600);
  const design = b.page.locator('xy-node[data-id="seed-design"]');
  await design.dblclick({ position: { x: 100, y: 25 } });
  await b.page.keyboard.press('Control+A');
  await b.page.keyboard.type('Visual design');
  await b.page.keyboard.press('Enter');
  await expect(a.page.locator('xy-node[data-id="seed-design"] input')).toHaveValue('Visual design');

  // Ada undoes: her drag is reverted for everyone, Grace's rename stays
  await expect(a.page.getByTestId('undo')).toBeEnabled();
  await a.page.getByTestId('undo').click();
  await expectConverged(a, b);
  expect(await docPosition(b.page, id)).toEqual(start);
  await expect(b.page.locator('xy-node[data-id="seed-design"] input')).toHaveValue('Visual design');
  // nothing left to undo for Ada (Grace's change is not on her stack)
  await expect(a.page.getByTestId('undo')).toBeDisabled();
  // Grace's own undo reverts her rename only
  await expect(b.page.getByTestId('undo')).toBeEnabled();
  await b.page.getByTestId('undo').click();
  await expectConverged(a, b);
  await expect(a.page.locator('xy-node[data-id="seed-design"] input')).toHaveValue('Design');
  expect(await docPosition(a.page, id)).toEqual(start);
  await close(a, b);
});

test('Ctrl+Z on the canvas undoes the last local change', async ({ browser }, info) => {
  const room = uniqueRoom('undokey');
  const a = await openPeer(browser, info, room, 'Ada');
  await seeded(a);
  await addNodeWithTitle(a.page, 'idea', 'Temp');
  await expect(a.page.locator('.lit-flow__node')).toHaveCount(7);
  // click on empty canvas so focus leaves the input, then undo with the keyboard
  await a.page.mouse.click(60, 400);
  await a.page.keyboard.press('Control+z');
  await expect(a.page.locator('.lit-flow__node')).toHaveCount(6);
  await a.page.keyboard.press('Control+Shift+z');
  await expect(a.page.locator('.lit-flow__node')).toHaveCount(7);
  await close(a);
});
