# TabSync

A local web app for musicians who practise with YouTube tab videos. Load a tab video alongside the original song audio, keep them in sync, and build a persistent library of tracks so you can jump straight into practising.

Works for any tab-based practice — bass, guitar, or otherwise.

![TabSync screenshot](screenshot.png)

## Features

### Library
- Add tracks with a title, artist, tab video URL, and optional audio track URL
- Set independent start offsets for each video to the nearest 0.1 second, so both begin at exactly the right moment
- Organise tracks into folders
- Mark tracks as favourites for quick access
- Set a difficulty rating (1–5)
- Search across titles and artists; sort by title, artist, difficulty, or recently added
- Track metadata (title and artist) is auto-fetched from YouTube when you paste a URL

### Player
- Tab video fills the main area; if you've added an audio track, it plays in a small draggable overlay with the tab video muted
- Play, pause, restart, and skip ±5 seconds with on-screen controls or keyboard shortcuts
- Both videos start together from their configured offsets

### Keyboard shortcuts
| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `R` | Restart from beginning |
| `←` | Skip back 5 seconds |
| `→` | Skip forward 5 seconds |

### Other
- Light and dark themes, following your system preference by default with a manual override
- All data stored locally in your browser — nothing is sent to any server
- Works in Chrome; Safari support depends on your version and YouTube's embed policy

## Requirements

- Python 3 (for the local server — included with macOS)
- A modern browser (Chrome recommended)

## Getting started

```bash
git clone https://github.com/lukeredpath/tabsync.git
cd tabsync
make start
```

This starts a local server on port 8080 and opens the app in Safari. To use a different port:

```bash
make start PORT=9000
```

To stop the server:

```bash
make stop
```

## How it works

TabSync is a fully client-side web app — there is no backend. Your track library is stored in your browser's `localStorage`. The YouTube IFrame API handles video playback.

Because data lives in `localStorage`, it is tied to the browser profile you use. If you clear your browser data, your library will be lost. An export/import feature is planned to provide a backup path.

## Planned features

- Export and import your library as JSON (backup / migration between machines)
- Auto-detect the correct sync offset by scanning the start of each video
- Per-track count-in default (override the global toggle on a track-by-track basis)

## License

MIT — see [LICENSE](LICENSE).
