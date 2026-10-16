import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { centerOf, drag, inFlow, nodePosition, ready } from './helpers';

/** `@xy-lit/pro` on one flow (apps/examples/src/examples/pro-compose.ts). */

const node = (page: Page, id: string) => page.locator(`.lit-flow__node[data-id="${id}"]`);
const nodeCount = (page: Page) => inFlow(page, (flow) => flow.getNodes().length);
const edgeCount = (page: Page) => inFlow(page, (flow) => flow.getEdges().length);
const proStatus = (page: Page) =>
  page.evaluate(() => {
    const pro = (window as unknown as { pro: { history: { undoSize: number; redoSize: number } } })
      .pro;
    return { undo: pro.history.undoSize, redo: pro.history.redoSize };
  });

test.describe('@xy-lit/pro composed on one flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/pro-compose');
    await ready(page);
    await expect(node(page, 'a')).toBeVisible();
  });

  test('undo and redo of a drag through the keyboard', async ({ page }) => {
    const before = await nodePosition(page, 'b');
    const from = await centerOf(node(page, 'b'));
    await drag(page, from, { x: from.x + 90, y: from.y + 60 }, 12);
    await expect.poll(async () => (await nodePosition(page, 'b')).x).toBeGreaterThan(before.x + 60);
    const moved = await nodePosition(page, 'b');
    expect((await proStatus(page)).undo).toBe(1);

    await page.keyboard.press('Control+z');
    await expect.poll(() => nodePosition(page, 'b')).toEqual(before);
    expect(await proStatus(page)).toEqual({ undo: 0, redo: 1 });

    await page.keyboard.press('Control+Shift+z');
    await expect.poll(() => nodePosition(page, 'b')).toEqual(moved);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    await expect.poll(() => nodePosition(page, 'b')).toEqual(moved);
  });

  test('undo and redo of a delete', async ({ page }) => {
    await node(page, 'd').click();
    await page.keyboard.press('Backspace');
    await expect.poll(() => nodeCount(page)).toBe(4);
    await expect.poll(() => edgeCount(page)).toBe(2);
    await page.keyboard.press('Control+z');
    await expect.poll(() => nodeCount(page)).toBe(5);
    await expect.poll(() => edgeCount(page)).toBe(4);
    await expect(node(page, 'd')).toHaveClass(/selected/);
  });

  test('copy and paste with the keyboard keeps edges between copied nodes and remaps ids', async ({
    page,
  }) => {
    await node(page, 'a').click();
    await node(page, 'b').click({ modifiers: ['Control'] });
    await expect(node(page, 'b')).toHaveClass(/selected/);
    await page.keyboard.press('Control+c');
    // paste at the pointer, over an empty part of the pane
    const pane = await centerOf(page.locator('.lit-flow__pane'));
    await page.mouse.move(pane.x + 150, pane.y + 220, { steps: 4 });
    await expect.poll(() => inFlow(page, (flow) => flow.getNodes().length)).toBe(5);
    await page.keyboard.press('Control+v');
    await expect.poll(() => nodeCount(page)).toBe(7);
    const result = await inFlow(page, (flow) => ({
      ids: flow.getNodes().map((n) => n.id),
      edges: flow.getEdges().map((e) => [e.id, e.source, e.target]),
      selected: flow
        .getNodes()
        .filter((n) => n.selected)
        .map((n) => n.id),
    }));
    expect(new Set(result.ids).size).toBe(7);
    expect(result.selected).toHaveLength(2);
    expect(result.selected.every((id) => !['a', 'b'].includes(id))).toBe(true);
    // 4 original edges + the one between the copied pair
    expect(result.edges).toHaveLength(5);
    const copy = result.edges.find(([id]) => !['ab', 'bc', 'ad', 'de'].includes(id as string))!;
    expect(result.selected).toContain(copy[1]);
    expect(result.selected).toContain(copy[2]);

    // one paste is one undo step
    await page.keyboard.press('Control+z');
    await expect.poll(() => nodeCount(page)).toBe(5);
    await expect.poll(() => edgeCount(page)).toBe(4);
  });

  test('duplicate with Mod+D offsets the copy', async ({ page }) => {
    await node(page, 'c').click();
    await page.keyboard.press('Control+d');
    await expect.poll(() => nodeCount(page)).toBe(6);
    const [orig, copy] = await inFlow(page, (flow) => [
      flow.getNode('c')!.position,
      flow.getNodes().find((n) => n.selected)!.position,
    ]);
    expect(copy).toEqual({ x: orig!.x + 20, y: orig!.y + 20 });
  });

  test('helper lines show while dragging and the node snaps onto the guide', async ({ page }) => {
    // d (x 160) is dragged towards a's left edge (x 100); the first pointer step is lost
    const start = await centerOf(node(page, 'd'));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 68, start.y, { steps: 12 });
    await expect(page.locator('xy-helper-lines line[part~="vertical"]')).toHaveCount(1);
    await page.mouse.up();
    await expect.poll(async () => (await nodePosition(page, 'd')).x).toBe(100);
    expect((await nodePosition(page, 'd')).y).toBe(300);
    await expect(page.locator('xy-helper-lines line')).toHaveCount(0);
    // the snap is what history recorded
    await page.keyboard.press('Control+z');
    await expect.poll(() => nodePosition(page, 'd')).toEqual({ x: 160, y: 300 });
  });

  test('auto layout runs off the main thread, is one undo step, and fits the view', async ({
    page,
  }) => {
    const before = await inFlow(page, (flow) => flow.getNodes().map((n) => [n.id, n.position]));
    await page.getByRole('button', { name: 'Layout LR' }).click();
    await expect(page.locator('[data-testid="status"]')).toHaveText('layout: worker');
    await expect
      .poll(async () => {
        const pos = new Map(
          await inFlow(page, (flow) => flow.getNodes().map((n) => [n.id, n.position.x] as const)),
        );
        return (
          pos.get('a')! < pos.get('b')! &&
          pos.get('b')! < pos.get('c')! &&
          pos.get('a')! < pos.get('d')!
        );
      })
      .toBe(true);
    expect(
      await inFlow(page, (flow) => flow.getNodes().map((n) => [n.id, n.position])),
    ).not.toEqual(before);
    expect((await proStatus(page)).undo).toBe(1);
    await page.keyboard.press('Control+z');
    await expect
      .poll(() => inFlow(page, (flow) => flow.getNodes().map((n) => [n.id, n.position])))
      .toEqual(before);
  });

  test('group the selection, then undo', async ({ page }) => {
    await node(page, 'd').click();
    await node(page, 'e').click({ modifiers: ['Control'] });
    await page.getByRole('button', { name: 'Group', exact: true }).click();
    await expect.poll(() => nodeCount(page)).toBe(6);
    const parents = await inFlow(page, (flow) =>
      flow.getNodes().map((n) => [n.id, (n as { parentId?: string }).parentId ?? null]),
    );
    const group = parents.find(([id]) => String(id).startsWith('group-'))![0];
    expect(parents.filter(([, p]) => p === group).map(([id]) => id)).toEqual(['d', 'e']);
    await page.keyboard.press('Control+z');
    await expect.poll(() => nodeCount(page)).toBe(5);
    expect(await nodePosition(page, 'd')).toEqual({ x: 160, y: 300 });
  });

  test('collapse hides the subtree and expand brings it back', async ({ page }) => {
    await page.evaluate(() => {
      (
        window as unknown as { pro: { toggleCollapsed: (f: unknown, id: string) => void } }
      ).pro.toggleCollapsed(window.flow, 'd');
    });
    await expect(node(page, 'e')).toHaveCount(0);
    await expect(page.locator('g[data-id="de"]')).toHaveCount(0);
    await expect(node(page, 'd')).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect(node(page, 'e')).toBeVisible();
  });
});
