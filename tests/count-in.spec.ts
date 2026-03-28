import { test, expect } from '@playwright/test';
import { makeTrack, seedLibrary } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('count-in defaults to "Follow global setting" in the add track form', async ({ page }) => {
  await page.goto('/');
  await page.locator('#add-track-btn').click();

  const dialog = page.getByRole('dialog', { name: /add track/i });
  await expect(dialog.getByLabel('Count-in')).toHaveValue('');
});

test('editor pre-populates count-in from existing track', async ({ page }) => {
  await seedLibrary(page, {
    version: 2,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', { countIn: true })],
    folders: [],
  });

  const trackItem = page.locator('.track-item').filter({ hasText: 'Test Track' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();

  const dialog = page.getByRole('dialog', { name: /edit track/i });
  await expect(dialog.getByLabel('Count-in')).toHaveValue('true');
});

test('setting count-in to "Always on" persists countIn: true', async ({ page }) => {
  await seedLibrary(page, {
    version: 2,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist')],
    folders: [],
  });

  const trackItem = page.locator('.track-item').filter({ hasText: 'Test Track' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();

  const dialog = page.getByRole('dialog', { name: /edit track/i });
  await dialog.getByLabel('Count-in').selectOption('true');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();

  const countIn = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('tabsync-library') ?? '{}');
    return lib.tracks?.[0]?.countIn;
  });
  expect(countIn).toBe(true);
});

test('setting count-in to "Always off" persists countIn: false', async ({ page }) => {
  await seedLibrary(page, {
    version: 2,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', { countIn: true })],
    folders: [],
  });

  const trackItem = page.locator('.track-item').filter({ hasText: 'Test Track' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();

  const dialog = page.getByRole('dialog', { name: /edit track/i });
  await expect(dialog.getByLabel('Count-in')).toHaveValue('true');
  await dialog.getByLabel('Count-in').selectOption('false');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();

  const countIn = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('tabsync-library') ?? '{}');
    return lib.tracks?.[0]?.countIn;
  });
  expect(countIn).toBe(false);
});

test('resetting count-in to "Follow global setting" persists countIn: null', async ({ page }) => {
  await seedLibrary(page, {
    version: 2,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', { countIn: true })],
    folders: [],
  });

  const trackItem = page.locator('.track-item').filter({ hasText: 'Test Track' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();

  const dialog = page.getByRole('dialog', { name: /edit track/i });
  await dialog.getByLabel('Count-in').selectOption('');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();

  const countIn = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('tabsync-library') ?? '{}');
    return lib.tracks?.[0]?.countIn;
  });
  expect(countIn).toBeNull();
});
