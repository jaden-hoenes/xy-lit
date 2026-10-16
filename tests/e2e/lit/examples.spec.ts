import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Smoke test of the examples app: every example page listed on the index opens without console
 * errors and renders at least one node. New pages are picked up from the index, so they are covered
 * the moment they exist; the index also fails the test when a page has no catalog entry.
 */

async function exampleRoutes(page: Page): Promise<string[]> {
  await page.goto('/');
  await page.getByTestId('route-list').waitFor();
  const routes = await page
    .getByTestId('route-list')
    .locator('a[data-route]')
    .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).dataset.route as string));
  return routes;
}

test('every example has a catalog entry', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('route-list').waitFor();
  // pages missing from `src/catalog.ts` end up in an "Other" section
  await expect(page.getByRole('heading', { name: 'Other', level: 2 })).toHaveCount(0);
});

test('the index groups the examples by category', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('route-list').waitFor();
  const headings = await page
    .getByTestId('route-list')
    .getByRole('heading', { level: 2 })
    .allTextContents();
  expect(headings).toEqual(
    expect.arrayContaining([
      'Basics',
      'Nodes',
      'Edges',
      'Interaction',
      'Layout',
      'Pro features',
      'Performance',
    ]),
  );
  await page.getByPlaceholder('Filter examples').fill('dagre layout');
  await expect(page.getByTestId('route-list').locator('li:not([hidden])')).toHaveCount(1);
});

test('every example opens without console errors and renders a node', async ({ page }) => {
  test.setTimeout(240_000);
  const routes = (await exampleRoutes(page)).filter(
    // the collaboration demo needs the Hocuspocus server (covered by e2e:collab); the larger stress
    // pages are covered by the perf budgets
    (r) => !r.startsWith('/collab/') && r !== '/stress/5000' && r !== '/stress/10000',
  );
  expect(routes.length).toBeGreaterThanOrEqual(40);

  for (const route of routes) {
    await test.step(route, async () => {
      const errors: string[] = [];
      const onConsole = (m: { type(): string; text(): string }) => {
        if (m.type() === 'error') errors.push(m.text());
      };
      const onPageError = (e: Error) => errors.push(e.message);
      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      await page.goto(route);
      // the node is in the flow's shadow root; locators pierce it
      await expect(page.locator('.lit-flow__node').first(), route).toBeAttached({
        timeout: 15_000,
      });
      await page.waitForTimeout(150);
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      expect(errors, `console errors on ${route}`).toEqual([]);
    });
  }
});
