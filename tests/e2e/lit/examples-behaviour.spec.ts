import { expect, test } from '@playwright/test';
import { centerOf, drag, inFlow, ready } from './helpers';

/** The interactive reactflow.dev examples (apps/examples/src/examples) do what they say. */

const handle = (page: import('@playwright/test').Page, type: 'source' | 'target', node: string) =>
  page.locator(`.lit-flow__handle.${type}[data-nodeid="${node}"]`);

test.describe('examples', () => {
  test('validation: only same-colour connections are made', async ({ page }) => {
    await page.goto('/examples/validation');
    await ready(page);
    await drag(
      page,
      await centerOf(handle(page, 'source', 'src-red')),
      await centerOf(handle(page, 'target', 'dst-blue')),
    );
    await expect(page.locator('.lit-flow__edge')).toHaveCount(0);
    await drag(
      page,
      await centerOf(handle(page, 'source', 'src-red')),
      await centerOf(handle(page, 'target', 'dst-red')),
    );
    await expect(page.locator('.lit-flow__edge')).toHaveCount(1);
    await expect(page.getByTestId('validation-status')).toContainText(
      'connected src-red to dst-red',
    );
  });

  test('connection-limit: a full handle accepts no more connections', async ({ page }) => {
    await page.goto('/examples/connection-limit');
    await ready(page);
    await drag(
      page,
      await centerOf(handle(page, 'source', 's1')),
      await centerOf(handle(page, 'target', 't1')),
    );
    await expect(page.locator('.lit-flow__edge')).toHaveCount(1);
    await expect(page.getByTestId('count-s1')).toHaveText('1 / 1');
    await drag(
      page,
      await centerOf(handle(page, 'source', 's1')),
      await centerOf(handle(page, 'target', 't2')),
    );
    await expect(page.locator('.lit-flow__edge')).toHaveCount(1);
    await expect(page.getByTestId('count-t2')).toHaveText('0 / 2');
  });

  test('add-node-on-edge-drop: releasing on the pane creates a connected node', async ({
    page,
  }) => {
    await page.goto('/examples/add-node-on-edge-drop');
    await ready(page);
    const from = await centerOf(handle(page, 'source', '0'));
    await drag(page, from, { x: from.x + 250, y: from.y + 120 });
    await expect(page.locator('.lit-flow__node')).toHaveCount(2);
    expect(await inFlow(page, (flow) => flow.getEdges().map((e) => [e.source, e.target]))).toEqual([
      ['0', '1'],
    ]);
  });

  test('drag-and-drop: a palette item dropped on the pane becomes a node', async ({ page }) => {
    await page.goto('/examples/drag-and-drop');
    await ready(page);
    await page
      .locator('[data-node-type="output"]')
      .dragTo(page.locator('xy-flow'), { targetPosition: { x: 500, y: 400 } });
    await expect(page.locator('.lit-flow__node')).toHaveCount(2);
    await expect(page.locator('.lit-flow__node-output')).toHaveCount(1);
  });

  test('save-restore: restore brings back the saved nodes', async ({ page }) => {
    await page.goto('/examples/save-restore');
    await ready(page);
    await page.locator('[data-action="save"]').click();
    await page.locator('[data-action="add"]').click();
    await expect(page.locator('.lit-flow__node')).toHaveCount(4);
    await page.locator('[data-action="restore"]').click();
    await expect(page.locator('.lit-flow__node')).toHaveCount(3);
    await expect(page.getByTestId('status')).toContainText('Restored 3 nodes');
  });

  test('context-menu: right-click offers delete', async ({ page }) => {
    await page.goto('/examples/context-menu');
    await ready(page);
    await page.locator('.lit-flow__node[data-id="2"]').click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
    await page.getByRole('menuitem', { name: 'delete' }).click();
    await expect(page.locator('.lit-flow__node[data-id="2"]')).toHaveCount(0);
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('intersections: a dragged node highlights what it overlaps', async ({ page }) => {
    await page.goto('/examples/intersections');
    await ready(page);
    const from = await centerOf(page.locator('.lit-flow__node[data-id="5"]'));
    const target = await centerOf(page.locator('.lit-flow__node[data-id="1"]'));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(target.x + 20, target.y + 20, { steps: 12 });
    await expect(page.locator('.lit-flow__node[data-id="1"]')).toHaveClass(/highlight/);
    await page.mouse.up();
    await expect(page.locator('.lit-flow__node.highlight')).toHaveCount(0);
  });

  test('proximity-connect: dropping near a node keeps the previewed edge', async ({ page }) => {
    await page.goto('/examples/proximity-connect');
    await ready(page);
    const from = await centerOf(page.locator('.lit-flow__node[data-id="3"]'));
    const near = await centerOf(page.locator('.lit-flow__node[data-id="1"]'));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(near.x, near.y + 90, { steps: 12 });
    await expect(page.locator('.lit-flow__edge.temp')).toHaveCount(1);
    await page.mouse.up();
    await expect(page.locator('.lit-flow__edge')).toHaveCount(1);
    await expect(page.locator('.lit-flow__edge.temp')).toHaveCount(0);
  });

  test('easy-connect: drag from a node body to another node', async ({ page }) => {
    await page.goto('/examples/easy-connect');
    await ready(page);
    const a = await centerOf(page.locator('.lit-flow__node[data-id="1"]'));
    const b = await centerOf(page.locator('.lit-flow__node[data-id="2"]'));
    await drag(page, a, b, 15);
    await expect(page.locator('.lit-flow__edge')).toHaveCount(1);
  });

  test('custom-edge: the button deletes its edge', async ({ page }) => {
    await page.goto('/examples/custom-edge');
    await ready(page);
    await expect(page.locator('.lit-flow__edge')).toHaveCount(4);
    await page.getByRole('button', { name: 'Delete edge e1-2' }).click();
    await expect(page.locator('.lit-flow__edge')).toHaveCount(3);
  });

  test('computing-flows: moving a slider recomputes the result', async ({ page }) => {
    await page.goto('/examples/computing-flows');
    await ready(page);
    await expect(page.getByTestId('value-result')).toHaveText('14');
    await page.getByRole('slider', { name: 'C' }).fill('10');
    await expect(page.getByTestId('value-result')).toHaveText('70');
  });

  test('custom-node: the picked colour reaches the connected nodes', async ({ page }) => {
    await page.goto('/examples/custom-node');
    await ready(page);
    await page.getByLabel('Node colour').fill('#ff0000');
    await expect(page.locator('.ex-swatch').first()).toContainText('#ff0000');
  });

  test('dagre: both directions lay the nodes out without overlap', async ({ page }) => {
    await page.goto('/examples/dagre');
    await ready(page);
    await expect(page.getByTestId('backend')).toContainText('dagre in', { timeout: 15_000 });
    for (const direction of ['LR', 'TB']) {
      await page.locator(`[data-direction="${direction}"]`).click();
      await expect
        .poll(() =>
          inFlow(
            page,
            (flow) => new Set(flow.getNodes().map((n) => `${n.position.x},${n.position.y}`)).size,
          ),
        )
        .toBe(11);
    }
  });

  test('dark-mode: the switch sets the flow colour mode', async ({ page }) => {
    await page.goto('/examples/dark-mode');
    await ready(page);
    await page.locator('[data-mode="dark"]').click();
    await expect(page.locator('.lit-flow.dark')).toHaveCount(1);
    await page.locator('[data-mode="light"]').click();
    await expect(page.locator('.lit-flow.light')).toHaveCount(1);
  });

  test('sub-flow: adding a child keeps it inside Group A', async ({ page }) => {
    await page.goto('/examples/sub-flow');
    await ready(page);
    await page.locator('[data-action="add-child"]').click();
    await expect(page.locator('.lit-flow__node')).toHaveCount(10);
    expect(
      await inFlow(
        page,
        (flow) => (flow.getNode('2-new-0') as { parentId?: string } | undefined)?.parentId,
      ),
    ).toBe('2');
  });
});
