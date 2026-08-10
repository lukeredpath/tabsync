# TabSync iOS — Native App Feasibility & High-Level Spec

> Status: **de-risk spike complete and wrapped up — real app not started.**
> This is still a planning document, not a commitment. It captures the
> intended architecture for a native iOS version of TabSync so the work can be
> picked up later. Every question the spike set out to answer has been
> answered (see "Known risks & limitations"); the spike's throwaway code has
> been deleted per its own README — this document is the durable record of
> what it found.

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
The WebView is treated as a "dumb" playback surface; all sync/transport
decisions live in native code.

## Architecture

```
SwiftUI views  (Library, Editor, Player UI)
      │
The Composable Architecture (TCA)  — features, state, effects
      │   commands ↓        ↑ player events
Native Swift sync coordinator  (ported from js/player.js — see below)
      │   play / pause / seek / setRate ↓     ↑ ready / state / currentTime
YouTubePlayer ×2  (YouTubePlayerKit — one per WKWebView, tab + audio)
```

- **UI:** SwiftUI.
- **State & logic:** **The Composable Architecture** (Point-Free). Library,
  editor, and player become composable reducers with well-defined
  state/actions.
- **Playback surface:** [YouTubePlayerKit](https://github.com/SvenTiigi/YouTubePlayerKit)
  (Sven Tiigi, MIT) — see "Player library" below for why this is used instead
  of a bespoke WKWebView wrapper. **Two `YouTubePlayer` instances** (tab,
  audio), each backed by its own `WKWebView` — never two iframes sharing one
  WebView (see risk #1).
- **Bridge:** YouTubePlayerKit's own `async`/`await` (`play() / pause() /
  seek(to:) / set(playbackRate:)`) + Combine (`statePublisher`,
  `playbackStatePublisher`, `currentTimePublisher`) API. No custom
  `WKScriptMessageHandler`/JS bridge needed — see "Player library" below.
- **Sync engine:** the logic in `player.js` (intro-watch for a positive
  `audioStart - tabStart` offset, drift resync, count-in, restart, skip) is
  the subtle, bug-prone heart of the app. **Re-implemented natively in Swift**
  against YouTubePlayerKit's API rather than shared as JS — see "Player
  library" below for why. TCA orchestrates by sending high-level commands to
  the coordinator and reacting to its published state.

## Player library: adopt YouTubePlayerKit, port the sync engine to Swift

**Decision:** use YouTubePlayerKit as the WKWebView/IFrame-API wrapper layer
instead of building or maintaining a custom one, and **re-implement** the
sync/offset state machine natively in Swift on top of it rather than sharing
`player.js` literally via JavaScriptCore (the originally planned approach).

**Why not build a custom wrapper:** a general-purpose single-player WKWebView
wrapper isn't where TabSync's actual value is — YouTubePlayerKit already
covers that (captions, playlists, thumbnails, volume, fullscreen, all via a
modern `async`/`await` + Combine API) and defaults to a real non-`youtube.com`
`originURL`, avoiding the `baseURL` bug found below. It also already solved
several rough edges (event bridging, JS bootstrap templating) a bespoke
wrapper would need to re-solve. Its README states "Simultaneous playback of
multiple YouTube players is not supported" with no elaboration found in its
source, issues, or docs — **investigated and found not to apply to TabSync's
actual use case**: it's about two simultaneously *audible* players (a plain
iOS single-active-audio-route constraint that would affect any implementation
equally), not TabSync's pattern of one muted + one audible, which works fine
once you know to mute the tab player before calling `play()`.

**Why not share the literal JS core (the original plan):** the sync/intro-watch
algorithm turned out to be simple enough that it ported cleanly to Swift
*twice* during the spike — once against a raw WKWebView bridge, once against
YouTubePlayerKit's `async`/Combine API — with no loss of fidelity either time.
A native Swift port avoids the JavaScriptCore/timer-shimming cost the shared-JS
plan would have required, and is easier for whoever maintains the iOS app to
read and debug than a shared JS module running inside a `JSContext`. The
"single source of truth" goal is instead served by keeping the *algorithm*
identical and well-commented in both `player.js` and its native port, not by
sharing a file.

**Validated**, both directions of the sync-offset split (`tabStart`/
`audioStart`, current schema):
- Tab has the intro (`tabStart > audioStart`, e.g. "Leave The Door Open"):
  immediate simultaneous start, tab pre-seeked forward. Worked first try, in
  the iOS Simulator.
- Audio has the intro (`audioStart > tabStart`, e.g. "Wait For The Moment"):
  audio plays alone, tab held muted/paused, intro-watch hands off once audio
  crosses the offset. **Found and fixed a real porting bug here** (see risk
  #3), in the iOS Simulator; once fixed, matches the web app's behaviour.
- Concurrent playback itself (the precondition for the above), YouTube
  Premium sign-in, ad-free playback, and account verification were all
  separately confirmed on a **physical device** (see risks #1 and #5).
  Physical-device re-confirmation of the sync-offset logic specifically
  (as opposed to concurrent playback / login, both separately confirmed)
  was not explicitly re-run before the spike was wrapped up — low risk given
  simulator WebKit exercises the same seek/play/pause logic against real
  YouTube videos, but worth a quick re-check early in real-app development.

## Storage

Two-phase plan:

1. **Phase 1 — JSON on disk.** Encode/decode the library to a JSON file in the
   **same versioned-envelope format the web app uses** (`{ version, tracks,
   folders }`, currently schema **v5**). This gives a working store quickly and
   — importantly — makes the library **interchangeable with the web app** via
   export/import. The web app's `migrate()` logic has a direct Swift analogue.
2. **Phase 2 — SQLiteData.** Migrate persistence to Point-Free's **SQLiteData**
   library once the app is established. JSON import/export is retained as the
   web↔native interchange format.

Keeping the on-disk JSON byte-compatible with the web schema is a deliberate
design property, not an accident — it preserves a migration/interop path in both
directions. **Keep this in sync as the web schema evolves** — it changed twice
during this spike alone (`tabStart`/`audioStart` → `syncOffset` → back to
`tabStart`/`audioStart`, v3→v5); check `js/library.js`'s `migrate()` for the
current shape before building the Swift model, don't trust this document's
field list to still be current.

## Data model

Ported directly from the web app (`SPEC.md` and `js/library.js`'s JSDoc are
the source of truth — re-check them, this schema has changed twice already):

- **Track:** `id`, `title`, `artist`, `tabVideoId`, `audioVideoId?`,
  `tabStart`, `audioStart`, `folderId?`, `favourite`, `difficulty? (1–5)`,
  `countIn?` (null = follow global), `audioPosition`, `createdAt`,
  `updatedAt`.
- **Folder:** `id`, `name`, `createdAt`. Flat (no subfolders).
- `tabStart`/`audioStart`: seconds into each video where the song actually
  starts. The player never uses either value directly for seeking — only
  their difference matters. See `js/player.js`'s `getSyncOffset`:
  `audioStart - tabStart`. Positive = audio has a head start the tab skips
  (intro-watch); negative = tab seeks forward to skip its own intro
  (immediate simultaneous start); zero = both start together at 0.

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
SQLiteData migration (Phase 2), YouTube Premium sign-in UI (mechanism proven,
see risk #5 — needs a real settings/account screen, not just a spike button).

**Not applicable:** keyboard shortcuts (replaced by on-screen controls /
gestures).

## Known risks & limitations

1. ~~**Two simultaneous IFrame players on a real device — the #1 risk.**~~
   **RESOLVED (physical iPhone).** Both a single `WKWebView` hosting two
   iframes, and two separate `WKWebView`s, play back simultaneously without
   issue — `allowsInlineMediaPlayback = true` and
   `mediaTypesRequiringUserActionForPlayback = []` were sufficient, no further
   entitlement needed. Decision landed on the two-`WKWebView` arrangement
   regardless (one player per WebView) — see "Player library" above — since
   YouTubePlayerKit enforces it by design and it's already proven safe.
2. **YouTube embed backend rejects a `youtube.com` `baseURL`.** Loading player
   HTML via `WKWebView.loadHTMLString` with `baseURL: https://www.youtube.com`
   causes YouTube's embed backend to treat it as a self-referential embed and
   reject otherwise-embeddable videos with `YT.PlayerState` error 150 ("Video
   unavailable") — reproducible even for videos confirmed working in the web
   app. Fix: use any other real `https` origin (doesn't need to be reachable);
   a spoofed-Safari `WKWebView.customUserAgent` is cheap extra insurance since
   WKWebView's default UA omits the `Safari/` token some embeds gate on.
   YouTubePlayerKit's own default `originURL` (`https://<bundle-id>`) already
   avoids this — only relevant if hand-rolling a WKWebView wrapper.
3. **`seek(to:)` can resume playback as a side effect — must re-pause after
   seeking.** `player.js`'s `onReady` handler calls `pauseVideo()` immediately
   after every `seekTo()` for exactly this reason; a first pass at the iOS
   port missed it, which broke the audio-has-intro/intro-watch case
   specifically (the tab player would start playing during Load itself,
   before intro-watch ever got a chance to hold it back) while the
   tab-has-intro/immediate-start case masked the bug since both players end
   up playing anyway. Confirmed present in YouTubePlayerKit's `seek(to:)` too
   — port this defensively regardless of which player library is used.
4. **No steady-state sync verified yet.** The spike validated the full
   load/intro-watch handoff in both directions (`tabStart > audioStart` and
   `audioStart > tabStart`), but deliberately didn't port `player.js`'s
   `resyncAudio()` drift correction — manual testing shows visible drift once
   both players are running. Not a risk to the concept, just unbuilt; port it
   when building the real sync engine.
5. ~~**YouTube Premium ad-free/logged-in playback.**~~ **RESOLVED (physical
   device).** Signed into a real Google/YouTube Premium account through a
   plain `WKWebView` (youtube.com's own sign-in flow) using WKWebView's
   default *persistent* `WKWebsiteDataStore` — the same one YouTubePlayerKit's
   players use by default (`useNonPersistentWebsiteDataStore: false`).
   Playback afterward was ad-free, and visiting `youtube.com/account` in a
   fresh WKWebView (proof the session lives in the *shared* data store, not
   just the sign-in WebView instance) correctly showed the signed-in account.
   Two things this surfaced:
   - **Sign-in can trigger a handoff to the native YouTube app.** Universal
     Links can intercept a WKWebView navigation mid-sign-in and bounce the
     user out to the installed YouTube app instead of completing in-app. Not
     fixed in the spike (deferred). Likely fix: intercept the navigation in a
     `WKNavigationDelegate` and re-issue it programmatically via
     `webView.load(...)` rather than letting the system resolve it as a
     top-level link activation — needs verification when building the real
     sign-in flow.
   - **A signed-in account's saved captions preference can force captions on**
     — see risk #6, found *because* sign-in started working.
6. **Captions/subtitles can appear unexpectedly — force-disable, don't just
   set a default.** Setting the initial playerVar default alone
   (`cc_load_policy: 0` / YouTubePlayerKit's `showCaptions: false`) isn't
   sufficient once a user is signed in: a signed-in account's saved
   "captions on" preference overrides the player's initial default. Fix:
   force-disable at runtime too, via the real IFrame API technique —
   `player.setOption('captions', 'track', {})` — called from each player's
   `onReady`, on both tab and audio players. **This is also an outstanding,
   unfixed issue on the web app** (`js/player.js` has never set either the
   playerVar or the runtime override) — worth a separate fix there,
   independent of the native app.
7. **No background / locked-screen playback.** YouTube's IFrame player suspends
   when the WebView backgrounds and YouTube prevents background audio; no
   entitlement changes this. Design for foreground-only practice (e.g.
   `UIApplication.shared.isIdleTimerDisabled = true` while a track is loaded to
   keep the screen awake).
8. **Forced player controls / disabled embeds carry over.** `controls: 1` is
   required for non-partner embeds, and owner-disabled embeds still fail — same
   IFrame, same constraints as the web app.

## De-risk spike — DONE, all questions answered

> A minimal SwiftUI app that plays two YouTube videos together with a play
> button, a sync-offset value, and a speed control — run on a **physical
> iPhone**. Test **both player arrangements**: two iframes in one `WKWebView`,
> and two separate `WKWebView`s.

Was built at `.claude-research/ios-spike/` (xcodegen project; three
arrangements were compared — single WebView/two iframes, two WebViews, and
YouTubePlayerKit) and has since been **deleted** — it was always throwaway
code per its own README, and every question it was built to answer has been
answered and is recorded above:

- Concurrent playback: works, on a physical device (risk #1).
- The full sync-offset/intro-watch algorithm: ports cleanly to Swift, in both
  directions, against both a raw WKWebView bridge and YouTubePlayerKit (risks
  #2–#4, "Player library" above).
- Player library choice: adopt YouTubePlayerKit rather than build custom
  ("Player library" above).
- YouTube Premium/login: works, on a physical device, with two follow-up UX
  items recorded (risks #5–#6).

**The concept is fully validated; the rest is a conventional SwiftUI + TCA
app.**

## Notes for whoever picks this up

- The web app's `player.js` is the reference implementation for the sync
  engine — port its logic (see `getSyncOffset`, `makeOnReady`,
  `startIntroWatch`, `resyncAudio`) into a native Swift coordinator against
  YouTubePlayerKit's API, following the pattern already proven in the (now
  deleted) spike's `YouTubePlayerKitSyncCoordinator.swift`. Don't try to share
  the JS file itself — see "Player library" above for why that was tried and
  abandoned.
- Before writing the Swift data model, re-read `js/library.js`'s `migrate()`
  and JSDoc for the *current* schema — it changed twice during this spike
  alone and this document's field list will go stale again.
- `utils.js` (`extractVideoId`, `parseVideoTitle`, `fetchOEmbed`) ports almost
  verbatim.
- Keep the JSON schema in lockstep with the web app; bump versions together.
- Known gotchas to carry forward, all detailed under "Known risks" above:
  the `baseURL`/origin trap, `seek(to:)` resuming playback, Premium
  sign-in's Universal-Link app-switch, and forcing captions off at runtime
  (not just via the initial playerVar).
