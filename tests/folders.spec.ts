import { test, expect } from './base';
import { makeTrack, makeFolder, seedLibrary } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('create folder adds it to the folder nav', async ({ page }) => {
  await page.locator('#new-folder-trigger').click();

  const input = page.locator('.new-folder-row input');
  await input.fill('Rock Classics');
  await input.press('Enter');

  await expect(page.locator('#folder-nav').getByText('Rock Classics', { exact: true })).toBeVisible();
});

test('new folder created via editor appears in nav when track is saved', async ({ page }) => {
  await page.getByRole('button', { name: /add track/i }).click();
  const dialog = page.getByRole('dialog', { name: /add track/i });

  await dialog.getByLabel(/^title/i).fill('Comfortably Numb');
  await dialog.getByLabel(/^artist/i).fill('Pink Floyd');
  await dialog.getByLabel(/youtube url/i).first().fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  await dialog.getByLabel(/folder/i).selectOption('+ New folder…');
  await dialog.getByPlaceholder('Folder name…').fill('Rock Classics');

  await dialog.getByRole('button', { name: /add track/i }).click();
  await expect(dialog).toBeHidden();

  await expect(page.locator('#folder-nav').getByText('Rock Classics', { exact: true })).toBeVisible();
});

test('new folder is not created when editor is cancelled', async ({ page }) => {
  await page.getByRole('button', { name: /add track/i }).click();
  const dialog = page.getByRole('dialog', { name: /add track/i });

  await dialog.getByLabel(/folder/i).selectOption('+ New folder…');
  await dialog.getByPlaceholder('Folder name…').fill('Rock Classics');

  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.locator('#folder-nav').getByText('Rock Classics', { exact: true })).toBeHidden();
});

test('delete folder reassigns its tracks to all tracks', async ({ page }) => {
  await seedLibrary(page, {
    version: 1,
    tracks: [makeTrack('t1', 'Comfortably Numb', 'Pink Floyd', { folderId: 'f1' })],
    folders: [makeFolder('f1', 'Rock Classics')],
  });

  // Confirm the track is visible when the folder is selected
  await page.locator('#folder-nav').getByText('Rock Classics', { exact: true }).click();
  await expect(page.getByText('Comfortably Numb')).toBeVisible();

  // Delete the folder
  const folderItem = page.locator('#folder-nav .folder-item').filter({ hasText: 'Rock Classics' });
  await folderItem.hover();

  page.once('dialog', dialog => dialog.accept());
  await folderItem.getByTitle('Delete folder').click();

  // Folder is gone from nav
  await expect(page.locator('#folder-nav').getByText('Rock Classics', { exact: true })).toBeHidden();

  // Track is still visible under all tracks
  await page.locator('#folder-nav').getByText('All tracks', { exact: true }).click();
  await expect(page.getByText('Comfortably Numb')).toBeVisible();
});
