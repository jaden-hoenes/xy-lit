import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * axe-core against the generic nodes fixture and the color-mode page (spec/13). Violations of
 * impact `serious` or `critical` fail the test. Rules disabled: none.
 */
async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes.map((n) => JSON.stringify(n.target)).join(' ')} ${v.nodes[0]?.failureSummary ?? ''}`,
    );
}

const ready = async (page: Page) => {
  await page.waitForFunction(() => !!(window as unknown as { flow?: unknown }).flow);
  await page.evaluate(() =>
    (window as unknown as { flow: { whenRendered(): Promise<unknown> } }).flow.whenRendered(),
  );
};

test.describe('axe', () => {
  test('/tests/generic/nodes/general has no serious or critical violations', async ({ page }) => {
    await page.goto('/tests/generic/nodes/general');
    await page.locator('.lit-flow__node').first().waitFor();
    expect(await violations(page)).toEqual([]);
  });

  for (const mode of ['light', 'dark'] as const) {
    test(`/examples/color-mode (${mode}) has no serious or critical violations`, async ({
      page,
    }) => {
      await page.goto('/examples/color-mode');
      await ready(page);
      await page.getByTestId('colormode-select').selectOption(mode);
      await page.locator(`.lit-flow.${mode}`).waitFor();
      expect(await violations(page)).toEqual([]);
    });
  }

  test('plugin demo pages (controls, minimap, panel) have no serious or critical violations', async ({
    page,
  }) => {
    for (const route of ['/examples/controls', '/examples/minimap', '/examples/panel']) {
      await page.goto(route);
      await ready(page);
      expect(await violations(page), route).toEqual([]);
    }
  });
});
