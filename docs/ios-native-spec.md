# TabSync iOS — Native App Feasibility & High-Level Spec

> Status: **exploration / not started.** This is a planning document, not a
> commitment. It captures the intended architecture for a native iOS version of
> TabSync so the work can be picked up later. No iOS code exists yet.

## Goal

A native iOS app that reproduces the TabSync practice experience: play a tab
video (full screen, muted) synced with an optional original-audio video (small
overlay), backed by a persistent library of tracks with folders, favourites and
difficulty ratings.

"Native" here means **everything except playback** is native — library
management, the track editor, transport controls, sync logic, and storage. Video
playback itself stays inside a web view running YouTube's IFrame player (see
below for why this is unavoidable).

Intended primarily for **personal use**. App Store distribution is possible but
not a goal, so App Store review constraints (e.g. the "minimum functionality"
guideline) are not design drivers.

## The defining constraint: YouTube playback must use a WebView

There is no native iOS SDK for playing YouTube content. Direct streaming or
audio extraction is not permitted and is technically blocked. The only
sanctioned way to play YouTube in an app is to embed the **YouTube IFrame
player inside a `WKWebView`** — which is exactly what the web app already does.
Google's own `youtube-ios-player-helper` is just a thin WebView wrapper around
the same IFrame API.

Consequence: the iOS app is a **native shell around a WebView-hosted player**.
The WebView is treated as a "dumb" playback surface; all decisions live in
native code.

## Architecture

```
SwiftUI views  (Library, Editor, Player UI)
      │
The Composable Architecture (TCA)  — features, state, effects
      │   commands ↓        ↑ player events
YouTubePlayerView ×2  (UIViewRepresentable → WKWebView)
      │
  minimal bundled HTML page running the YouTube IFrame API
```

- **UI:** SwiftUI.
- **State & logic:** **The Composable Architecture** (Point-Free). Library,
  editor, and player become composable reducers with well-defined
  state/actions, which suits the porting of `player.js`'s state machine.
- **Playback surface:** a `UIViewRepresentable` wrapping `WKWebView`, one per
  player. The web view loads a small bundled HTML file whose only job is to
  create one `YT.Player` and expose a command/event bridge. **Two separate
  `WKWebView`s** (one tab, one audio) rather than two iframes in one view.
- **Bridge:**
  - Swift → JS via `evaluateJavaScript` (`load / play / pause / seekTo /
    setPlaybackRate`).
  - JS → Swift via `window.webkit.messageHandlers` + `WKScriptMessageHandler`
    (the IFrame `onReady` / `onStateChange` / `onError` callbacks, plus current
    time).
- **Sync engine:** the logic currently in `player.js` (intro-watch for positive
  sync offsets, drift resync, count-in, restart, skip) is the subtle, bug-prone
  heart of the app. The preferred approach is to **share this JS between web and
  native** rather than reimplement it in Swift — see "Sharing the player core"
  below. TCA orchestrates by sending high-level commands to the shared core and
  reacting to its events.

## Sharing the player core between web and native

A stated goal is to **share the core JavaScript player logic** between the web
app and the iOS app, so the tricky sync engine has a single source of truth and
can't drift between platforms. This is achievable but requires a refactor of the
current code.

**Prerequisite refactor (benefits the web app too):** `player.js` today mixes
two concerns — the *sync/transport state machine* and *DOM wiring* (cached
element refs, button text, status messages, `CustomEvent` dispatch). To share
it, split it into:

- **`player-core.js`** — a DOM-free, framework-agnostic module: the state
  machine + sync engine. It talks to players through an injected **player
  adapter interface** (`play / pause / seekTo / setRate / getCurrentTime` +
  ready/state/error callbacks) and emits high-level events. No `document`, no
  `window`, no DOM.
- **Platform adapters:**
  - *Web:* wires `player-core` to the existing IFrame `YT.Player`s and to the
    DOM (current behaviour, minus the embedded logic).
  - *iOS:* wires `player-core` to the WebView-hosted IFrame players via the
    native bridge.

**Where the shared core runs on iOS — open question, ties into the dual-player
risk:**

- *Option 1 — one WebView hosting both iframes + the core.* Maximum reuse:
  `player-core.js` runs in the page, controls both `YT.Player`s directly, and
  exposes only a high-level command/event bridge to Swift. The cost is that this
  pushes toward **two iframes in a single `WKWebView`**, which is the riskier
  arrangement for simultaneous playback (see risks).
- *Option 2 — core in a JavaScriptCore context, two separate WebViews.* The
  pure `player-core.js` runs in a `JSContext` with no players of its own; native
  relays its adapter calls to **two separate `WKWebView`s**. Keeps the safer
  two-WebView playback arrangement while still sharing the logic. Cost: must shim
  `setTimeout`/`setInterval` (or make the core tick-driven so native owns the
  clock) since JavaScriptCore has no timers.

Both preserve the "one sync implementation" goal; they differ in the
playback-reliability vs. plumbing trade-off. **The spike should test both player
arrangements** so this can be decided on evidence rather than guesswork.

## Storage

Two-phase plan:

1. **Phase 1 — JSON on disk.** Encode/decode the library to a JSON file in the
   **same versioned-envelope format the web app uses** (`{ version, tracks,
   folders }`, currently schema v4). This gives a working store quickly and —
   importantly — makes the library **interchangeable with the web app** via
   export/import. The web app's `migrate()` logic has a direct Swift analogue.
2. **Phase 2 — SQLiteData.** Migrate persistence to Point-Free's **SQLiteData**
   library once the app is established. JSON import/export is retained as the
   web↔native interchange format.

Keeping the on-disk JSON byte-compatible with the web schema is a deliberate
design property, not an accident — it preserves a migration/interop path in both
directions.

## Data model

Ported directly from the web app (`SPEC.md` is the source of truth):

- **Track:** `id`, `title`, `artist`, `tabVideoId`, `audioVideoId?`,
  `syncOffset`, `folderId?`, `favourite`, `difficulty? (1–5)`, `countIn?`
  (null = follow global), `audioPosition`, `createdAt`, `updatedAt`.
- **Folder:** `id`, `name`, `createdAt`. Flat (no subfolders).
- `syncOffset` semantics unchanged: positive = audio has an intro the tab omits;
  negative = tab starts mid-song; 0 = in sync from the start.

## Feature scope

**v1 (core practice loop):**

- Track library list with search and sort.
- Add/edit track, including YouTube URL → metadata auto-fetch via **oEmbed**
  (`URLSession` + the existing title-parsing logic from `utils.js`).
- Player: tab video full-screen + muted, audio video overlay, sync offset
  handling, play/pause, restart, skip ±5s, playback speed, count-in.
- JSON library persistence (Phase 1).

**Deferrable past v1:** folders, favourites filtering, difficulty filter,
draggable/repositionable audio overlay (a SwiftUI `DragGesture` — simpler than
the DOM version), import/export UI, theming (iOS handles light/dark natively),
SQLiteData migration (Phase 2).

**Not applicable:** keyboard shortcuts (replaced by on-screen controls /
gestures).

## Known risks & limitations

1. **Two simultaneous IFrame players on a real device — the #1 risk.** iOS is
   historically restrictive about concurrent inline media. Requires
   `allowsInlineMediaPlayback = true` and
   `mediaTypesRequiringUserActionForPlayback = []`, and must be proven on a
   physical device. **This gates the whole concept** and is the first thing to
   spike (see below). It also interacts with the JS-sharing decision: two iframes
   in one WebView maximises code reuse but is the riskier playback arrangement;
   two separate WebViews is safer but splits the JS context.
2. **No background / locked-screen playback.** YouTube's IFrame player suspends
   when the WebView backgrounds and YouTube prevents background audio; no
   entitlement changes this. Design for foreground-only practice (e.g.
   `UIApplication.shared.isIdleTimerDisabled = true` while a track is loaded to
   keep the screen awake).
3. **Forced player controls / disabled embeds carry over.** `controls: 1` is
   required for non-partner embeds, and owner-disabled embeds still fail — same
   IFrame, same constraints as the web app.

## First step: de-risk spike

Before building any library or storage layer, build a throwaway spike:

> A minimal SwiftUI app that plays two YouTube videos together with a play
> button, a sync-offset value, and a speed control — run on a **physical
> iPhone**. Test **both player arrangements**: two iframes in one `WKWebView`,
> and two separate `WKWebView`s.

If two videos play together with controllable speed and offset, the concept is
validated and the rest is a conventional SwiftUI + TCA app. If they don't, that
is learned cheaply before investing in the surrounding app. The result also
decides where the shared JS core runs (one-WebView vs. JavaScriptCore + two
WebViews).

## Notes for whoever picks this up

- The web app's `player.js` is the reference implementation for the sync engine.
  The intro-phase and resync behaviour is subtle — prefer extracting a shared
  `player-core.js` (see "Sharing the player core") over reimplementing it.
- `utils.js` (`extractVideoId`, `parseVideoTitle`, `fetchOEmbed`) ports almost
  verbatim.
- Keep the JSON schema in lockstep with the web app; bump versions together.
