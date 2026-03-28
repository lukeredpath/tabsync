// ── Alpine store ──
// Reactive data layer wrapping library.js. Single source of truth for all
// UI state. Registered via initStore(Alpine) before Alpine.start().

import {
  getLibrary,
  createTrack, updateTrack, deleteTrack,
  createFolder, updateFolder, deleteFolder,
  exportLibrary, importLibrary,
} from './library.js';
import { dispatch } from './utils.js';

function sortTracks(tracks, sortBy) {
  const t = [...tracks];
  switch (sortBy) {
    case 'title-asc':      return t.sort((a, b) => a.title.localeCompare(b.title));
    case 'artist-asc':     return t.sort((a, b) => a.artist.localeCompare(b.artist));
    case 'difficulty-asc': return t.sort((a, b) => (a.difficulty ?? 6) - (b.difficulty ?? 6));
    default:               return t.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export function initStore(Alpine) {
  Alpine.store('lib', {
    // ── Persisted data ──
    tracks: [],
    folders: [],

    // ── UI state ──
    view: 'all',           // 'all' | 'favourites' | <folderId>
    searchQuery: '',
    sortBy: 'createdAt-desc',
    difficultyFilter: null,
    selectedTrackId: null,
    sidebarCollapsed: false,

    // ── Lifecycle ──

    init() {
      this.reload();
      document.addEventListener('tabsync:library-changed', () => this.reload());
      document.addEventListener('tabsync:playback-started', () => { this.sidebarCollapsed = true; });
    },

    reload() {
      const lib = getLibrary();
      this.tracks = lib.tracks;
      this.folders = lib.folders;
    },

    // ── Computed ──

    get filteredTracks() {
      let t = this.tracks;

      if (this.view === 'favourites') {
        t = t.filter(x => x.favourite);
      } else if (this.view !== 'all') {
        t = t.filter(x => x.folderId === this.view);
      }

      const q = this.searchQuery.trim().toLowerCase();
      if (q) {
        t = t.filter(x => x.title.toLowerCase().includes(q) || x.artist.toLowerCase().includes(q));
      }

      t = sortTracks(t, this.sortBy);

      if (this.difficultyFilter !== null) {
        t = t.filter(x => x.difficulty !== null && x.difficulty <= this.difficultyFilter);
      }

      return t;
    },

    get sortedFolders() {
      return this.folders.slice().sort((a, b) => a.name.localeCompare(b.name));
    },

    get emptyMessage() {
      if (this.searchQuery.trim()) return 'No tracks match your search.';
      if (this.view === 'favourites') return 'No favourite tracks yet. Star a track to add it here.';
      if (this.view !== 'all')       return 'No tracks in this folder.';
      return 'No tracks yet. Click + Add Track to get started.';
    },

    get trackCount()     { return this.tracks.length; },
    get favouriteCount() { return this.tracks.filter(t => t.favourite).length; },

    folderTrackCount(folderId) {
      return this.tracks.filter(t => t.folderId === folderId).length;
    },

    // ── Actions ──

    setView(id) { this.view = id; },

    openEditor(track = null) {
      dispatch('tabsync:editor-open', track ? { track } : null);
    },

    selectTrack(track) {
      this.selectedTrackId = track.id;
      dispatch('tabsync:track-selected', track);
    },

    toggleFavourite(id) {
      const track = this.tracks.find(t => t.id === id);
      if (!track) return;
      updateTrack(id, { favourite: !track.favourite });
      dispatch('tabsync:library-changed');
    },

    removeTrack(id, title) {
      if (!confirm(`Delete "${title}"?`)) return;
      if (this.selectedTrackId === id) this.selectedTrackId = null;
      deleteTrack(id);
      dispatch('tabsync:library-changed');
    },

    addFolder(name) {
      createFolder(name);
      dispatch('tabsync:library-changed');
    },

    renameFolder(id, newName, currentName) {
      const name = newName.trim();
      if (name && name !== currentName) {
        updateFolder(id, name);
        dispatch('tabsync:library-changed');
      }
    },

    removeFolder(id, name) {
      if (!confirm(`Delete folder "${name}"? Tracks will be moved to All tracks.`)) return;
      deleteFolder(id);
      if (this.view === id) this.view = 'all';
      dispatch('tabsync:library-changed');
    },

    exportLib() {
      const json = exportLibrary();
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `tabsync-library-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    importFromFile(file) {
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
    },
  });
}
