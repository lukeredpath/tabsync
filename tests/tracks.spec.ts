import { test, expect } from './base';
import { makeTrack, seedLibrary } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('edit track opens pre-populated editor and saves changes', async ({ page }) => {
  await seedLibrary(page, {
    version: 1,
    tracks: [makeTrack('t1', 'Comfortably Numb', 'Pink Floyd')],
    folders: [],
  });

  const trackItem = page.locator('.track-item').filter({ hasText: 'Comfortably Numb' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();

  const dialog = page.getByRole('dialog', { name: /edit track/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^title/i)).toHaveValue('Comfortably Numb');

  await dialog.getByLabel(/^title/i).fill('Comfortably Numb (Live)');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Comfortably Numb (Live)')).toBeVisible();
});

test('delete track removes it from the list', async ({ page }) => {
  await seedLibrary(page, {
    version: 1,
    tracks: [makeTrack('t1', 'Comfortably Numb', 'Pink Floyd')],
    folders: [],
  });

  page.once('dialog', dialog => dialog.accept());

  const trackItem = page.locator('.track-item').filter({ hasText: 'Comfortably Numb' });
  await trackItem.hover();
  await trackItem.getByTitle('Delete track').click();

  await expect(page.getByText('Comfortably Numb')).toBeHidden();
});
