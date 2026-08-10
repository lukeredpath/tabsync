# Plan: Memorisation Features — Tab Hide & A/B Loop

## Background

Discussed in brainstorming session. The core insight: the user is a strong sight-reader who never has to
commit parts to memory because the tab is always visible as a crutch. The two features below address this
directly.

---

## Feature 1: Tab Hide/Reveal

### What it does

A single toggle that blacks out the tab video while audio keeps playing uninterrupted. The user plays
from memory, then reveals the tab to check. No playback state changes.

### Keyboard shortcut

`H` — toggles hide/reveal.

### UI

- Button in the controls bar (alongside Count In), labelled "Hide Tab" / "Show Tab", with an active
  state style when hidden.
- Tab video container gets a CSS class (e.g. `tab-hidden`) that covers it with a solid black overlay
  (not `display:none` — the player must keep running).

### Implementation notes

- Pure CSS overlay on `#tab-container`. Add/remove a class via a module-level boolean in `player.js`.
- No state to persist — resets to visible whenever a new track is loaded.
- Button should be disabled when no track is loaded (consistent with other transport controls).
- Keyboard handler in the existing `keydown` switch in `initPlayer`.

### Files touched

- `index.html` — add hide button to controls bar
- `css/styles.css` — `.tab-hidden` overlay style + button active state
- `js/player.js` — toggle logic, keyboard shortcut, reset on `loadTrack`

---

## Feature 2: A/B Loop

### What it does

The user marks an in-point (`I`) and out-point (`O`) at the current playback position using keyboard
shortcuts. When loop mode is enabled and both points are set, playback seamlessly jumps back to the
in-point when it reaches the out-point.

### Session vs. persisted state

- **Loop enabled** (`loopActive`) — session only, defaults to `false` when a track is loaded. Not
  saved to the data model.
- **Loop points** (`loopStart`, `loopEnd`) — saved on the track, persisted to localStorage. Restored
  when the track is next loaded.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `I` | Set in-point at current tab player position |
| `O` | Set out-point at current tab player position |
| `L` | Toggle loop on/off |

### UI

- "Loop" button in controls bar with active state when `loopActive` is true.
- Small in/out time display next to the button (e.g. `0:32 → 1:48`) when both points are set, hidden
  otherwise. Gives feedback that markers exist.
- Setting a new in/out point while a track is playing should update immediately without interrupting
  playback.

### Loop detection mechanism

Use the existing `makeOnStateChange` / polling approach. The cleanest option is a `setInterval` check
(similar to `introWatch`) that runs only while `loopActive` is true and both points are set. Poll at
~200ms — sufficient precision for section-level looping.

When tab position >= `loopEnd`, seek both tab and audio back to their loop-start equivalents:
- `tabPlayer.seekTo(loopStart)`
- `audioPlayer.seekTo(loopStart + syncOffset)` (respects the sync model)

### Edge cases

- If `loopStart >= loopEnd`, ignore (treat as unset).
- If the user seeks manually to a position past `loopEnd` while loop is active, the loop poll will
  catch it and jump back on the next tick — acceptable behaviour.
- Rewind (`R`) should seek to `loopStart` (not track start) when loop is active and points are set.
  This makes restart behave intuitively during a practice loop.
- If loop points exist on a track but `loopActive` is false, the markers are visible in the UI but
  do nothing during playback.

### Schema migration (v3 → v4)

Add `loopStart` and `loopEnd` to the Track type:

```
loopStart: number | null   — seconds into tab video, null if unset
loopEnd:   number | null   — seconds into tab video, null if unset
```

Migration: all existing tracks get `loopStart: null, loopEnd: null`.

### Files touched

- `js/library.js` — schema v4, migration, updated typedef
- `js/player.js` — loop interval, `setLoopPoint`, toggle, keyboard shortcuts, seek adjustment,
  restart adjustment, reset on `loadTrack`
- `js/editor.js` — pass `loopStart`/`loopEnd` through on save (no UI in editor — points are set live)
- `js/store.js` — dispatch `tabsync:track-updated` after setting loop points so the cached track
  reference in player stays current
- `index.html` — loop button + in/out display in controls bar
- `css/styles.css` — loop button active state, in/out display styling
- `tests/fixtures.ts` — update Track interface and makeTrack defaults
- New test file `tests/loop.spec.ts` — cover: setting points, loop active state, UI display

---

## Implementation order

1. Schema migration (library.js + fixtures.ts) — isolated, no UI impact
2. Tab hide (player.js + index.html + styles.css) — self-contained, good warm-up
3. A/B loop core (player.js) — loop interval, seek logic, restart adjustment
4. A/B loop UI (index.html + styles.css) — button, in/out display
5. Tests

---

## Open questions / deferred

- Should `I`/`O` be settable while paused? (Probably yes — pause, find the moment, mark it.)
- Should there be a way to clear loop points? (Keyboard shortcut, or just re-mark them?)
- Could eventually combine hide + loop into a "memory drill mode" that auto-hides on loop repeat N.
