import { test, expect } from './base';
import { makeTrack, seedLibrary } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

// ── Editor form ──

test('audio position defaults to bottom-right in add track form', async ({ page }) => {
  await page.goto('/');
  await page.locator('#add-track-btn').click();

  const dialog = page.getByRole('dialog', { name: /add track/i });
  await dialog.locator('.section-toggle').click(); // open audio section
  await expect(dialog.getByLabel('Overlay position')).toHaveValue('bottom-right');
});

test('editor pre-populates audio position from existing track', async ({ page }) => {
  await seedLibrary(page, {
    version: 4,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', {
      audioVideoId: 'dQw4w9WgXcQ',
      audioPosition: 'top-left',
    })],
    folders: [],
  });

  const trackItem = page.locator('.track-item').filter({ hasText: 'Test Track' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();

  const dialog = page.getByRole('dialog', { name: /edit track/i });
  await expect(dialog.getByLabel('Overlay position')).toHaveValue('top-left');
});

test('saving audio position from editor persists to localStorage', async ({ page }) => {
  await seedLibrary(page, {
    version: 4,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', {
      audioVideoId: 'dQw4w9WgXcQ',
      audioPosition: 'bottom-right',
    })],
    folders: [],
  });

  const trackItem = page.locator('.track-item').filter({ hasText: 'Test Track' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();

  const dialog = page.getByRole('dialog', { name: /edit track/i });
  await dialog.getByLabel('Overlay position').selectOption('top-right');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();

  const saved = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('tabsync-library') ?? '{}');
    return lib.tracks?.[0]?.audioPosition;
  });
  expect(saved).toBe('top-right');
});

test('schema migration adds audioPosition: bottom-right to v3 tracks on save', async ({ page }) => {
  // Seed a v3 library without audioPosition
  await page.evaluate(() => {
    const lib = {
      version: 3,
      tracks: [{
        id: 't1', title: 'Test Track', artist: 'Test Artist',
        tabVideoId: 'dQw4w9WgXcQ', audioVideoId: 'dQw4w9WgXcQ',
        syncOffset: 0, folderId: null, favourite: false,
        difficulty: null, countIn: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }],
      folders: [],
    };
    localStorage.setItem('tabsync-library', JSON.stringify(lib));
  });
  await page.reload();

  // Edit and save (any save triggers migration to persist)
  const trackItem = page.locator('.track-item').filter({ hasText: 'Test Track' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();
  await page.getByRole('dialog', { name: /edit track/i })
    .getByRole('button', { name: 'Save Changes' }).click();

  const saved = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('tabsync-library') ?? '{}');
    return { version: lib.version, audioPosition: lib.tracks?.[0]?.audioPosition };
  });
  expect(saved.version).toBe(4);
  expect(saved.audioPosition).toBe('bottom-right');
});

// ── Controls bar ── (these require the YouTube API stub to reach Ready state)

test('controls bar overlay select is disabled when no track is loaded', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#audio-position-select')).toBeDisabled();
});

test('controls bar overlay select is disabled for tab-only tracks', async ({ page }) => {
  await seedLibrary(page, {
    version: 4,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist')], // no audioVideoId
    folders: [],
  });

  await page.locator('.track-item').filter({ hasText: 'Test Track' }).click();
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 5000 });
  await expect(page.locator('#audio-position-select')).toBeDisabled();
});

test('controls bar overlay select is enabled when audio track is loaded', async ({ page }) => {
  await seedLibrary(page, {
    version: 4,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', { audioVideoId: 'dQw4w9WgXcQ' })],
    folders: [],
  });

  await page.locator('.track-item').filter({ hasText: 'Test Track' }).click();
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 5000 });
  await expect(page.locator('#audio-position-select')).toBeEnabled();
});

test('controls bar overlay select reflects the track audioPosition', async ({ page }) => {
  await seedLibrary(page, {
    version: 4,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', {
      audioVideoId: 'dQw4w9WgXcQ',
      audioPosition: 'top-right',
    })],
    folders: [],
  });

  await page.locator('.track-item').filter({ hasText: 'Test Track' }).click();
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 5000 });
  await expect(page.locator('#audio-position-select')).toHaveValue('top-right');
});

test('controls bar overlay select applies the correct CSS class to the audio container', async ({ page }) => {
  await seedLibrary(page, {
    version: 4,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', {
      audioVideoId: 'dQw4w9WgXcQ',
      audioPosition: 'bottom-left',
    })],
    folders: [],
  });

  await page.locator('.track-item').filter({ hasText: 'Test Track' }).click();
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 5000 });
  await expect(page.locator('#audio-container')).toHaveClass(/pos-bottom-left/);
});

test('changing overlay position via controls bar persists to localStorage', async ({ page }) => {
  await seedLibrary(page, {
    version: 4,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', {
      audioVideoId: 'dQw4w9WgXcQ',
      audioPosition: 'bottom-right',
    })],
    folders: [],
  });

  await page.locator('.track-item').filter({ hasText: 'Test Track' }).click();
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 5000 });

  await page.locator('#audio-position-select').selectOption('top-left');

  const saved = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('tabsync-library') ?? '{}');
    return lib.tracks?.[0]?.audioPosition;
  });
  expect(saved).toBe('top-left');
});

test('changing overlay position via controls bar updates the audio container class', async ({ page }) => {
  await seedLibrary(page, {
    version: 4,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', {
      audioVideoId: 'dQw4w9WgXcQ',
      audioPosition: 'bottom-right',
    })],
    folders: [],
  });

  await page.locator('.track-item').filter({ hasText: 'Test Track' }).click();
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 5000 });

  await page.locator('#audio-position-select').selectOption('top-left');
  await expect(page.locator('#audio-container')).toHaveClass(/pos-top-left/);
  await expect(page.locator('#audio-container')).not.toHaveClass(/pos-bottom-right/);
});
