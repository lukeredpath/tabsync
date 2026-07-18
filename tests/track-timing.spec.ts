import { test, expect } from './base';
import { makeTrack, seedLibrary } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

// ── Editor form ──

test('tab and audio start time fields default to 0 in the add track form', async ({ page }) => {
  await page.goto('/');
  await page.locator('#add-track-btn').click();

  const dialog = page.getByRole('dialog', { name: /add track/i });
  await expect(dialog.getByLabel('Tab start time (seconds)')).toHaveValue('0');

  await dialog.locator('.section-toggle').click(); // open audio section
  await expect(dialog.getByLabel('Audio start time (seconds)')).toHaveValue('0');
});

test('editor pre-populates start times from an existing track', async ({ page }) => {
  await seedLibrary(page, {
    version: 5,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', {
      audioVideoId: 'dQw4w9WgXcQ',
      tabStart: 4.5,
      audioStart: 12,
    })],
    folders: [],
  });

  const trackItem = page.locator('.track-item').filter({ hasText: 'Test Track' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();

  const dialog = page.getByRole('dialog', { name: /edit track/i });
  await expect(dialog.getByLabel('Tab start time (seconds)')).toHaveValue('4.5');
  await expect(dialog.getByLabel('Audio start time (seconds)')).toHaveValue('12');
});

test('saving start times from the editor persists tabStart and audioStart, not a derived offset', async ({ page }) => {
  await seedLibrary(page, {
    version: 5,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', { audioVideoId: 'dQw4w9WgXcQ' })],
    folders: [],
  });

  const trackItem = page.locator('.track-item').filter({ hasText: 'Test Track' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();

  const dialog = page.getByRole('dialog', { name: /edit track/i });
  await dialog.getByLabel('Tab start time (seconds)').fill('5');
  await dialog.locator('.section-toggle').click(); // open audio section
  await dialog.getByLabel('Audio start time (seconds)').fill('30');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();

  const saved = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('tabsync-library') ?? '{}');
    return lib.tracks?.[0];
  });
  expect(saved.tabStart).toBe(5);
  expect(saved.audioStart).toBe(30);
  expect(saved.syncOffset).toBeUndefined();
});

test('audio start time resets to 0 on save when no audio track is set', async ({ page }) => {
  await page.goto('/');
  await page.locator('#add-track-btn').click();

  const dialog = page.getByRole('dialog', { name: /add track/i });
  await dialog.getByLabel(/^title/i).fill('No Audio Track');
  await dialog.getByLabel(/^artist/i).fill('Someone');
  await dialog.getByLabel(/youtube url/i).first().fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await dialog.getByLabel('Tab start time (seconds)').fill('8');
  await dialog.getByRole('button', { name: /add track/i }).click();

  const saved = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('tabsync-library') ?? '{}');
    return lib.tracks?.[0];
  });
  expect(saved.tabStart).toBe(8);
  expect(saved.audioStart).toBe(0);
});

// ── Schema migration ──

test('v4 tracks with a positive syncOffset split into tabStart: 0, audioStart: offset', async ({ page }) => {
  await page.evaluate(() => {
    const lib = {
      version: 4,
      tracks: [{
        id: 't1', title: 'Intro Track', artist: 'Test Artist',
        tabVideoId: 'dQw4w9WgXcQ', audioVideoId: 'dQw4w9WgXcQ',
        syncOffset: 20, audioPosition: 'bottom-right', folderId: null, favourite: false,
        difficulty: null, countIn: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }],
      folders: [],
    };
    localStorage.setItem('tabsync-library', JSON.stringify(lib));
  });
  await page.reload();

  const trackItem = page.locator('.track-item').filter({ hasText: 'Intro Track' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();
  await page.getByRole('dialog', { name: /edit track/i })
    .getByRole('button', { name: 'Save Changes' }).click();

  const saved = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('tabsync-library') ?? '{}');
    return lib.tracks?.[0];
  });
  expect(saved.tabStart).toBe(0);
  expect(saved.audioStart).toBe(20);
  expect(saved.syncOffset).toBeUndefined();
});

test('v4 tracks with a negative syncOffset split into tabStart: |offset|, audioStart: 0', async ({ page }) => {
  await page.evaluate(() => {
    const lib = {
      version: 4,
      tracks: [{
        id: 't1', title: 'Mid Song Track', artist: 'Test Artist',
        tabVideoId: 'dQw4w9WgXcQ', audioVideoId: 'dQw4w9WgXcQ',
        syncOffset: -7, audioPosition: 'bottom-right', folderId: null, favourite: false,
        difficulty: null, countIn: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }],
      folders: [],
    };
    localStorage.setItem('tabsync-library', JSON.stringify(lib));
  });
  await page.reload();

  const trackItem = page.locator('.track-item').filter({ hasText: 'Mid Song Track' });
  await trackItem.hover();
  await trackItem.getByTitle('Edit track').click();
  await page.getByRole('dialog', { name: /edit track/i })
    .getByRole('button', { name: 'Save Changes' }).click();

  const saved = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('tabsync-library') ?? '{}');
    return lib.tracks?.[0];
  });
  expect(saved.tabStart).toBe(7);
  expect(saved.audioStart).toBe(0);
  expect(saved.syncOffset).toBeUndefined();
});

test('loading the app alone (no edit) writes the migrated tabStart/audioStart back to localStorage', async ({ page }) => {
  await page.evaluate(() => {
    const lib = {
      version: 4,
      tracks: [{
        id: 't1', title: 'Untouched Track', artist: 'Test Artist',
        tabVideoId: 'dQw4w9WgXcQ', audioVideoId: 'dQw4w9WgXcQ',
        syncOffset: -9, audioPosition: 'bottom-right', folderId: null, favourite: false,
        difficulty: null, countIn: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }],
      folders: [],
    };
    localStorage.setItem('tabsync-library', JSON.stringify(lib));
  });
  await page.reload();
  await expect(page.locator('.track-item').filter({ hasText: 'Untouched Track' })).toBeVisible();

  const saved = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('tabsync-library') ?? '{}');
    return { version: lib.version, track: lib.tracks?.[0] };
  });
  expect(saved.version).toBe(5);
  expect(saved.track.tabStart).toBe(9);
  expect(saved.track.audioStart).toBe(0);
  expect(saved.track.syncOffset).toBeUndefined();
});

// ── Player behaviour ──
// Uses the call-logging YT stub so we can assert on seek/play targets, not just final state.

const YT_STUB_WITH_LOG = `
  window.__ytLog = [];
  window.YT = {
    Player: class {
      constructor(id, config) {
        this._id = id;
        this._config = config;
        setTimeout(() => this._config.events?.onReady?.({ target: this }), 50);
      }
      playVideo() { window.__ytLog.push({ id: this._id, method: 'playVideo', time: Date.now() }); }
      pauseVideo() { window.__ytLog.push({ id: this._id, method: 'pauseVideo', time: Date.now() }); }
      seekTo(t) { window.__ytLog.push({ id: this._id, method: 'seekTo', time: Date.now(), arg: t }); }
      setPlaybackRate() {}
      getCurrentTime() { return 999; }
    },
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 }
  };
  setTimeout(() => window.onYouTubeIframeAPIReady?.(), 10);
`;

test('a track where the tab starts later than the audio seeks the tab player forward on load', async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', route =>
    route.fulfill({ contentType: 'text/javascript', body: YT_STUB_WITH_LOG })
  );
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  await seedLibrary(page, {
    version: 5,
    tracks: [makeTrack('t1', 'Mid Song Track', 'Test Artist', {
      audioVideoId: 'dQw4w9WgXcQ',
      tabStart: 15,
      audioStart: 0,
    })],
    folders: [],
  });

  await page.locator('.track-item').filter({ hasText: 'Mid Song Track' }).click();
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 5000 });

  const tabSeeks = await page.evaluate(() =>
    window.__ytLog.filter((e: any) => e.id === 'tab-player' && e.method === 'seekTo').map((e: any) => e.arg)
  );
  expect(tabSeeks).toContain(15);
});

test('a track where the audio starts later than the tab enters intro playback before the tab starts', async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', route =>
    route.fulfill({ contentType: 'text/javascript', body: YT_STUB_WITH_LOG })
  );
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  await seedLibrary(page, {
    version: 5,
    tracks: [makeTrack('t1', 'Intro Track', 'Test Artist', {
      audioVideoId: 'dQw4w9WgXcQ',
      tabStart: 0,
      audioStart: 20,
    })],
    folders: [],
  });

  await page.locator('.track-item').filter({ hasText: 'Intro Track' }).click();
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 5000 });

  await page.locator('#play-pause-btn').click();
  await expect(page.locator('#status')).toHaveText('Intro…', { timeout: 5000 });

  // Tab shouldn't have been told to play yet — it's waiting for the audio's intro to finish.
  const tabPlayed = await page.evaluate(() =>
    window.__ytLog.some((e: any) => e.id === 'tab-player' && e.method === 'playVideo')
  );
  expect(tabPlayed).toBe(false);
});
