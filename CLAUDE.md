# TabSync — Claude Context

## What this is

A local, client-side web app for musicians practising with YouTube tab videos. Plays a tab video (full screen, muted) synced with an optional original audio track (small overlay). Includes a persistent library of tracks with folders, favourites, and difficulty ratings.

See `SPEC.md` for full requirements and `PLAN.md` for the phased development plan.

## Architecture

- **Fully client-side** — no backend, no build step.
- **Persistence**: `localStorage` (versioned JSON via `library.js`).
- **YouTube IFrame API** for player control; **YouTube oEmbed** for metadata auto-fetch (no API key needed).
- Served locally via `make start` (Python 3 `http.server`), which opens Safari at `http://<hostname>.local:8080`.

## Key files

| File | Role |
|---|---|
| `index.html` | App shell and DOM structure |
| `css/styles.css` | All styles; dark/light themes via CSS custom properties |
| `js/app.js` | Entry point; wires modules together; theme logic |
| `js/library.js` | Data layer — CRUD, localStorage, schema migration |
| `js/player.js` | YouTube player wrapper and sync engine (Phase 4) |
| `js/ui-library.js` | Sidebar, folder nav, track list, search, sort (Phase 3) |
| `js/ui-editor.js` | Add/edit track modal form (Phase 3) |
| `js/utils.js` | UUID generation, YouTube URL parsing, oEmbed fetch |
| `Makefile` | `make start` / `make stop` |
| `prototype.html` | Original single-file prototype — reference only |

## Development workflow

```
make start   # serves on :8080, opens Safari
make stop    # kills the server
```

No build step. ES modules loaded directly by the browser (`type="module"`). Target browser is Safari (Chrome as fallback if Safari has ITP issues with YouTube embeds).

## Sensitive data policy

**This project must never contain sensitive data.** It is intended to be open source.

- No API keys, tokens, or credentials of any kind — ever.
- No personal data (URLs, track names, library contents) in committed files.
- `localStorage` data lives only in the browser and is never written to disk or committed.
- If YouTube API access ever becomes necessary, keys must be supplied at runtime (environment variable or user input) and must never be hardcoded or committed.

## Coding conventions

- Vanilla JS, no framework, no build step.
- ES modules throughout (`import`/`export`).
- JSDoc type annotations on public functions in `library.js` and `utils.js`.
- CSS custom properties for all theme-sensitive values — never hardcode colours.
- Keep modules focused: data layer in `library.js`, player logic in `player.js`, UI in `ui-*.js`.
