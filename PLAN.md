# TabSync — Development Plan

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Markup / styling | HTML + CSS (vanilla) | No build step, no dependencies |
| Logic | Vanilla JS (ES modules) | Sufficient for this scale; no framework overhead |
| Persistence | `localStorage` | Zero-dependency, fits a personal library of hundreds of tracks |
| YouTube playback | IFrame API (CDN) | Required for player control |
| Metadata fetch | YouTube oEmbed (CORS-enabled) | No API key needed |
| Local server | Python 3 `http.server` | Always available on macOS |
| Task runner | `make` | Universal on macOS |

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

### Phase 1 — Project scaffold

- [ ] Create directory structure and placeholder files
- [ ] `Makefile` with `start` and `stop` targets
  - `start`: launches `python3 -m http.server $PORT`, writes PID to `.server.pid`, opens `http://$(hostname -s).local:$PORT` in Safari
  - `stop`: reads `.server.pid`, kills the process, removes the file
- [ ] `.gitignore` (`.server.pid`, `.deleted/`)
- [ ] `index.html` shell with layout regions: sidebar, stage, controls bar
- [ ] `styles.css` skeleton with dark/light themes via CSS custom properties (`prefers-color-scheme` default + `data-theme` override; toggle button persists choice to `localStorage`)

**Exit criteria**: `make start` serves the page; layout regions are visible.

---

### Phase 2 — Data layer (`library.js`)

- [ ] Define TypeScript-style JSDoc types for `Track` and `Folder`
- [ ] `loadLibrary()` — read and parse from localStorage; handle missing/malformed data gracefully
- [ ] `saveLibrary()` — serialise and write back
- [ ] Schema version check; stub migration path for future version bumps
- [ ] CRUD: `createTrack`, `updateTrack`, `deleteTrack`
- [ ] CRUD: `createFolder`, `updateFolder`, `deleteFolder` (cascade: unassign tracks in deleted folder)
- [ ] Query helpers: `getTracksByFolder`, `getFavourites`, `searchTracks(query)`

**Exit criteria**: data layer unit-testable in the browser console with no UI wired up.

---

### Phase 3 — Library UI (`ui-library.js`)

- [ ] Sidebar panel with collapse/expand (CSS transition)
- [ ] Folder list: "All tracks", "Favourites", then one entry per folder, plus "New folder" action
- [ ] Track list rendering (title, artist, difficulty badge, favourite star, edit/delete)
- [ ] Search bar wired to `searchTracks`
- [ ] Sort controls (title, artist, difficulty, recently added)
- [ ] Empty states
- [ ] Clicking a track fires a `track:select` event (consumed by player in Phase 4)
- [ ] Add/edit track form (`ui-editor.js`):
  - URL input with oEmbed auto-fetch on blur
  - Start offset inputs (step 0.1)
  - Folder selector
  - Favourite toggle
  - Difficulty picker (1–5 or unset)
  - Save / Cancel

**Exit criteria**: full library management works; track data persists across page reloads.

---

### Phase 4 — Player (`player.js`)

- [ ] Port YouTube IFrame API setup and dual-player construction from prototype
- [ ] `loadTrack(track)` — builds/replaces players for the given track config
- [ ] Seek to start offsets via `seekTo` in `onReady`
- [ ] Mute tab player when audio video is present
- [ ] Show/hide audio overlay based on whether audio video is configured
- [ ] Sync engine: wall-clock anchor, 1s interval, 0.4s drift threshold
- [ ] Controls: play/pause, restart, ±5s skip
- [ ] Keyboard shortcuts: Space, ←/→, R
- [ ] Draggable audio overlay (ported from prototype)
- [ ] Auto-collapse library panel on play; re-open button remains accessible
- [ ] Error handling: embed-disabled video message

**Exit criteria**: selecting a track from the library loads and plays it with correct sync behaviour.

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
