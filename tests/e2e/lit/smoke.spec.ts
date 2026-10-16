import { expect, test } from '@playwright/test';

test('examples index lists routes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'XY Lit examples' })).toBeVisible();
  await expect(page.getByTestId('route-list').getByRole('link').first()).toBeVisible();
});

test('unknown route is a 404', async ({ page }) => {
  await page.goto('/definitely/not/here');
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
});
