import { expect, test } from '@playwright/test';
import { centerOf, inFlow, ready } from './helpers';

test.describe('two flows on one page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/e2e-two-flows');
    await ready(page, 'left');
    await ready(page, 'right');
  });

  const node = (page: import('@playwright/test').Page, side: 'left' | 'right', id: string) =>
    page.locator(
      `[data-testid="flow-${side === 'left' ? 'l' : 'r'}"] .lit-flow__node[data-id="${id}"]`,
    );

  test('selection is independent', async ({ page }) => {
    await node(page, 'left', 'l1').click();
    await expect(node(page, 'left', 'l1')).toHaveClass(/selected/);
    await expect(node(page, 'right', 'r1')).not.toHaveClass(/selected/);

    await node(page, 'right', 'r2').click();
    await expect(node(page, 'right', 'r2')).toHaveClass(/selected/);
    // the left flow keeps its own selection
    await expect(node(page, 'left', 'l1')).toHaveClass(/selected/);
    expect(await inFlow(page, (f) => f.getNodes().filter((n) => n.selected).length, 'left')).toBe(
      1,
    );
    expect(await inFlow(page, (f) => f.getNodes().filter((n) => n.selected).length, 'right')).toBe(
      1,
    );
  });

  test('the delete key acts on the active flow only', async ({ page }) => {
    await node(page, 'left', 'l1').click();
    await node(page, 'right', 'r1').click();
    // both flows have a selected node; the right one was pressed last
    await page.keyboard.press('Delete');
    await expect(node(page, 'right', 'r1')).toHaveCount(0);
    await expect(node(page, 'left', 'l1')).toHaveCount(1);
    await expect(node(page, 'left', 'l1')).toHaveClass(/selected/);

    await node(page, 'left', 'l1').click();
    await page.keyboard.press('Delete');
    await expect(node(page, 'left', 'l1')).toHaveCount(0);
    await expect(node(page, 'right', 'r2')).toHaveCount(1);
  });

  test('both flows keep their own marker definitions with the same ids', async ({ page }) => {
    const info = await page.evaluate(() => {
      const read = (ref: string) => {
        const flow = (window as unknown as Record<string, HTMLElement>)[ref]!;
        const root = flow.shadowRoot!;
        return {
          markers: [...root.querySelectorAll('marker')].map((m) => m.id),
          markerEnd: root.querySelector('.lit-flow__edge-path')?.getAttribute('marker-end'),
        };
      };
      return { left: read('left'), right: read('right') };
    });
    expect(info.left.markers).toEqual(['1__type=arrowclosed']);
    expect(info.right.markers).toEqual(info.left.markers);
    expect(info.left.markerEnd).toBe("url('#1__type=arrowclosed')");
    expect(info.right.markerEnd).toBe(info.left.markerEnd);
    // neither flow leaks its markers into the document
    expect(await page.locator('marker').count()).toBe(2);
    // removing an edge in one flow does not touch the other flow's marker
    await inFlow(
      page,
      (f) =>
        (f as never as { deleteElements(p: unknown): unknown }).deleteElements({
          edges: [{ id: 'l-e' }],
        }),
      'left',
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as Record<string, HTMLElement>).left!.shadowRoot!.querySelectorAll(
              'marker',
            ).length,
        ),
      )
      .toBe(0);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as Record<string, HTMLElement>).right!.shadowRoot!.querySelectorAll(
            'marker',
          ).length,
      ),
    ).toBe(1);
  });

  test('dragging a node in one flow leaves the other alone', async ({ page }) => {
    const from = await centerOf(node(page, 'left', 'l2'));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 60, from.y + 30, { steps: 6 });
    await page.mouse.up();
    expect(await inFlow(page, (f) => f.getNode('l2')!.position.x, 'left')).toBeGreaterThan(40);
    expect(await inFlow(page, (f) => f.getNode('r2')!.position.x, 'right')).toBe(40);
  });
});
