// ── Library UI ──
// Sidebar, folder nav, track list, search, sort.

import {
  getLibrary,
  createFolder, updateFolder, deleteFolder,
  deleteTrack, updateTrack,
  getFavourites, getTracksByFolder, searchTracks,
} from './library.js';

// ── State ──

const state = {
  view: 'all',           // 'all' | 'favourites' | <folderId>
  searchQuery: '',
  sortBy: 'createdAt-desc',
  selectedTrackId: null,
  difficultyFilter: null, // null | 1–5 (max difficulty)
};

// ── Helpers ──

function dispatch(name, detail = null) {
  document.dispatchEvent(new CustomEvent(name, detail ? { detail } : undefined));
}

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

function getViewTracks() {
  const { view, searchQuery } = state;

  let tracks;
  if (view === 'all') {
    tracks = searchQuery ? searchTracks(searchQuery) : getLibrary().tracks;
  } else if (view === 'favourites') {
    tracks = getFavourites();
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      tracks = tracks.filter(
        t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      );
    }
  } else {
    tracks = getTracksByFolder(view);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      tracks = tracks.filter(
        t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      );
    }
  }

  tracks = sortTracks(tracks, state.sortBy);

  if (state.difficultyFilter !== null) {
    tracks = tracks.filter(t => t.difficulty !== null && t.difficulty <= state.difficultyFilter);
  }

  return tracks;
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
  const { folders } = getLibrary();
  const nav = document.getElementById('folder-nav');

  const items = [
    { id: 'all',        label: 'All tracks',  count: getLibrary().tracks.length },
    { id: 'favourites', label: 'Favourites',  count: getFavourites().length },
    ...folders
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(f => ({ id: f.id, label: f.name, count: getTracksByFolder(f.id).length, isFolder: true })),
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
  newFolderRow.className = 'folder-item';
  newFolderRow.id = 'new-folder-trigger';
  newFolderRow.textContent = '+ New folder';
  newFolderRow.style.color = 'var(--text-muted)';
  newFolderRow.style.fontSize = '12px';
  newFolderRow.addEventListener('click', () => showNewFolderInput(nav));
  nav.appendChild(newFolderRow);
}

function startFolderRename(el, folderId, currentName) {
  const nameSpan = el.querySelector('.folder-item__name');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.style.cssText = 'background:var(--surface-alt);border:1px solid var(--accent);border-radius:4px;color:var(--text);font-size:13px;padding:2px 6px;width:120px;';
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

  // Click-outside to close sidebar on narrow viewports
  document.getElementById('main').addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.add('collapsed');
    }
  });

  render();
}
