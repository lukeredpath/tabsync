# Vendored test dependencies

These are unmodified ESM builds of Alpine.js and its plugins, pinned at the
versions `js/app.js` currently loads from the jsdelivr CDN. `tests/base.ts`
routes the CDN URLs to these local files so tests never depend on jsdelivr
being reachable — with 100+ tests each loading the app, occasional CDN
slowness or errors caused intermittent CI failures (Alpine failed to
initialise, so `x-data`/`@click` never wired up and the editor dialog never
opened).

The production app (`index.html` / `js/app.js`) still loads from the CDN as
normal — only the test suite is insulated from it.

To refresh after bumping the CDN version in `js/app.js`, re-download from the
same URLs:

```
curl -s https://cdn.jsdelivr.net/npm/alpinejs@3/dist/module.esm.js -o alpine.esm.js
curl -s https://cdn.jsdelivr.net/npm/@alpinejs/persist@3/dist/module.esm.js -o persist.esm.js
curl -s https://cdn.jsdelivr.net/npm/@alpinejs/focus@3/dist/module.esm.js -o focus.esm.js
curl -s https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3/dist/module.esm.js -o collapse.esm.js
```
