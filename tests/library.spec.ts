import { test, expect } from './base';
import { makeTrack } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('add track modal opens and closes', async ({ page }) => {
  await page.getByRole('button', { name: /add track/i }).click();
  const dialog = page.getByRole('dialog', { name: /add track/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test('add track form validation blocks empty submission', async ({ page }) => {
  await page.getByRole('button', { name: /add track/i }).click();
  const dialog = page.getByRole('dialog', { name: /add track/i });
  await dialog.getByRole('button', { name: /add track/i }).click();
  await expect(dialog).toBeVisible();
});

test('add track form creates a new track', async ({ page }) => {
  await page.getByRole('button', { name: /add track/i }).click();
  const dialog = page.getByRole('dialog', { name: /add track/i });

  // Fill title and artist first — this prevents the oEmbed auto-fetch
  // that would otherwise trigger on URL field blur when they are empty.
  await dialog.getByLabel(/^title/i).fill('Comfortably Numb');
  await dialog.getByLabel(/^artist/i).fill('Pink Floyd');

  // The form has two "YouTube URL" labels (tab video and audio track).
  // The tab video URL is first in the DOM.
  await dialog.getByLabel(/youtube url/i).first().fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  await dialog.getByRole('button', { name: /add track/i }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Comfortably Numb')).toBeVisible();
});

test('search filters the track list', async ({ page }) => {
  const tracks = [
    makeTrack('1', 'Comfortably Numb', 'Pink Floyd'),
    makeTrack('2', 'Smoke on the Water', 'Deep Purple'),
  ];
  await page.evaluate((library) => {
    localStorage.setItem('tabsync-library', JSON.stringify(library));
  }, { tracks, folders: [] });
  await page.reload();

  await page.getByRole('searchbox').fill('smoke');
  await expect(page.getByText('Smoke on the Water')).toBeVisible();
  await expect(page.getByText('Comfortably Numb')).toBeHidden();
});

test('sidebar collapses and expands', async ({ page }) => {
  // The "Open library" button (hamburger) is hidden when the sidebar is open
  // and visible when collapsed — it's the clearest proxy for sidebar state.
  const openBtn = page.getByRole('button', { name: 'Open library' });
  await expect(openBtn).toBeHidden();
  await page.getByRole('button', { name: 'Collapse library' }).click();
  await expect(openBtn).toBeVisible();
  await openBtn.click();
  await expect(openBtn).toBeHidden();
});
