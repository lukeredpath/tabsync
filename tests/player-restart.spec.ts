import { test, expect } from './base';
import { makeTrack, seedLibrary } from './fixtures';

// Richer YouTube IFrame API stub that logs every playback call with a
// timestamp, so tests can assert on the *ordering and timing* between calls
// (e.g. that a seekTo() is given time to settle before a playVideo() follows
// it) — not just on final state, which the base stub's no-op methods can't
// distinguish.
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
      getCurrentTime() { return 0; }
    },
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 }
  };
  setTimeout(() => window.onYouTubeIframeAPIReady?.(), 10);
`;

test.beforeEach(async ({ page }) => {
  // Page-level routes take precedence over the context-level stub in base.ts.
  await page.route('https://www.youtube.com/iframe_api', route =>
    route.fulfill({ contentType: 'text/javascript', body: YT_STUB_WITH_LOG })
  );
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('restarting during playback re-seeks and resumes the audio player, not just the tab player', async ({ page }) => {
  await seedLibrary(page, {
    version: 5,
    tracks: [makeTrack('t1', 'Test Track', 'Test Artist', { audioVideoId: 'dQw4w9WgXcQ' })],
    folders: [],
  });

  await page.locator('.track-item').filter({ hasText: 'Test Track' }).click();
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 5000 });

  await page.locator('#play-pause-btn').click();
  await expect(page.locator('#status')).toHaveText('Playing', { timeout: 5000 });

  await page.evaluate(() => { window.__ytLog.length = 0; });
  await page.locator('#rewind-btn').click();
  await expect(page.locator('#status')).toHaveText('Playing', { timeout: 5000 });

  const log = await page.evaluate(() => window.__ytLog);

  const audioSeek = log.find(e => e.id === 'audio-player' && e.method === 'seekTo');
  const audioResume = log.find(e => e.id === 'audio-player' && e.method === 'playVideo');
  const tabResume = log.find(e => e.id === 'tab-player' && e.method === 'playVideo');

  expect(audioSeek, 'audio player should be re-seeked on restart').toBeTruthy();
  expect(audioSeek!.arg).toBe(0);
  expect(audioResume, 'audio player should resume playing after restart').toBeTruthy();
  expect(tabResume, 'tab player should resume playing after restart').toBeTruthy();

  // Regression guard: resuming playback immediately after seekTo() races the
  // IFrame API's internal queue and can leave the audio player paused
  // instead of restarting it — resume must be deferred, as seek() already does.
  expect(audioResume!.time - audioSeek!.time).toBeGreaterThanOrEqual(100);
});
