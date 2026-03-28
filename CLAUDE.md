# TabSync — Claude Context

## What this is

A local, client-side web app for musicians practising with YouTube tab videos. Plays a tab video (full screen, muted) synced with an optional original audio track (small overlay). Includes a persistent library of tracks with folders, favourites, and difficulty ratings.

See `SPEC.md` for full requirements.

## Architecture

- **Fully client-side** — no backend, no build step.
- **Persistence**: `localStorage` (versioned JSON via `library.js`).
- **YouTube IFrame API** for player control; **YouTube oEmbed** for metadata auto-fetch (no API key needed).
- **Alpine.js** for reactive UI — `$store.lib` (in `js/store.js`) is the reactive library store; `editorUI` (in `js/editor.js`) is the add/edit track Alpine component.
- Served locally via `make start` (Python 3 `http.server`), which opens Safari at `http://<hostname>.local:8080`.

## Key files

| File | Role |
|---|---|
| `index.html` | App shell and DOM structure |
| `css/styles.css` | All styles; dark/light themes via CSS custom properties |
| `js/app.js` | Entry point; wires modules together; theme logic |
| `js/library.js` | Data layer — CRUD, localStorage, schema migration |
| `js/player.js` | YouTube player wrapper and playback controls |
| `js/store.js` | Alpine.js reactive store (`$store.lib`) — library UI state |
| `js/editor.js` | Alpine.js component (`editorUI`) — add/edit track modal |
| `js/utils.js` | UUID generation, YouTube URL parsing, oEmbed fetch |
| `Makefile` | `make start` / `make stop` / `make serve` / `make test` |
| `playwright.config.ts` | Playwright test configuration |
| `tests/` | Playwright test suite |

## Development workflow

```
make start   # serves on :8080, opens Safari
make stop    # kills the server
make serve   # headless server only (no browser open) — used by Playwright
make test    # run tests then open report — for manual use only (hangs in automation)
```

**Running tests programmatically:** use `npx playwright test` directly. `make test` appends `npx playwright show-report` which opens a browser and hangs.

No build step. ES modules loaded directly by the browser (`type="module"`). Target browser is Chrome (Safari may have issues depending on YouTube's embed policy).

## Testing

Playwright is used for browser-based testing. Tests run against both Chromium and WebKit.

- Tests live in `tests/` as `.spec.ts` files.
- Node/npm are managed via `mise` (`mise.toml` pins `node = "latest"`).
- A GitHub Actions workflow (`.github/workflows/playwright.yml`) runs the suite on every push/PR to `main`.
- Playwright uses isolated browser contexts — it never touches the user's real browser storage.
- Each test file should call `localStorage.clear()` in `beforeEach` to ensure clean state.
- The `playwright-skill` Claude plugin is enabled for exploratory browser automation during development.
- After every `git push`, a background hook monitors the corresponding GitHub Actions run and wakes Claude if it fails — Claude will then ask whether to investigate and fix the error. This is configured in `.claude/settings.local.json` (not committed).

## Sensitive data policy

**This project must never contain sensitive data.** It is intended to be open source.

- No API keys, tokens, or credentials of any kind — ever.
- No personal data (URLs, track names, library contents) in committed files.
- `localStorage` data lives only in the browser and is never written to disk or committed.
- If YouTube API access ever becomes necessary, keys must be supplied at runtime (environment variable or user input) and must never be hardcoded or committed.

## Commit conventions

All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>: Capitalised description
```

Common types: `feat`, `fix`, `docs`, `test`, `chore`, `ci`, `refactor`, `style`, `perf`, `build`.

The first word after the `type:` prefix must be capitalised.

## Coding conventions

- Vanilla JS + Alpine.js, no build step.
- ES modules throughout (`import`/`export`).
- JSDoc type annotations on public functions in `library.js` and `utils.js`.
- CSS custom properties for all theme-sensitive values — never hardcode colours.
- Keep modules focused: data layer in `library.js`, player logic in `player.js`, Alpine store in `store.js`, Alpine editor component in `editor.js`.
