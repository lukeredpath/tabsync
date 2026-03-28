# TabSync — Specification

## What this is

A local, browser-based practice tool for musicians following tab videos on YouTube. The primary use case is playing a tab video (full screen, muted) synchronised with the original song audio (small overlay), so you can hear yourself and the original recording without the tab video's backing track. The audio track is optional — you can also use it as a simple tab video player with a persistent track library.

Works for any tab-based practice: bass, guitar, or otherwise.

---

## Architecture

- **Fully client-side** — no application server, no database. Static HTML/CSS/JS files.
- **Persistence** via `localStorage` (versioned JSON schema).
- **Served locally** via Python 3's built-in HTTP server. A `Makefile` provides `start`/`stop` targets that open the app in Safari at `http://<hostname>.local:<port>`.
- **YouTube IFrame API** for player control.
- **YouTube oEmbed API** (`https://www.youtube.com/oembed`) for auto-fetching track metadata — CORS-enabled, no API key required.
- **Alpine.js** for reactive UI — `$store.lib` is the reactive library store; `editorUI` is the add/edit track component.

---

## Data Model

### Track

| Field          | Type           | Notes                      |
| -------------- | -------------- | -------------------------- |
| `id`           | UUID string    | Generated on creation      |
| `title`        | string         | Required                   |
| `artist`       | string         | Required                   |
| `tabVideoId`   | string         | YouTube video ID, required |
| `tabStart`     | number         | Seconds, 0.1s precision    |
| `audioVideoId` | string \| null | YouTube video ID, optional |
| `audioStart`   | number         | Seconds, 0.1s precision    |
| `folderId`     | string \| null | Reference to a Folder id   |
| `favourite`    | boolean        |                            |
| `difficulty`   | 1–5 \| null    |                            |
| `countIn`      | boolean \| null | null = follow global setting |
| `createdAt`    | ISO timestamp  |                            |
| `updatedAt`    | ISO timestamp  |                            |

### Folder

| Field       | Type          | Notes |
| ----------- | ------------- | ----- |
| `id`        | UUID string   |       |
| `name`      | string        |       |
| `createdAt` | ISO timestamp |       |

Folders are flat (one level only — no subfolders).

### Storage layout

All data stored under a single `localStorage` key as a versioned JSON envelope:

```json
{
  "version": 2,
  "tracks": [...],
  "folders": [...]
}
```

Schema version is checked on load; a migration path is defined for future version bumps.

---

## Features

### Library management

- Add, edit, and remove tracks.
- Assign a track to a folder (or leave it unfoldered).
- Mark tracks as favourites.
- Set a difficulty rating (1–5).
- Create and rename folders.
- Export library as a dated JSON file; import from JSON (replaces current data with confirmation).

### Track editor / add form

- Fields for title, artist, tab video URL, tab start offset, audio video URL (optional), audio start offset.
- Start offsets accept decimal values to 0.1s precision (YouTube's `seekTo` supports fractional seconds).
- When a YouTube URL is entered, auto-fetch title and artist via oEmbed and pre-populate the form fields. User can override.
- Validation: tab video URL is required; audio URL is optional but if provided must be a valid YouTube URL.

### Library UI (sidebar/panel)

- Collapsible panel — collapses automatically when a track begins playing; can be reopened without stopping playback.
- Folder navigation: "All tracks", "Favourites", then one entry per folder.
- Track list within the current view, with:
  - Title and artist
  - Difficulty indicator (if set)
  - Favourite star
  - Edit / delete actions
- Search bar: basic substring match across title and artist (case-insensitive).
- Sort options: title A–Z, artist A–Z, difficulty, recently added.
- Difficulty filter: click a dot to show only tracks up to that difficulty.
- Empty states for no tracks, no search results, empty folders.

### Player

- **Tab video**: fills the main stage area, muted if an audio video is configured.
- **Audio video**: small draggable overlay (bottom-right default position), visible only when an audio video is configured. Drag with mouse or touch; position persists across track changes.
- **Sync engine**: none — both players are started simultaneously and left to play freely. No automatic seeking during playback; any drift is accepted rather than risk interrupting practice with a jump.
- **Controls**:
  - Play / Pause
  - Restart (seek both players to their configured start offsets)
  - Skip −5s / +5s
  - Playback speed: 0.5×, 0.75×, 1×, 1.25× (persisted)
  - Count-in toggle: 3-second countdown overlay before playback from start (persisted); per-track override available in the editor (`null` = follow global, `true`/`false` = force on/off)
- **Keyboard shortcuts**:
  - `Space` — play/pause
  - `←` / `→` — skip ±5s
  - `R` — restart

### Theming

- Light and dark colour schemes, implemented via CSS custom properties.
- Defaults to the system preference (`prefers-color-scheme`).
- A toggle button in the sidebar header lets the user override; the choice is persisted in `localStorage`.

---

## Known constraints

- `controls: 0` is broken for non-partner embeds — must use `controls: 1`.
- `start` playerVar is integer-only; use `seekTo()` in `onReady` for fractional precision.
- The audio overlay wrapper div must have explicit `width: 100%; height: 100%` or the iframe renders at zero size.
- Some videos have embedding disabled by the uploader; the player surfaces this as a readable error rather than silently failing.
- Safari support depends on YouTube's embed policy — Chrome is the known-good target browser.

---

## Deferred

- **Auto sync-point detection**: scan the start of both videos to find a matching audio cue and auto-set offsets. Would require YouTube Data API (no free waveform access) or a user-assisted UI.

---

## Makefile targets

| Target        | Description                                                                            |
| ------------- | -------------------------------------------------------------------------------------- |
| `make start`  | Start Python 3 HTTP server (port 8080), open `http://<hostname>.local:8080` in Safari |
| `make stop`   | Kill the server process                                                                |
| `make serve`  | Headless server only (no browser open) — used by Playwright                           |
| `make test`   | Run Playwright tests, then open report                                                 |

Port is configurable via a `PORT` variable (default `8080`).
