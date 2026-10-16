import { expect, test } from '@playwright/test';
import {
  close,
  docPosition,
  expectConverged,
  nodeBox,
  openPeer,
  seeded,
  uniqueRoom,
  viewNode,
} from './helpers';

test('a live drag is visible on the other client, the drop is committed once', async ({
  browser,
}, info) => {
  const room = uniqueRoom('drag');
  const a = await openPeer(browser, info, room, 'Ada');
  await seeded(a);
  const b = await openPeer(browser, info, room, 'Grace');
  await seeded(b);

  const id = 'seed-marketing';
  const start = (await docPosition(a.page, id))!;
  const box = await nodeBox(a.page, id);
  // grab the card by its icon side (the title is draggable too, but this is always on the card)
  await a.page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
  await a.page.mouse.down();
  await a.page.mouse.move(box.x + box.width - 30 + 120, box.y + box.height / 2 + 90, { steps: 8 });

  // while the button is still down: B sees the node move and who moves it, but the document is unchanged
  await expect
    .poll(
      async () => {
        const n = await viewNode(b.page, id);
        return n ? Math.round(n.position.x - start.x) : null;
      },
      { timeout: 10_000 },
    )
    .toBeGreaterThan(40);
  const live = await viewNode(b.page, id);
  expect(live?.remote?.draggingBy?.name).toBe('Ada');
  expect(await docPosition(b.page, id)).toEqual(start);
  expect(await docPosition(a.page, id)).toEqual(start);

  await a.page.mouse.up();

  // after the drop both documents hold the same new position, and the live decoration is gone
  await expectConverged(a, b);
  const end = (await docPosition(b.page, id))!;
  expect(end.x - start.x).toBeGreaterThan(40);
  expect(end.y - start.y).toBeGreaterThan(30);
  expect(await docPosition(a.page, id)).toEqual(end);
  await expect.poll(async () => (await viewNode(b.page, id))?.remote?.draggingBy).toBeUndefined();
  expect((await viewNode(b.page, id))?.position).toEqual(end);

  await close(a, b);
});

test('remote cursors and avatars appear', async ({ browser }, info) => {
  const room = uniqueRoom('cursor');
  const a = await openPeer(browser, info, room, 'Ada');
  await seeded(a);
  const b = await openPeer(browser, info, room, 'Grace');
  await seeded(b);

  await a.page.mouse.move(500, 300);
  await a.page.mouse.move(560, 340, { steps: 6 });
  const tag = b.page.locator('xy-remote-cursors .name');
  await expect(tag).toHaveText('Ada');
  await expect(b.page.locator('xy-presence-avatars button[aria-label="Ada"]')).toBeVisible();
  await expect(a.page.locator('xy-presence-avatars button[aria-label="Grace"]')).toBeVisible();
  // two people in the room: the label counts everyone, including the viewer
  await expect(a.page.locator('xy-presence-avatars .live')).toHaveText('2 online');
  await expect(b.page.locator('xy-presence-avatars .live')).toHaveText('2 online');

  // leaving the canvas removes the cursor
  await a.page.mouse.move(640, 20);
  await expect(tag).toHaveCount(0, { timeout: 10_000 });
  await close(a, b);
});

test('a selection shows up as a ring on the other client', async ({ browser }, info) => {
  const room = uniqueRoom('select');
  const a = await openPeer(browser, info, room, 'Ada');
  await seeded(a);
  const b = await openPeer(browser, info, room, 'Grace');
  await seeded(b);
  const box = await nodeBox(a.page, 'seed-docs');
  await a.page.mouse.click(box.x + box.width - 30, box.y + box.height / 2);
  await expect(b.page.locator('.lit-flow__node[data-id="seed-docs"]')).toHaveClass(
    /remote-selected/,
  );
  await close(a, b);
});
