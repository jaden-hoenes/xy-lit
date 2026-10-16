import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  addNodeWithTitle,
  close,
  docOf,
  docPosition,
  expectConverged,
  nodeBox,
  openPeer,
  seeded,
  setOffline,
  uniqueRoom,
} from './helpers';

/** Type into a note's body (the textarea is always editable) at the end of the text. */
async function typeInNote(page: Page, text: string): Promise<void> {
  const body = page.locator('xy-node[data-id="seed-note"] textarea');
  await body.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(text);
}

test('concurrent edits made offline converge: drag + text + new nodes + a deleted node', async ({
  browser,
}, info) => {
  const room = uniqueRoom('merge');
  const a = await openPeer(browser, info, room, 'Ada');
  await seeded(a);
  const b = await openPeer(browser, info, room, 'Grace');
  await seeded(b);
  await setOffline(a, true);
  await setOffline(b, true);

  // Ada: types into the note and drags Design
  await typeInNote(a.page, ' [Ada was here]');
  const design = await nodeBox(a.page, 'seed-design');
  await a.page.mouse.move(design.x + design.width - 30, design.y + design.height / 2);
  await a.page.mouse.down();
  await a.page.mouse.move(design.x + design.width - 30 - 80, design.y + design.height / 2 + 60, {
    steps: 6,
  });
  await a.page.mouse.up();
  // Grace: types into the same note, adds an idea, deletes Docs
  await typeInNote(b.page, ' [Grace was here]');
  await addNodeWithTitle(b.page, 'idea', 'From Grace');
  const docs = await nodeBox(b.page, 'seed-docs');
  await b.page.mouse.click(docs.x + docs.width - 30, docs.y + docs.height / 2);
  await b.page.keyboard.press('Backspace');
  await expect(b.page.locator('.lit-flow__node[data-id="seed-docs"]')).toHaveCount(0);

  expect(await docOf(a.page)).not.toBe(await docOf(b.page));
  await setOffline(a, false);
  await setOffline(b, false);
  await expectConverged(a, b);

  const merged = JSON.parse(await docOf(a.page)) as {
    nodes: { id: string; data: { body?: string; label?: string } }[];
    edges: { target: string }[];
  };
  const note = merged.nodes.find((n) => n.id === 'seed-note')!;
  expect(note.data.body).toContain('[Ada was here]');
  expect(note.data.body).toContain('[Grace was here]');
  expect(merged.nodes.some((n) => n.data.label === 'From Grace')).toBe(true);
  expect(merged.nodes.some((n) => n.id === 'seed-docs')).toBe(false);
  expect(merged.edges.some((e) => e.target === 'seed-docs')).toBe(false);
  const moved = (await docPosition(b.page, 'seed-design'))!;
  expect(moved.y).toBeGreaterThan(-150 + 30);
  await close(a, b);
});

test('a dangling edge from a concurrent delete and connect is healed', async ({
  browser,
}, info) => {
  const room = uniqueRoom('heal');
  const a = await openPeer(browser, info, room, 'Ada');
  await seeded(a);
  const b = await openPeer(browser, info, room, 'Grace');
  await seeded(b);
  await setOffline(a, true);
  await setOffline(b, true);

  // Ada deletes Docs; Grace connects Docs to Engineering at the same time
  const docs = await nodeBox(a.page, 'seed-docs');
  await a.page.mouse.click(docs.x + docs.width - 30, docs.y + docs.height / 2);
  await a.page.keyboard.press('Backspace');
  await b.page.evaluate(() => {
    const flow = (window as unknown as { flow: { instance: { addEdges(e: unknown): void } } }).flow;
    flow.instance.addEdges({
      id: 'e-concurrent',
      source: 'seed-docs',
      sourceHandle: 'l',
      target: 'seed-eng',
      targetHandle: 'r',
    });
  });
  await setOffline(a, false);
  await setOffline(b, false);
  await expectConverged(a, b);

  // nobody renders the dangling edge, and within a few seconds somebody removes it from the document
  for (const p of [a, b]) {
    await expect(p.page.locator('g[data-id="e-concurrent"]')).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (JSON.parse(await docOf(p.page)) as { edges: { id: string }[] }).edges.some(
            (e) => e.id === 'e-concurrent',
          ),
        { timeout: 15_000 },
      )
      .toBe(false);
  }
  await close(a, b);
});

test('a client reconnects after the browser went offline (context.setOffline)', async ({
  browser,
}, info) => {
  const room = uniqueRoom('net');
  const a = await openPeer(browser, info, room, 'Ada');
  await seeded(a);
  const b = await openPeer(browser, info, room, 'Grace');
  await seeded(b);

  // the whole browser context loses its network: the page notices and keeps working locally
  await b.context.setOffline(true);
  await expect(b.page.getByTestId('status')).toContainText('Offline', { timeout: 15_000 });
  await addNodeWithTitle(b.page, 'idea', 'Made offline');
  await a.page.getByTestId('add-note').click();
  await expect(a.page.locator('.lit-flow__node')).toHaveCount(7);
  await expect(b.page.locator('.lit-flow__node')).toHaveCount(7);
  expect(await docOf(a.page)).not.toBe(await docOf(b.page));

  // network back: both edits end up everywhere
  await b.context.setOffline(false);
  await expect(b.page.getByTestId('status')).toContainText('Live', { timeout: 20_000 });
  await expect(b.page.getByText('Back online')).toBeVisible();
  await expectConverged(a, b);
  await expect(a.page.locator('.lit-flow__node')).toHaveCount(8);
  await expect(b.page.locator('.lit-flow__node')).toHaveCount(8);
  await close(a, b);
});
