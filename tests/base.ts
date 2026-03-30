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
  context: async ({ context }, use) => {
    // Hard-block all outbound YouTube requests (registered first = lower priority).
    await context.route('https://*.youtube.com/**', route => route.abort());
    // Serve the stub in place of the real IFrame API script (registered last = wins).
    await context.route('https://www.youtube.com/iframe_api', route =>
      route.fulfill({ contentType: 'text/javascript', body: YT_STUB })
    );
    await use(context);
  },
});

export { expect };
