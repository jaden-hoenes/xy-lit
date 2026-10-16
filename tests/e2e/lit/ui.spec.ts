import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { inFlow, ready } from './helpers';

/** The `@xy-lit/ui` gallery (apps/examples/src/examples/ui.ts). */

const node = (page: Page, id: string) => page.locator(`xy-node[data-id="${id}"]`);
const zoom = (page: Page) => inFlow(page, (flow) => flow.getZoom());

/** Console output that counts as an error. Lit's dev-mode notice is not. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    const text = m.text();
    const lit = text.includes('Lit is in dev mode');
    if (m.type() === 'error' || (m.type() === 'warning' && !lit)) {
      errors.push(`${m.type()}: ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

test.describe('@xy-lit/ui gallery', () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = collectErrors(page);
    await page.goto('/examples/ui');
    await ready(page);
    await expect(node(page, 'task-initial')).toBeVisible();
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test('renders every component without console errors', async ({ page }) => {
    // groups, status nodes, handles, schema, shapes, placeholder, edges
    for (const label of [
      'status indicator',
      'Labeled handle',
      'Database schema',
      'Shapes',
      'animated SVG edge',
    ]) {
      await expect(page.locator('.xy-ui-group__label', { hasText: label })).toBeVisible();
    }
    await expect(page.locator('.xy-ui-status')).toHaveCount(4);
    await expect(page.locator('.xy-ui-shape')).toHaveCount(12);
    await expect(page.locator('.xy-ui-schema__table')).toHaveCount(2);
    await expect(page.locator('.xy-ui-placeholder')).toBeVisible();
    await expect(page.locator('.xy-ui-labeled-handle')).toHaveCount(3);
    await expect(page.locator('.xy-ui-edge-button')).toHaveCount(1);
    await expect(page.locator('.xy-ui-data-edge')).toHaveCount(1);
    await expect(page.locator('animateMotion')).toHaveCount(2);
    // panels
    await expect(page.locator('xy-zoom-slider input[type="range"]')).toBeVisible();
    await expect(page.locator('xy-zoom-select select')).toBeVisible();
    await expect(page.locator('xy-node-search input')).toBeVisible();
    await expect(page.locator('xy-devtools [role="switch"]')).toHaveCount(3);
    await expect(page.locator('.lit-flow__minimap')).toBeVisible();
    // the whole gallery is in view after fit-view
    for (const id of ['g-status', 'g-shapes', 'g-edges']) {
      const box = await node(page, id).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
    }
  });

  test('the Run button drives the status ring: loading, then success', async ({ page }) => {
    const status = page.locator('xy-node[data-id="task-initial"] .xy-ui-status');
    await expect(status).toHaveAttribute('data-status', 'initial');
    await node(page, 'task-initial').getByRole('button', { name: 'Run' }).click();
    await expect(status).toHaveAttribute('data-status', 'loading');
    await expect(status).toHaveAttribute('aria-busy', 'true');
    await expect(status).toHaveAttribute('data-status', 'success');
    // the error node fails
    const err = page.locator('xy-node[data-id="task-error"] .xy-ui-status');
    await node(page, 'task-error').getByRole('button', { name: 'Run' }).click();
    await expect(err).toHaveAttribute('data-status', 'error');
  });

  test('the tooltip appears while a node is hovered', async ({ page }) => {
    const target = node(page, 'task-success');
    await expect(page.locator('.xy-ui-tooltip')).toHaveCount(0);
    await target.hover();
    const tip = page.locator('.xy-ui-tooltip');
    await expect(tip).toHaveText('Green ring on success');
    const [t, n] = [await tip.boundingBox(), await target.boundingBox()];
    expect(t!.y + t!.height).toBeLessThanOrEqual(n!.y);
    await page.mouse.move(640, 5);
    await expect(tip).toHaveCount(0);
  });

  test('the button handle adds the next step and hides its button', async ({ page }) => {
    const before = await inFlow(page, (flow) => flow.getNodes().length);
    const add = page.getByRole('button', { name: 'Add next step' });
    await expect(add).toHaveCount(1);
    await node(page, 'step-1').getByRole('button', { name: 'Add next step' }).click();
    await expect.poll(() => inFlow(page, (flow) => flow.getNodes().length)).toBe(before + 1);
    await expect(node(page, 'step-1').getByRole('button', { name: 'Add next step' })).toHaveCount(
      0,
    );
    await expect(page.locator('xy-node[data-id^="step-added-"]')).toBeVisible();
  });

  test('clicking the placeholder turns it into a step', async ({ page }) => {
    await page.locator('xy-node[data-id="placeholder"] .xy-ui-placeholder__button').click();
    await expect(node(page, 'placeholder').locator('.xy-ui-placeholder')).toHaveCount(0);
    await expect(node(page, 'placeholder')).toContainText('New step');
  });

  test('the delete button of the button edge removes the edge', async ({ page }) => {
    await expect(page.locator('g[data-id="x-button"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Delete edge' }).click();
    await expect(page.locator('g[data-id="x-button"]')).toHaveCount(0);
    await expect(page.locator('.xy-ui-edge-button')).toHaveCount(0);
  });

  test('node search selects a node and centres it', async ({ page }) => {
    const input = page.locator('xy-node-search input');
    await input.fill('mixer');
    await expect(page.locator('xy-node-search [role="option"]')).toHaveCount(1);
    await input.press('Enter');
    await expect(node(page, 'mixer').locator('xy-base-node')).toHaveAttribute('selected', '');
    await expect
      .poll(async () => {
        const b = await node(page, 'mixer').boundingBox();
        return Math.abs(b!.x + b!.width / 2 - 640) + Math.abs(b!.y + b!.height / 2 - 360);
      })
      .toBeLessThan(3);
  });

  test('zoom select and zoom slider change the zoom', async ({ page }) => {
    await page.locator('xy-zoom-select select').selectOption('2');
    await expect.poll(() => zoom(page)).toBeCloseTo(2, 1);
    await expect(page.locator('xy-zoom-slider .xy-ui-zoom__value')).toHaveText('200%');
    await page.locator('xy-zoom-select select').selectOption('fit');
    // fit view settles at the zoom that shows the whole gallery
    await expect.poll(async () => zoom(page), { timeout: 5000 }).toBeLessThan(1);
    await page.waitForTimeout(400);
    const fitted = await zoom(page);
    await page.locator('xy-zoom-slider').getByRole('button', { name: 'Zoom in' }).click();
    await expect.poll(() => zoom(page)).toBeGreaterThan(fitted * 1.15);
  });

  test('devtools: the viewport logger and the node inspector', async ({ page }) => {
    await page.getByRole('switch', { name: 'Viewport logger' }).click();
    await expect(page.locator('[data-testid="viewport-readout"]')).toContainText('zoom');
    await page.getByRole('switch', { name: 'Node inspector' }).click();
    await expect(page.locator('.xy-ui-inspector__box[data-node-id="users"]')).toContainText(
      'databaseSchema',
    );
    await page.getByRole('switch', { name: 'Change logger' }).click();
    await node(page, 'e1-a').click();
    await expect(page.locator('.xy-ui-dev__log li').first()).toContainText('select');
  });

  test('dark mode restyles the components through the theme tokens', async ({ page }) => {
    const card = node(page, 'task-initial').locator('xy-base-node');
    const bg = () => card.evaluate((el) => getComputedStyle(el).backgroundColor);
    const light = await bg();
    await page.getByTestId('theme-toggle').click();
    await expect.poll(bg).not.toBe(light);
    expect(await inFlow(page, (flow) => flow.colorMode)).toBe('dark');
  });

  test('a shape can be dragged', async ({ page }) => {
    const before = await node(page, 'shape-circle').boundingBox();
    await page.mouse.move(before!.x + 20, before!.y + before!.height / 2);
    await page.mouse.down();
    await page.mouse.move(before!.x + 80, before!.y + before!.height / 2 + 30, { steps: 8 });
    await page.mouse.up();
    const after = await node(page, 'shape-circle').boundingBox();
    expect(after!.x - before!.x).toBeGreaterThan(40);
  });
});
