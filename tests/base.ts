import { test as base, expect } from '@playwright/test';

// Minimal YouTube IFrame API stub — intercepts the real script on every test page
// so no requests ever reach YouTube's CDN.
const YT_STUB = `
  window.YT = {
    Player: class {
      constructor(id, config) {
        this._config = config;
        setTimeout(() => this._config.events?.onReady?.({ target: this }), 50);
      }
      playVideo() {}
      pauseVideo() {}
      seekTo() {}
      setPlaybackRate() {}
      getCurrentTime() { return 0; }
    },
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 }
  };
  setTimeout(() => window.onYouTubeIframeAPIReady?.(), 10);
`;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://www.youtube.com/iframe_api', route =>
      route.fulfill({ contentType: 'text/javascript', body: YT_STUB })
    );
    await use(page);
  },
});

export { expect };
