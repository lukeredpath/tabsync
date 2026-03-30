import { test, expect } from './base';
import { makeTrack, seedLibrary } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('favourite button toggles between starred and unstarred', async ({ page }) => {
  await seedLibrary(page, {
    version: 1,
    tracks: [makeTrack('t1', 'Comfortably Numb', 'Pink Floyd', { favourite: false })],
    folders: [],
  });

  const trackItem = page.locator('.track-item').filter({ hasText: 'Comfortably Numb' });

  await expect(trackItem.getByTitle('Add to favourites')).toBeVisible();

  await trackItem.getByTitle('Add to favourites').click();
  await expect(trackItem.getByTitle('Remove from favourites')).toBeVisible();

  await trackItem.getByTitle('Remove from favourites').click();
  await expect(trackItem.getByTitle('Add to favourites')).toBeVisible();
});

test('favourites view shows only starred tracks', async ({ page }) => {
  await seedLibrary(page, {
    version: 1,
    tracks: [
      makeTrack('t1', 'Comfortably Numb', 'Pink Floyd', { favourite: true }),
      makeTrack('t2', 'Smoke on the Water', 'Deep Purple', { favourite: false }),
    ],
    folders: [],
  });

  await page.locator('#folder-nav').getByText('Favourites', { exact: true }).click();

  await expect(page.getByText('Comfortably Numb')).toBeVisible();
  await expect(page.getByText('Smoke on the Water')).toBeHidden();
});
