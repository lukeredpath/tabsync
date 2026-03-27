import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Clear localStorage before each test to ensure isolation
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('page loads with correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('TabSync');
});

test('sidebar is visible with app title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('TabSync')).toBeVisible();
});

test('add track button is present', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /add track/i })).toBeVisible();
});
