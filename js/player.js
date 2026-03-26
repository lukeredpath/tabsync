// ── Player ──
// YouTube IFrame API wrapper and sync engine.

// ── Module state ──

let apiReady = false;
let pendingTrack = null;        // Track queued before API was ready

let loadId = 0;                 // Stale-callback guard: incremented per loadTrack() call

let tabPlayer = null;
let audioPlayer = null;         // null for tab-only tracks

let playersReady = 0;
let playersNeeded = 0;          // 1 (tab-only) or 2 (tab+audio)

let currentTrack = null;

let isPlaying = false;
let syncInterval = null;

const SYNC_INTERVAL_MS = 1000;
const SYNC_THRESHOLD   = 0.4;  // seconds

let drag = { active: false, startX: 0, startY: 0, origX: 0, origY: 0 };

// Cached DOM refs (set in initPlayer)
let elStatus, elPlayPause, elRewind, elSkipBack, elSkipFwd, elAudioContainer;

// ── Helpers ──

function setStatus(msg) {
  elStatus.textContent = msg;
}

function setControlsEnabled(enabled) {
  elPlayPause.disabled = !enabled;
  elRewind.disabled    = !enabled;
  elSkipBack.disabled  = !enabled;
  elSkipFwd.disabled   = !enabled;
}

function errorMessage(code, label) {
  switch (code) {
    case 2:         return `${label} video: invalid video ID`;
    case 5:         return `${label} video: HTML5 player error`;
    case 100:       return `${label} video: not found or removed`;
    case 101:
    case 150:       return `${label} video: embedding disabled by owner`;
    default:        return `${label} video error (code ${code})`;
  }
}

// ── YouTube API bootstrap ──

function bootstrapYouTubeAPI() {
  window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

function onYouTubeIframeAPIReady() {
  apiReady = true;
  if (pendingTrack) {
    const track = pendingTrack;
    pendingTrack = null;
    loadTrack(track);
  }
}

// ── Track loading ──

function loadTrack(track) {
  const myLoadId = ++loadId;

  stopSync();
  isPlaying = false;
  tabPlayer = null;
  audioPlayer = null;

  setControlsEnabled(false);
  setStatus('Loading…');
  elPlayPause.textContent = '▶ Play';

  currentTrack = track;
  const hasAudio = Boolean(track.audioVideoId);
  playersNeeded = hasAudio ? 2 : 1;
  playersReady  = 0;

  // Show/hide audio overlay
  elAudioContainer.hidden = !hasAudio;

  // Teardown: destroy old iframes by replacing innerHTML
  document.getElementById('tab-container').innerHTML = '<div id="tab-player"></div>';
  if (hasAudio) {
    document.getElementById('audio-player-wrapper').innerHTML = '<div id="audio-player"></div>';
  }

  // Build tab player
  tabPlayer = new YT.Player('tab-player', {
    videoId: track.tabVideoId,
    playerVars: {
      autoplay: 0,
      controls: 1,
      mute: hasAudio ? 1 : 0,
      rel: 0,
      modestbranding: 1,
      start: Math.floor(track.tabStart),
    },
    events: {
      onReady:       makeOnReady(myLoadId),
      onStateChange: makeOnStateChange(myLoadId),
      onError:       makeOnError(myLoadId, 'Tab'),
    },
  });

  // Build audio player (if applicable)
  if (hasAudio) {
    audioPlayer = new YT.Player('audio-player', {
      videoId: track.audioVideoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        mute: 0,
        rel: 0,
        modestbranding: 1,
        start: Math.floor(track.audioStart),
      },
      events: {
        onReady: makeOnReady(myLoadId),
        onError: makeOnError(myLoadId, 'Audio'),
      },
    });
  }
}

function makeOnReady(capturedLoadId) {
  return function onPlayerReady() {
    if (capturedLoadId !== loadId) return; // stale — a newer track has been selected

    playersReady++;
    if (playersReady < playersNeeded) return; // wait for the other player

    // Both (or the only) player is ready — seek to fractional start offsets
    tabPlayer.seekTo(currentTrack.tabStart, true);
    tabPlayer.pauseVideo();

    if (audioPlayer) {
      audioPlayer.seekTo(currentTrack.audioStart, true);
      audioPlayer.pauseVideo();
    }

    setControlsEnabled(true);
    setStatus('Ready');
  };
}

function makeOnStateChange(capturedLoadId) {
  return function onStateChange(event) {
    if (capturedLoadId !== loadId) return;
    if (event.data === YT.PlayerState.ENDED) {
      pause();
      setStatus('Ended');
    }
  };
}

function makeOnError(capturedLoadId, label) {
  return function onError(event) {
    if (capturedLoadId !== loadId) return;
    setStatus(errorMessage(event.data, label));
    // Controls remain disabled — user must select another track to recover
  };
}

// ── Playback controls ──

function play() {
  if (!tabPlayer) return;
  tabPlayer.playVideo();
  if (audioPlayer) audioPlayer.playVideo();
  isPlaying = true;
  elPlayPause.textContent = '⏸ Pause';
  setStatus('Playing');
  startSync();
  document.dispatchEvent(new CustomEvent('tabsync:playback-started'));
}

function pause() {
  if (!tabPlayer) return;
  tabPlayer.pauseVideo();
  if (audioPlayer) audioPlayer.pauseVideo();
  isPlaying = false;
  stopSync();
  elPlayPause.textContent = '▶ Play';
  setStatus('Paused');
}

function restart() {
  if (!tabPlayer || !currentTrack) return;
  const wasPlaying = isPlaying;
  pause();
  tabPlayer.seekTo(currentTrack.tabStart, true);
  if (audioPlayer) audioPlayer.seekTo(currentTrack.audioStart, true);
  if (wasPlaying) play();
}

function seek(delta) {
  if (!tabPlayer) return;
  const wasPlaying = isPlaying;

  if (wasPlaying) {
    tabPlayer.pauseVideo();
    if (audioPlayer) audioPlayer.pauseVideo();
    stopSync();
  }

  tabPlayer.seekTo(tabPlayer.getCurrentTime() + delta, true);
  if (audioPlayer) audioPlayer.seekTo(audioPlayer.getCurrentTime() + delta, true);

  if (wasPlaying) {
    // Brief delay lets the IFrame API's internal queue settle before resuming
    setTimeout(() => {
      tabPlayer.playVideo();
      if (audioPlayer) audioPlayer.playVideo();
      isPlaying = true;
      elPlayPause.textContent = '⏸ Pause';
      setStatus('Playing');
      startSync();
      // No re-dispatch of tabsync:playback-started — sidebar already collapsed
    }, 150);
  }
}

// ── Sync engine ──

function startSync() {
  if (!audioPlayer) return; // tab-only: nothing to sync
  stopSync();
  syncInterval = setInterval(syncTick, SYNC_INTERVAL_MS);
}

function syncTick() {
  if (!isPlaying || !audioPlayer) return;

  // Tab player is the master — never seek it during sync.
  // Compute where the audio player should be relative to the tab player,
  // accounting for the independent start offsets of each video.
  const offsetDiff    = currentTrack.audioStart - currentTrack.tabStart;
  const expectedAudio = tabPlayer.getCurrentTime() + offsetDiff;

  if (Math.abs(audioPlayer.getCurrentTime() - expectedAudio) > SYNC_THRESHOLD) {
    audioPlayer.seekTo(expectedAudio, true);
  }
}

function stopSync() {
  clearInterval(syncInterval);
  syncInterval = null;
}

// ── Draggable audio overlay ──

function onDragStart(e) {
  drag.active = true;
  drag.startX = e.clientX;
  drag.startY = e.clientY;
  const rect = elAudioContainer.getBoundingClientRect();
  drag.origX = rect.left;
  drag.origY = rect.top;
  e.preventDefault(); // prevent text selection during drag
}

function onDragMove(e) {
  if (!drag.active) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  elAudioContainer.style.left   = (drag.origX + dx) + 'px';
  elAudioContainer.style.top    = (drag.origY + dy) + 'px';
  elAudioContainer.style.bottom = 'auto';
  elAudioContainer.style.right  = 'auto';
}

function onDragEnd() {
  drag.active = false;
}

// ── Init ──

export function initPlayer() {
  // Cache DOM refs
  elStatus       = document.getElementById('status');
  elPlayPause    = document.getElementById('play-pause-btn');
  elRewind       = document.getElementById('rewind-btn');
  elSkipBack     = document.getElementById('skip-back-btn');
  elSkipFwd      = document.getElementById('skip-fwd-btn');
  elAudioContainer = document.getElementById('audio-container');

  // Controls
  elPlayPause.addEventListener('click', () => { isPlaying ? pause() : play(); });
  elRewind.addEventListener('click', restart);
  elSkipBack.addEventListener('click', () => seek(-5));
  elSkipFwd.addEventListener('click', () => seek(+5));

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        isPlaying ? pause() : play();
        break;
      case 'ArrowLeft':
        seek(-5);
        break;
      case 'ArrowRight':
        seek(+5);
        break;
      case 'KeyR':
        restart();
        break;
    }
  });

  // Draggable audio overlay
  elAudioContainer.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);

  // Track selection
  document.addEventListener('tabsync:track-selected', e => {
    if (!apiReady) {
      pendingTrack = e.detail;
      setStatus('Loading API…');
      return;
    }
    loadTrack(e.detail);
  });

  // Bootstrap YouTube IFrame API
  bootstrapYouTubeAPI();
}
