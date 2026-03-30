import { test, expect } from './base';
import { promises as fs } from 'fs';
import { makeTrack, seedLibrary } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('export downloads a valid JSON library file', async ({ page }) => {
  await seedLibrary(page, {
    version: 1,
    tracks: [makeTrack('t1', 'Comfortably Numb', 'Pink Floyd')],
    folders: [],
  });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;

  const filePath = await download.path();
  const text = await fs.readFile(filePath!, 'utf-8');
  const json = JSON.parse(text);

  expect(Array.isArray(json.tracks)).toBe(true);
  expect(Array.isArray(json.folders)).toBe(true);
  expect(json.tracks.some((t: { title: string }) => t.title === 'Comfortably Numb')).toBe(true);
});

test('import replaces the library with the imported data', async ({ page }) => {
  const fixture = {
    version: 1,
    tracks: [makeTrack('imported-1', 'Wish You Were Here', 'Pink Floyd')],
    folders: [],
  };

  // The confirm dialog fires synchronously inside the file input's change handler
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#import-file-input').setInputFiles({
    name: 'library.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });

  await expect(page.getByText('Wish You Were Here')).toBeVisible();
});
