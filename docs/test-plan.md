# Test Plan — Batch 2

## Context

Batch 1 (`tests/smoke.spec.ts`, `tests/library.spec.ts`) covers: page load, modal open/close, form validation, track creation, search filtering, and sidebar collapse. This batch extends coverage to track editing and deletion, folder management, favourites, and import/export — all without requiring a YouTube player mock.

## Step 0: Fixture infrastructure (prerequisite)

Create `tests/fixtures.ts` as the single source of truth for test data and seeding helpers.

**Contents:**
- `makeTrack(id, title, artist, overrides?)` — moved from `library.spec.ts`, with optional overrides for fields like `favourite`, `difficulty`, `folderId`
- `makeFolder(id, name)` — equivalent for folders
- `defaultLibrary` — a ready-made fixture: 2 tracks + 1 folder (one track in a folder, one not; one favourited, one not)
- `seedLibrary(page, library?)` — sets `localStorage` and reloads; defaults to `defaultLibrary`

Update `tests/library.spec.ts` to import `makeTrack` from fixtures instead of defining it inline.

**Note on `importLibrary` helper:** The import test inlines its file injection (`setInputFiles` with an in-memory buffer, no disk write needed) since it's only used once. Promote to fixtures if reused later.

## New test files

### `tests/tracks.spec.ts` — Track edit and delete

**Edit existing track:**
- Seed library, hover over track to reveal actions, click edit button (✎)
- Assert editor dialog opens with heading "Edit Track"
- Assert title field is pre-populated with the seeded track's title
- Change the title, click "Save Changes"
- Assert dialog closes and updated title is visible in the list

**Delete track:**
- Seed library, hover over track, click delete button (×)
- Handle `window.confirm()` via `page.once('dialog', d => d.accept())` set *before* the triggering click
- Assert track title is no longer visible in the list

### `tests/favourites.spec.ts` — Favourite toggle and filter

**Toggle favourite:**
- Seed a track (`favourite: false`)
- The favourite button has `title="Add to favourites"` when unstarred, `title="Remove from favourites"` when starred — use `getByRole('button', { name: '...' })` scoped to the track item
- Click to star, assert button name changes to "Remove from favourites"
- Click again to unstar, assert button name reverts

**Favourites view shows only starred tracks:**
- Seed two tracks (one `favourite: true`, one `favourite: false`)
- Click "Favourites" in the folder nav
- Assert only the favourited track is visible

### `tests/folders.spec.ts` — Folder create and delete

**Create folder:**
- Click "+ New folder" in the folder nav
- Assert an input appears, type a name, press Enter
- Assert the new folder name appears in the nav

**Delete folder reassigns tracks:**
- Seed a library with a folder and one track assigned to it
- Navigate to the folder view to confirm the track is visible there
- Click the delete button (×) on the folder, accept the confirm dialog
- Assert the folder is no longer in the nav
- Click "All tracks", assert the track is still visible (reassigned, not deleted)

### `tests/import-export.spec.ts` — Export and import

**Export downloads valid JSON:**
- Seed library with known tracks
- Start waiting for a download event, then click Export
- Capture the download, read its content, parse as JSON
- Assert it has `tracks` and `folders` arrays, and the seeded track titles are present

**Import replaces library:**
- Prepare a fixture library object (different from empty state)
- Accept the confirm dialog via `page.once('dialog', d => d.accept())` set before click
- Inject JSON via `page.locator('#import-file-input').setInputFiles({ name: 'library.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })`
- Assert the imported track titles are visible in the list

## Resilience notes

- **Confirm dialogs:** `page.once('dialog', d => d.accept())` set *before* the triggering click — same pattern for track delete, folder delete, and import
- **Hover-reveal actions:** `locator.hover()` on the track item before clicking ✎ or × — CSS `:hover` reveals (`display: none → flex`), Playwright maintains the hover state between calls
- **Icon-only buttons:** `getByTitle()` is the right locator for buttons whose accessible name is their text content (e.g. `✎`, `×`, `☆`) rather than their `title` attribute. `getByRole('button', { name: '...' })` will not match these — the browser's accessible name algorithm uses text content first, with `title` only as a fallback when there is no other source.
- **Folder nav items:** `getByText('...', { exact: true })` scoped to `#folder-nav` avoids matching the count badge in the same item
- **No state assertions via CSS class:** all assertions use visibility (`toBeVisible`/`toBeHidden`) or value checks

## Files changed

| File | Action |
|---|---|
| `tests/fixtures.ts` | Create — shared helpers and default library |
| `tests/library.spec.ts` | Update — import `makeTrack` from fixtures |
| `tests/tracks.spec.ts` | Create — 2 tests |
| `tests/favourites.spec.ts` | Create — 2 tests |
| `tests/folders.spec.ts` | Create — 2 tests |
| `tests/import-export.spec.ts` | Create — 2 tests |

## Verification

`npx playwright test --reporter=list` — all tests (3 smoke + 5 existing + 8 new = 16 total) pass on Chromium and WebKit.

## Deferred

**YouTube IFrame API mock** — needed to test playback controls, sync, speed adjustment. Approach: intercept the IFrame API script load with `page.route()`, inject a fake `YT` global via `page.addInitScript()` that exposes `YT.Player` as a controllable stub. Deferred because: complex to implement correctly, and existing tests already cover the non-player functionality adequately.
