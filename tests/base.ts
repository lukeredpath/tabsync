import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Vendored copies of Alpine.js and its plugins, served in place of the live
// jsdelivr CDN on every test page load. app.js imports these by exact URL, and
// with 100+ tests each loading the page, occasional jsdelivr slowness/errors
// caused intermittent CI failures (Alpine never initialising, so the editor
// dialog never opened). See tests/vendor/README.md.
const ALPINE_CDN_ROUTES: Record<string, string> = {
  'https://cdn.jsdelivr.net/npm/alpinejs@3/dist/module.esm.js': 'alpine.esm.js',
  'https://cdn.jsdelivr.net/npm/@alpinejs/persist@3/dist/module.esm.js': 'persist.esm.js',
  'https://cdn.jsdelivr.net/npm/@alpinejs/focus@3/dist/module.esm.js': 'focus.esm.js',
  'https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3/dist/module.esm.js': 'collapse.esm.js',
};

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

    for (const [url, file] of Object.entries(ALPINE_CDN_ROUTES)) {
      const body = fs.readFileSync(path.join(__dirname, 'vendor', file), 'utf-8');
      await context.route(url, route =>
        route.fulfill({ contentType: 'application/javascript', body })
      );
    }

    await use(context);
  },
});

export { expect };
