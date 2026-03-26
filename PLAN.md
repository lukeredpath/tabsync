# TabSync — Development Plan

## Tech Stack

| Concern          | Choice                        | Rationale                                                      |
| ---------------- | ----------------------------- | -------------------------------------------------------------- |
| Markup / styling | HTML + CSS (vanilla)          | No build step, no dependencies                                 |
| Logic            | Vanilla JS (ES modules)       | Sufficient for this scale; no framework overhead               |
| Persistence      | `localStorage`                | Zero-dependency, fits a personal library of hundreds of tracks |
| YouTube playback | IFrame API (CDN)              | Required for player control                                    |
| Metadata fetch   | YouTube oEmbed (CORS-enabled) | No API key needed                                              |
| Local server     | Python 3 `http.server`        | Always available on macOS                                      |
| Task runner      | `make`                        | Universal on macOS                                             |

---

## File Structure

```
tabsync/
  index.html          # App shell and layout
  css/
    styles.css        # All styles
  js/
    app.js            # Entry point, wires everything together
    library.js        # Data layer: CRUD, localStorage, schema migration
    player.js         # YouTube player wrapper, sync engine
    ui-library.js     # Library panel rendering and interaction
    ui-editor.js      # Add/edit track form
    utils.js          # UUID generation, YouTube URL parsing, oEmbed fetch
  Makefile
  .server.pid         # Written by `make start`, consumed by `make stop` (gitignored)
  .gitignore
```

ES modules (`type="module"`) — no bundler needed in modern Chrome.

---

## Phases

### Phase 1 — Project scaffold ✅

- [x] Create directory structure and placeholder files
- [x] `Makefile` with `start` and `stop` targets
- [x] `.gitignore` (`.server.pid`, `.deleted/`)
- [x] `index.html` shell with layout regions: sidebar, stage, controls bar
- [x] `styles.css` skeleton with dark/light themes via CSS custom properties (`prefers-color-scheme` default + `data-theme` override; three-state toggle ⊙/☀/☾ persists to `localStorage`)

---

### Phase 2 — Data layer (`library.js`) ✅

Delivered alongside Phase 1 scaffold.

- [x] JSDoc types for `Track` and `Folder`
- [x] `loadLibrary()` / `saveLibrary()` with graceful error handling
- [x] Schema version check with stub migration path
- [x] CRUD: `createTrack`, `updateTrack`, `deleteTrack`
- [x] CRUD: `createFolder`, `updateFolder`, `deleteFolder` (orphans tracks)
- [x] Query helpers: `getTracksByFolder`, `getFavourites`, `searchTracks`
- [x] `exportLibrary()` / `importLibrary()` stubs

---

### Phase 3 — Library UI (`ui-library.js`) + Editor (`ui-editor.js`) ✅

- [x] Sidebar collapse/expand (CSS transition, `#sidebar.collapsed`)
- [x] Folder nav: "All tracks", "Favourites", per-folder entries, inline create/rename/delete
- [x] Track list: title, artist, difficulty badge, favourite star toggle, edit/delete actions
- [x] Search bar (real-time, case-insensitive)
- [x] Sort strip: recently added / title A–Z / artist A–Z / difficulty
- [x] Empty states (context-aware message per view)
- [x] Track click dispatches `tabsync:track-selected` (ready for Phase 4)
- [x] Add/edit modal (`ui-editor.js`): oEmbed auto-fetch on tab URL blur, start offset inputs (0.1s step), folder select, difficulty picker (1–5, clearable), favourite toggle, validation
- [x] Inter-module communication via `CustomEvent` on `document` (`tabsync:` namespace)
- [x] Auto-collapse sidebar on `tabsync:playback-started` (ready for Phase 4)

---

### Phase 4 — Player (`player.js`) ✅

- [x] YouTube IFrame API bootstrap (inject script tag, `window.onYouTubeIframeAPIReady`)
- [x] `loadTrack(track)` — increments `loadId` stale guard, tears down old iframes, builds new players
- [x] Seek to fractional start offsets via `seekTo` in `onReady`; integer `start` playerVar as hint
- [x] Mute tab player when audio video present; unmuted for tab-only
- [x] Show/hide `#audio-container` based on whether audio video is configured
- [x] Sync engine: wall-clock anchor, 1s interval, 0.4s drift threshold (no-op for tab-only)
- [x] Controls: play/pause, restart, ±5s skip
- [x] Keyboard shortcuts: Space, ←/→, R (ignored when input/select focused)
- [x] Draggable audio overlay; position persists across track changes
- [x] `tabsync:playback-started` dispatched on `play()` → sidebar auto-collapses
- [x] Error handling: YouTube error codes mapped to readable messages; controls stay disabled
- [x] `pendingTrack` path for track selected before API network response returns

---

### Phase 5 — Polish

- [ ] Responsive layout (sidebar collapses to icon bar at narrow widths, if needed)
- [ ] Visual feedback: currently playing track highlighted in library
- [ ] Confirmation dialog before deleting a track or folder
- [ ] Graceful handling of YouTube API not ready (button disabled until API fires)
- [ ] `onTabStateChange` — pause both players when tab video ends
- [ ] Difficulty filter in sidebar
- [ ] Favourites star click directly in track list (without opening editor)

**Exit criteria**: app feels complete and stable for daily use.

---

### Phase 6 — Stretch goals (deferred, no schedule)

- **Export / import**: Download library as a JSON file; import from a JSON file (merge or replace). This is the primary backup/migration path given data lives in localStorage.
- **Auto sync-point detection**: Scan the first N seconds of both videos to find a matching audio cue and suggest offsets automatically. Requires either the YouTube Data API (audio waveform access) or a user-assisted UI where two cursors are moved to the same moment in each video.

---

## Notes

- **Browser**: Target Safari (the Makefile opens it directly). ITP was a known blocker during early prototyping but this will be verified in testing. Chrome is a fallback if Safari proves problematic.
- **Data fragility**: `localStorage` is cleared if the user wipes browser data. The export feature (Phase 6) is the mitigation. Until that's built, users should be aware of this limitation.
- **YouTube embedding**: Some videos have embedding disabled by the uploader. The player should surface this error clearly rather than silently failing.
