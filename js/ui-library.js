// ── Library UI ──
// Sidebar, folder nav, track list, search, sort.

import {
  getLibrary,
  createFolder, updateFolder, deleteFolder,
  deleteTrack, updateTrack,
  exportLibrary, importLibrary,
} from './library.js';
import { dispatch } from './utils.js';

const MOBILE_BREAKPOINT = 768;

// ── State ──

const state = {
  view: 'all',           // 'all' | 'favourites' | <folderId>
  searchQuery: '',
  sortBy: 'createdAt-desc',
  selectedTrackId: null,
  difficultyFilter: null, // null | 1–5 (max difficulty)
};

// ── Helpers ──

function sortTracks(tracks, sortBy) {
  const sorted = [...tracks];
  switch (sortBy) {
    case 'title-asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'artist-asc':
      return sorted.sort((a, b) => a.artist.localeCompare(b.artist));
    case 'difficulty-asc':
      return sorted.sort((a, b) => (a.difficulty ?? 6) - (b.difficulty ?? 6));
    case 'createdAt-desc':
    default:
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

function applySearch(tracks, query) {
  if (!query) return tracks;
  const q = query.toLowerCase();
  return tracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
}

function getViewTracks() {
  const { view, searchQuery } = state;
  const { tracks } = getLibrary();

  let filtered;
  if (view === 'all') {
    filtered = tracks;
  } else if (view === 'favourites') {
    filtered = tracks.filter(t => t.favourite);
  } else {
    filtered = tracks.filter(t => t.folderId === view);
  }

  filtered = applySearch(filtered, searchQuery);
  filtered = sortTracks(filtered, state.sortBy);

  if (state.difficultyFilter !== null) {
    filtered = filtered.filter(t => t.difficulty !== null && t.difficulty <= state.difficultyFilter);
  }

  return filtered;
}

function emptyMessage() {
  const { view, searchQuery } = state;
  if (searchQuery) return 'No tracks match your search.';
  if (view === 'favourites') return 'No favourite tracks yet. Star a track to add it here.';
  if (view !== 'all') return 'No tracks in this folder.';
  return 'No tracks yet. Click + Add Track to get started.';
}

function renderDifficultyFilter() {
  document.querySelectorAll('.filter-dot').forEach(dot => {
    const val = parseInt(dot.dataset.difficulty, 10);
    dot.classList.toggle('filled', state.difficultyFilter !== null && val <= state.difficultyFilter);
  });
}

// ── Render ──

function render() {
  renderFolderNav();
  renderTrackList();
}

function renderFolderNav() {
  const { tracks, folders } = getLibrary();
  const nav = document.getElementById('folder-nav');

  const items = [
    { id: 'all',        label: 'All tracks', count: tracks.length },
    { id: 'favourites', label: 'Favourites', count: tracks.filter(t => t.favourite).length },
    ...folders
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(f => ({ id: f.id, label: f.name, count: tracks.filter(t => t.folderId === f.id).length, isFolder: true })),
  ];

  nav.innerHTML = '';

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'folder-item' + (state.view === item.id ? ' active' : '');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'folder-item__name';
    nameSpan.textContent = item.label;
    el.appendChild(nameSpan);

    const countSpan = document.createElement('span');
    countSpan.className = 'folder-count';
    countSpan.textContent = item.count;
    el.appendChild(countSpan);

    if (item.isFolder) {
      const actions = document.createElement('span');
      actions.className = 'folder-item__actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'folder-item__btn';
      editBtn.title = 'Rename folder';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        startFolderRename(el, item.id, item.label);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'folder-item__btn';
      delBtn.title = 'Delete folder';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm(`Delete folder "${item.label}"? Tracks will be moved to All tracks.`)) {
          deleteFolder(item.id);
          if (state.view === item.id) state.view = 'all';
          dispatch('tabsync:library-changed');
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      el.appendChild(actions);
    }

    el.addEventListener('click', () => {
      state.view = item.id;
      render();
    });

    nav.appendChild(el);
  });

  // New folder row
  const newFolderRow = document.createElement('div');
  newFolderRow.className = 'folder-item folder-item--new';
  newFolderRow.id = 'new-folder-trigger';
  newFolderRow.textContent = '+ New folder';
  newFolderRow.addEventListener('click', () => showNewFolderInput(nav));
  nav.appendChild(newFolderRow);
}

function startFolderRename(el, folderId, currentName) {
  const nameSpan = el.querySelector('.folder-item__name');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.className = 'folder-rename-input';
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const name = input.value.trim();
    if (name && name !== currentName) {
      updateFolder(folderId, name);
      dispatch('tabsync:library-changed');
    } else {
      render();
    }
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); render(); }
  });
}

function showNewFolderInput(nav) {
  const trigger = document.getElementById('new-folder-trigger');
  const row = document.createElement('div');
  row.className = 'new-folder-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Folder name…';
  row.appendChild(input);
  nav.insertBefore(row, trigger);
  trigger.style.display = 'none';
  input.focus();

  function commit() {
    const name = input.value.trim();
    if (name) {
      createFolder(name);
      dispatch('tabsync:library-changed');
    } else {
      render();
    }
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); render(); }
  });
}

function renderTrackList() {
  const trackList = document.getElementById('track-list');
  const tracks = getViewTracks();

  trackList.innerHTML = '';

  if (tracks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = emptyMessage();
    trackList.appendChild(empty);
    return;
  }

  tracks.forEach(track => {
    const el = document.createElement('div');
    el.className = 'track-item' + (state.selectedTrackId === track.id ? ' active' : '');
    el.dataset.trackId = track.id;

    // Info block
    const info = document.createElement('div');
    info.className = 'track-info';

    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = track.title;

    const artist = document.createElement('div');
    artist.className = 'track-artist';
    artist.textContent = track.artist;

    info.appendChild(title);
    info.appendChild(artist);

    // Meta block
    const meta = document.createElement('div');
    meta.className = 'track-meta';

    if (track.difficulty != null) {
      const badge = document.createElement('span');
      badge.className = 'difficulty-badge';
      badge.textContent = '●'.repeat(track.difficulty);
      meta.appendChild(badge);
    }

    const favBtn = document.createElement('button');
    favBtn.className = 'favourite-btn' + (track.favourite ? ' active' : '');
    favBtn.title = track.favourite ? 'Remove from favourites' : 'Add to favourites';
    favBtn.textContent = track.favourite ? '★' : '☆';
    favBtn.addEventListener('click', e => {
      e.stopPropagation();
      updateTrack(track.id, { favourite: !track.favourite });
      dispatch('tabsync:library-changed');
    });
    meta.appendChild(favBtn);

    // Actions (shown on hover via CSS)
    const actions = document.createElement('div');
    actions.className = 'track-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'track-action-btn';
    editBtn.title = 'Edit track';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', e => {
      e.stopPropagation();
      dispatch('tabsync:editor-open', { track });
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'track-action-btn';
    delBtn.title = 'Delete track';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`Delete "${track.title}"?`)) {
        if (state.selectedTrackId === track.id) state.selectedTrackId = null;
        deleteTrack(track.id);
        dispatch('tabsync:library-changed');
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    el.appendChild(info);
    el.appendChild(meta);
    el.appendChild(actions);

    // Select track on click
    el.addEventListener('click', () => {
      state.selectedTrackId = track.id;
      renderTrackList();
      dispatch('tabsync:track-selected', track);
    });

    trackList.appendChild(el);
  });
}

// ── Init ──

export function initLibraryUI() {
  // Sidebar collapse / expand
  document.getElementById('sidebar-collapse-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('collapsed');
  });
  document.getElementById('sidebar-open-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('collapsed');
  });

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    state.searchQuery = e.target.value.trim();
    renderTrackList();
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', e => {
    state.sortBy = e.target.value;
    renderTrackList();
  });

  // Add track button
  document.getElementById('add-track-btn').addEventListener('click', () => {
    dispatch('tabsync:editor-open', null);
  });

  // Difficulty filter dots
  document.querySelectorAll('.filter-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const val = parseInt(dot.dataset.difficulty, 10);
      state.difficultyFilter = state.difficultyFilter === val ? null : val;
      renderDifficultyFilter();
      renderTrackList();
    });
  });

  // Re-render when data changes
  document.addEventListener('tabsync:library-changed', render);

  // Auto-collapse sidebar when playback starts
  document.addEventListener('tabsync:playback-started', () => {
    document.getElementById('sidebar').classList.add('collapsed');
  });

  // Export
  document.getElementById('export-btn').addEventListener('click', () => {
    const json = exportLibrary();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `tabsync-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import
  const importFileInput = document.getElementById('import-file-input');
  document.getElementById('import-btn').addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = ''; // reset so same file can be re-imported
    if (!file) return;
    if (!confirm('This will replace your entire library. Are you sure?')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        importLibrary(ev.target.result);
        dispatch('tabsync:library-changed');
      } catch {
        alert('Could not import: file is not a valid TabSync library.');
      }
    };
    reader.readAsText(file);
  });

  // Click-outside to close sidebar on narrow viewports
  document.getElementById('main').addEventListener('click', () => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      document.getElementById('sidebar').classList.add('collapsed');
    }
  });

  render();
}
