// ── Player ──
// YouTube IFrame API wrapper and sync engine.

// ── Constants ──

const SEEK_DELTA         = 5;    // seconds per skip-back / skip-forward
const COUNT_IN_SECONDS   = 3;    // countdown duration
const SEEK_RESUME_DELAY  = 150;  // ms to wait after seekTo before resuming (IFrame API queue)

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
let atStart = false;           // true after load/restart — count-in applies only then

let playbackRate = 1.0;
const SPEED_KEY = 'tabsync-speed';

let countInEnabled = false;
let countInActive  = false;
let countInTimer   = null;

let seekTimer = null;

const COUNT_IN_KEY = 'tabsync-count-in';

let drag = { active: false, startX: 0, startY: 0, origX: 0, origY: 0 };

// Cached DOM refs (set in initPlayer)
let elStatus, elPlayPause, elRewind, elSkipBack, elSkipFwd, elAudioContainer;
let elCountInBtn, elCountdownOverlay, elCountdownNumber;
let elSpeedSelect;

// ── Helpers ──

function setStatus(msg) {
  elStatus.textContent = msg;
}

function setSpeed(rate) {
  playbackRate = rate;
  if (tabPlayer) tabPlayer.setPlaybackRate(rate);
  if (audioPlayer) audioPlayer.setPlaybackRate(rate);
  localStorage.setItem(SPEED_KEY, String(rate));
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

  // Hide the placeholder and replace any existing tab player div
  const tabContainer = document.getElementById('tab-container');
  const placeholder = document.getElementById('placeholder');
  if (placeholder) placeholder.hidden = true;
  const oldTabPlayer = document.getElementById('tab-player');
  if (oldTabPlayer) oldTabPlayer.remove();
  const tabPlayerDiv = document.createElement('div');
  tabPlayerDiv.id = 'tab-player';
  tabContainer.appendChild(tabPlayerDiv);

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
    tabPlayer.setPlaybackRate(playbackRate);

    if (audioPlayer) {
      audioPlayer.seekTo(currentTrack.audioStart, true);
      audioPlayer.pauseVideo();
      audioPlayer.setPlaybackRate(playbackRate);
    }

    atStart = true;
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
  atStart = false;
  tabPlayer.playVideo();
  if (audioPlayer) audioPlayer.playVideo();
  isPlaying = true;
  elPlayPause.textContent = '⏸ Pause';
  setStatus('Playing');
  document.dispatchEvent(new CustomEvent('tabsync:playback-started'));
}

function pause() {
  if (!tabPlayer) return;
  tabPlayer.pauseVideo();
  if (audioPlayer) audioPlayer.pauseVideo();
  isPlaying = false;
  elPlayPause.textContent = '▶ Play';
  setStatus('Paused');
}

// ── Count-in ──

function startCountIn() {
  countInActive = true;
  elCountdownOverlay.hidden = false;
  setStatus('Count in…');

  let count = COUNT_IN_SECONDS;
  elCountdownNumber.textContent = count;
  // Re-trigger CSS animation on each tick by cloning the node
  function animateTick() {
    const fresh = elCountdownNumber.cloneNode(true);
    elCountdownNumber.replaceWith(fresh);
    elCountdownNumber = fresh;
  }
  animateTick();

  function tick() {
    count--;
    if (count === 0) {
      elCountdownOverlay.hidden = true;
      countInActive = false;
      countInTimer = null;
      play();
      return;
    }
    elCountdownNumber.textContent = count;
    animateTick();
    countInTimer = setTimeout(tick, 1000);
  }

  countInTimer = setTimeout(tick, 1000);
}

function cancelCountIn() {
  if (!countInActive) return;
  clearTimeout(countInTimer);
  countInTimer = null;
  countInActive = false;
  elCountdownOverlay.hidden = true;
  elPlayPause.textContent = '▶ Play';
  setStatus('Paused');
}

function togglePlay() {
  if (countInActive) {
    cancelCountIn();
    return;
  }
  if (isPlaying) {
    pause();
  } else if (countInEnabled && atStart) {
    startCountIn();
  } else {
    play();
  }
}

function restart() {
  cancelCountIn();
  if (!tabPlayer || !currentTrack) return;
  const wasPlaying = isPlaying;
  pause();
  atStart = true;
  tabPlayer.seekTo(currentTrack.tabStart, true);
  if (audioPlayer) audioPlayer.seekTo(currentTrack.audioStart, true);
  if (wasPlaying) togglePlay();
}

function seek(delta) {
  if (!tabPlayer) return;
  const wasPlaying = isPlaying;

  if (wasPlaying) {
    tabPlayer.pauseVideo();
    if (audioPlayer) audioPlayer.pauseVideo();
  }

  tabPlayer.seekTo(tabPlayer.getCurrentTime() + delta, true);
  if (audioPlayer) audioPlayer.seekTo(audioPlayer.getCurrentTime() + delta, true);

  if (wasPlaying) {
    // Brief delay lets the IFrame API's internal queue settle before resuming.
    // Cancel any in-flight timer from a previous seek so rapid input doesn't
    // queue multiple resume callbacks.
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => {
      seekTimer = null;
      tabPlayer.playVideo();
      if (audioPlayer) audioPlayer.playVideo();
      isPlaying = true;
      elPlayPause.textContent = '⏸ Pause';
      setStatus('Playing');
    }, SEEK_RESUME_DELAY);
  }
}

// ── Draggable audio overlay ──

function startDrag(clientX, clientY) {
  drag.active = true;
  drag.startX = clientX;
  drag.startY = clientY;
  const rect = elAudioContainer.getBoundingClientRect();
  drag.origX = rect.left;
  drag.origY = rect.top;
}

function moveDrag(clientX, clientY) {
  const dx = clientX - drag.startX;
  const dy = clientY - drag.startY;
  elAudioContainer.style.left   = (drag.origX + dx) + 'px';
  elAudioContainer.style.top    = (drag.origY + dy) + 'px';
  elAudioContainer.style.bottom = 'auto';
  elAudioContainer.style.right  = 'auto';
}

function endDrag() {
  drag.active = false;
  document.removeEventListener('mousemove', onMouseDragMove);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', onTouchDragMove);
  document.removeEventListener('touchend', endDrag);
}

function onMouseDragStart(e) {
  startDrag(e.clientX, e.clientY);
  document.addEventListener('mousemove', onMouseDragMove);
  document.addEventListener('mouseup', endDrag);
  e.preventDefault();
}

function onMouseDragMove(e) {
  moveDrag(e.clientX, e.clientY);
}

function onTouchDragStart(e) {
  const touch = e.touches[0];
  startDrag(touch.clientX, touch.clientY);
  document.addEventListener('touchmove', onTouchDragMove, { passive: false });
  document.addEventListener('touchend', endDrag);
  e.preventDefault();
}

function onTouchDragMove(e) {
  moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  e.preventDefault();
}

// ── Init ──

export function initPlayer() {
  // Cache DOM refs
  elStatus           = document.getElementById('status');
  elPlayPause        = document.getElementById('play-pause-btn');
  elRewind           = document.getElementById('rewind-btn');
  elSkipBack         = document.getElementById('skip-back-btn');
  elSkipFwd          = document.getElementById('skip-fwd-btn');
  elAudioContainer   = document.getElementById('audio-container');
  elCountInBtn       = document.getElementById('count-in-btn');
  elCountdownOverlay = document.getElementById('countdown-overlay');
  elCountdownNumber  = document.getElementById('countdown-number');
  elSpeedSelect      = document.getElementById('speed-select');

  // Speed (persisted)
  playbackRate = parseFloat(localStorage.getItem(SPEED_KEY)) || 1.0;
  elSpeedSelect.value = String(playbackRate);
  elSpeedSelect.addEventListener('change', e => setSpeed(parseFloat(e.target.value)));

  // Count-in toggle (persisted)
  countInEnabled = localStorage.getItem(COUNT_IN_KEY) === '1';
  elCountInBtn.classList.toggle('active', countInEnabled);
  elCountInBtn.addEventListener('click', () => {
    countInEnabled = !countInEnabled;
    elCountInBtn.classList.toggle('active', countInEnabled);
    localStorage.setItem(COUNT_IN_KEY, countInEnabled ? '1' : '0');
  });

  // Controls
  elPlayPause.addEventListener('click', togglePlay);
  elRewind.addEventListener('click', restart);
  elSkipBack.addEventListener('click', () => seek(-SEEK_DELTA));
  elSkipFwd.addEventListener('click', () => seek(+SEEK_DELTA));

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        seek(-SEEK_DELTA);
        break;
      case 'ArrowRight':
        seek(+SEEK_DELTA);
        break;
      case 'KeyR':
        restart();
        break;
    }
  });

  // Draggable audio overlay — listeners registered/removed per-drag to avoid
  // firing on every mouse/touch move globally
  elAudioContainer.addEventListener('mousedown', onMouseDragStart);
  elAudioContainer.addEventListener('touchstart', onTouchDragStart, { passive: false });

  // Track selection
  document.addEventListener('tabsync:track-selected', e => {
    if (!apiReady) {
      pendingTrack = e.detail;
      setStatus('Loading API…');
      return;
    }
    loadTrack(e.detail);
  });

  // Track data updated (e.g. start offsets changed in editor) — refresh cached
  // reference so the next Restart uses the new offsets without reloading video
  document.addEventListener('tabsync:track-updated', e => {
    if (currentTrack && currentTrack.id === e.detail.id) {
      currentTrack = e.detail;
    }
  });

  // Bootstrap YouTube IFrame API
  bootstrapYouTubeAPI();
}
