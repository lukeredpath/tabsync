// ── Editor UI ──
// Add/edit track modal form.

import { createTrack, updateTrack, getSortedFolders } from './library.js';
import { extractVideoId, fetchOEmbed, dispatch } from './utils.js';

const OEMBED_SUCCESS_TIMEOUT = 3000;

let editingTrackId = null;
let openSnapshot = null; // form state at the time the editor was opened

// ── Helpers ──

function $(id) { return document.getElementById(id); }

function setOembedStatus(elId, msg, type = '') {
  const el = $(elId);
  if (!el) return;
  el.textContent = msg;
  el.className = 'oembed-status' + (type ? ` ${type}` : '');
  if (type === 'success') {
    setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, OEMBED_SUCCESS_TIMEOUT);
  }
}

// ── Form HTML ──

function buildFormHTML() {
  return `
    <h2 id="ef-heading">Add Track</h2>

    <div class="form-section">
      <h3>Details</h3>
      <div class="field-group">
        <label for="ef-title">Title <span class="required">*</span></label>
        <input type="text" id="ef-title" autocomplete="off" />
      </div>
      <div class="field-group">
        <label for="ef-artist">Artist <span class="required">*</span></label>
        <input type="text" id="ef-artist" autocomplete="off" />
      </div>
      <div class="field-group">
        <label for="ef-folder">Folder</label>
        <select id="ef-folder">
          <option value="">— No folder —</option>
        </select>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label>Difficulty</label>
          <div class="difficulty-picker" id="ef-difficulty-picker">
            ${[1,2,3,4,5].map(n => `<button type="button" class="difficulty-dot" data-value="${n}">${n}</button>`).join('')}
          </div>
        </div>
        <div class="field-group field-group--top-align">
          <label>Favourite</label>
          <button type="button" id="ef-favourite" class="favourite-toggle">☆</button>
        </div>
      </div>
    </div>

    <div class="form-section">
      <h3>Tab Video</h3>
      <div class="field-group">
        <label for="ef-tab-url">YouTube URL <span class="required">*</span></label>
        <input type="url" id="ef-tab-url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" />
        <div class="oembed-status" id="ef-tab-oembed"></div>
      </div>
      <div class="field-group">
        <label for="ef-tab-start">Start time (seconds)</label>
        <input type="number" id="ef-tab-start" value="0" min="0" step="0.1" class="input--narrow" />
      </div>
    </div>

    <div class="form-section">
      <h3>Audio Track <span class="optional">(optional — if omitted, tab video audio is used)</span></h3>
      <div class="field-group">
        <label for="ef-audio-url">YouTube URL</label>
        <input type="url" id="ef-audio-url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" />
        <div class="oembed-status" id="ef-audio-oembed"></div>
      </div>
      <div class="field-group">
        <label for="ef-audio-start">Start time (seconds)</label>
        <input type="number" id="ef-audio-start" value="0" min="0" step="0.1" class="input--narrow" />
      </div>
    </div>

    <div class="form-actions">
      <button type="button" id="ef-cancel" class="btn-secondary">Cancel</button>
      <button type="button" id="ef-submit" class="btn btn-primary btn--auto-width">Add Track</button>
    </div>
  `;
}

// ── Difficulty picker ──

let selectedDifficulty = null;

function renderDifficultyPicker() {
  document.querySelectorAll('#ef-difficulty-picker .difficulty-dot').forEach(btn => {
    const val = parseInt(btn.dataset.value, 10);
    btn.classList.toggle('filled', selectedDifficulty !== null && val <= selectedDifficulty);
  });
}

function initDifficultyPicker() {
  document.getElementById('ef-difficulty-picker').addEventListener('click', e => {
    const btn = e.target.closest('.difficulty-dot');
    if (!btn) return;
    const val = parseInt(btn.dataset.value, 10);
    selectedDifficulty = selectedDifficulty === val ? null : val;
    renderDifficultyPicker();
  });
}

// ── Favourite toggle ──

let isFavourite = false;

function renderFavouriteToggle() {
  const btn = $('ef-favourite');
  if (!btn) return;
  btn.textContent = isFavourite ? '★' : '☆';
  btn.classList.toggle('active', isFavourite);
}

// ── Folder select ──

function populateFolderSelect(selectedFolderId = null) {
  const select = $('ef-folder');
  // Keep only the default option, replace the rest
  select.innerHTML = '<option value="">— No folder —</option>';
  getSortedFolders().forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      if (f.id === selectedFolderId) opt.selected = true;
      select.appendChild(opt);
    });
}

// ── oEmbed auto-fetch ──

async function handleTabUrlBlur() {
  const url = $('ef-tab-url').value.trim();
  if (!url) return;

  const videoId = extractVideoId(url);
  if (!videoId) {
    setOembedStatus('ef-tab-oembed', 'Invalid YouTube URL', 'error');
    return;
  }

  setOembedStatus('ef-tab-oembed', '');

  const titleEmpty  = !$('ef-title').value.trim();
  const artistEmpty = !$('ef-artist').value.trim();
  if (!titleEmpty && !artistEmpty) return; // nothing to fill

  setOembedStatus('ef-tab-oembed', 'Fetching…');
  const data = await fetchOEmbed(url);

  if (!data) {
    setOembedStatus('ef-tab-oembed', 'Could not fetch title from YouTube', 'error');
    return;
  }

  if (titleEmpty  && data.title)  $('ef-title').value  = data.title;
  if (artistEmpty && data.author) $('ef-artist').value = data.author;

  setOembedStatus('ef-tab-oembed', 'Title filled from YouTube', 'success');
}

function handleAudioUrlBlur() {
  const url = $('ef-audio-url').value.trim();
  if (!url) { setOembedStatus('ef-audio-oembed', ''); return; }
  const videoId = extractVideoId(url);
  if (!videoId) {
    setOembedStatus('ef-audio-oembed', 'Invalid YouTube URL', 'error');
  } else {
    setOembedStatus('ef-audio-oembed', '');
  }
}

// ── Validation ──

function validate() {
  let ok = true;

  const fields = {
    'ef-title':   $('ef-title').value.trim(),
    'ef-artist':  $('ef-artist').value.trim(),
    'ef-tab-url': $('ef-tab-url').value.trim(),
  };

  // Clear previous invalid states
  ['ef-title', 'ef-artist', 'ef-tab-url', 'ef-audio-url'].forEach(id => {
    $(id).classList.remove('invalid');
  });

  if (!fields['ef-title'])  { $('ef-title').classList.add('invalid');  ok = false; }
  if (!fields['ef-artist']) { $('ef-artist').classList.add('invalid'); ok = false; }
  if (!fields['ef-tab-url'] || !extractVideoId(fields['ef-tab-url'])) {
    $('ef-tab-url').classList.add('invalid');
    ok = false;
  }

  const audioUrl = $('ef-audio-url').value.trim();
  if (audioUrl && !extractVideoId(audioUrl)) {
    $('ef-audio-url').classList.add('invalid');
    ok = false;
  }

  return ok;
}

// ── Submit ──

function handleSubmit() {
  if (!validate()) return;

  const tabUrl   = $('ef-tab-url').value.trim();
  const audioUrl = $('ef-audio-url').value.trim();

  const fields = {
    title:        $('ef-title').value.trim(),
    artist:       $('ef-artist').value.trim(),
    tabVideoId:   extractVideoId(tabUrl),
    tabStart:     parseFloat($('ef-tab-start').value) || 0,
    audioVideoId: audioUrl ? extractVideoId(audioUrl) : null,
    audioStart:   parseFloat($('ef-audio-start').value) || 0,
    folderId:     $('ef-folder').value || null,
    favourite:    isFavourite,
    difficulty:   selectedDifficulty,
  };

  if (editingTrackId) {
    updateTrack(editingTrackId, fields);
  } else {
    createTrack(fields);
  }

  dispatch('tabsync:library-changed');
  closeEditor();
}

// ── Dirty state ──

function formSnapshot() {
  return JSON.stringify({
    title:      $('ef-title').value,
    artist:     $('ef-artist').value,
    tabUrl:     $('ef-tab-url').value,
    tabStart:   $('ef-tab-start').value,
    audioUrl:   $('ef-audio-url').value,
    audioStart: $('ef-audio-start').value,
    folder:     $('ef-folder').value,
    difficulty: selectedDifficulty,
    favourite:  isFavourite,
  });
}

function isDirty() {
  return openSnapshot !== null && formSnapshot() !== openSnapshot;
}

function tryClose() {
  if (isDirty() && !confirm('Discard unsaved changes?')) return;
  closeEditor();
}

// ── Open / close ──

export function openEditor(track = null) {
  editingTrackId = track ? track.id : null;
  selectedDifficulty = track ? track.difficulty : null;
  isFavourite = track ? track.favourite : false;

  $('ef-heading').textContent = track ? 'Edit Track' : 'Add Track';
  $('ef-submit').textContent  = track ? 'Save Changes' : 'Add Track';

  $('ef-title').value      = track?.title ?? '';
  $('ef-artist').value     = track?.artist ?? '';
  $('ef-tab-url').value    = track ? `https://www.youtube.com/watch?v=${track.tabVideoId}` : '';
  $('ef-tab-start').value  = track?.tabStart ?? 0;
  $('ef-audio-url').value  = track?.audioVideoId
    ? `https://www.youtube.com/watch?v=${track.audioVideoId}` : '';
  $('ef-audio-start').value = track?.audioStart ?? 0;

  // Clear validation states and status messages
  ['ef-title', 'ef-artist', 'ef-tab-url', 'ef-audio-url'].forEach(id => $(id).classList.remove('invalid'));
  setOembedStatus('ef-tab-oembed', '');
  setOembedStatus('ef-audio-oembed', '');

  populateFolderSelect(track?.folderId ?? null);
  renderDifficultyPicker();
  renderFavouriteToggle();

  $('editor-overlay').removeAttribute('hidden');

  // Snapshot the form state so we can detect unsaved changes on close
  openSnapshot = formSnapshot();

  // Focus first empty required field
  const first = [$('ef-title'), $('ef-artist'), $('ef-tab-url')].find(el => !el.value);
  (first ?? $('ef-title')).focus();
}

function closeEditor() {
  $('editor-overlay').setAttribute('hidden', '');
  editingTrackId = null;
  openSnapshot = null;
}

// ── Init ──

export function initEditorUI() {
  $('editor-modal').innerHTML = buildFormHTML();

  initDifficultyPicker();

  $('ef-favourite').addEventListener('click', () => {
    isFavourite = !isFavourite;
    renderFavouriteToggle();
  });

  $('ef-tab-url').addEventListener('blur', handleTabUrlBlur);
  $('ef-audio-url').addEventListener('blur', handleAudioUrlBlur);

  $('ef-cancel').addEventListener('click', tryClose);
  $('ef-submit').addEventListener('click', handleSubmit);

  // Close on backdrop click — but only if mousedown also started on the backdrop.
  // Without this guard, mousedown inside the modal then mouseup outside fires a
  // click on the overlay (lowest common ancestor), incorrectly dismissing the modal.
  let backdropMousedown = false;
  $('editor-overlay').addEventListener('mousedown', e => {
    backdropMousedown = e.target === $('editor-overlay');
  });
  $('editor-overlay').addEventListener('click', e => {
    if (e.target === $('editor-overlay') && backdropMousedown) tryClose();
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('editor-overlay').hasAttribute('hidden')) tryClose();
  });

  document.addEventListener('tabsync:editor-open', e => {
    openEditor(e.detail?.track ?? null);
  });
}
