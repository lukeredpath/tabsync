// ── Editor Alpine component ──
// Registered as Alpine.data('editorUI') before Alpine.start().

import { createTrack, updateTrack, createFolder } from './library.js';
import { extractVideoId, fetchOEmbed, dispatch } from './utils.js';

const OEMBED_SUCCESS_TIMEOUT = 3000;

export function initEditorComponent(Alpine) {
  Alpine.data('editorUI', () => ({
    // ── Visibility ──
    open: false,
    editingTrack: null,   // null → Add Track, object → Edit Track
    backdropMousedown: false,
    audioSectionOpen: false,

    // ── Form fields ──
    title: '',
    artist: '',
    tabUrl: '',
    tabStart: 0,
    audioUrl: '',
    audioStart: 0,
    folderId: '',
    newFolderName: '',
    selectedDifficulty: null,
    isFavourite: false,
    trackCountIn: '',    // '' = follow global, 'true' = always on, 'false' = always off

    // ── oEmbed status ──
    tabOembedMsg: '',
    tabOembedType: '',
    audioOembedMsg: '',
    audioOembedType: '',

    // ── Validation ──
    titleInvalid: false,
    artistInvalid: false,
    tabUrlInvalid: false,
    audioUrlInvalid: false,

    // ── Dirty-state snapshot ──
    openSnapshot: null,

    // ── Computed ──

    get heading()      { return this.editingTrack ? 'Edit Track' : 'Add Track'; },
    get submitLabel()  { return this.editingTrack ? 'Save Changes' : 'Add Track'; },

    get isDirty() {
      return this.openSnapshot !== null && this._snapshot() !== this.openSnapshot;
    },

    _snapshot() {
      return JSON.stringify({
        title: this.title, artist: this.artist,
        tabUrl: this.tabUrl, tabStart: parseFloat(this.tabStart) || 0,
        audioUrl: this.audioUrl, audioStart: parseFloat(this.audioStart) || 0,
        folder: this.folderId, difficulty: this.selectedDifficulty,
        favourite: this.isFavourite, countIn: this.trackCountIn,
      });
    },

    // ── Lifecycle ──

    init() {
      document.addEventListener('tabsync:editor-open', e => {
        this.openFor(e.detail?.track ?? null);
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.open) this.tryClose();
      });
    },

    // ── Open / close ──

    openFor(track) {
      this.editingTrack      = track ?? null;
      this.title             = track?.title ?? '';
      this.artist            = track?.artist ?? '';
      this.tabUrl            = track ? `https://www.youtube.com/watch?v=${track.tabVideoId}` : '';
      this.tabStart          = track?.tabStart ?? 0;
      this.audioUrl          = track?.audioVideoId
        ? `https://www.youtube.com/watch?v=${track.audioVideoId}` : '';
      this.audioStart        = track?.audioStart ?? 0;
      this.folderId          = track?.folderId ?? '';
      this.selectedDifficulty = track?.difficulty ?? null;
      this.isFavourite       = track?.favourite ?? false;
      this.trackCountIn      = track?.countIn === true  ? 'true'
                             : track?.countIn === false ? 'false'
                             : '';

      this.tabOembedMsg   = ''; this.tabOembedType   = '';
      this.audioOembedMsg = ''; this.audioOembedType = '';
      this.titleInvalid   = false; this.artistInvalid  = false;
      this.tabUrlInvalid  = false; this.audioUrlInvalid = false;

      this.audioSectionOpen = !!(track?.audioVideoId);
      this.newFolderName    = '';

      this.open = true;
      this.openSnapshot = this._snapshot();

      this.$nextTick(() => {
        const refs = [this.$refs.tabUrlInput, this.$refs.titleInput, this.$refs.artistInput];
        (refs.find(el => el && !el.value) ?? refs[0])?.focus();
      });
    },

    tryClose() {
      if (this.isDirty && !confirm('Discard unsaved changes?')) return;
      this.close();
    },

    close() {
      this.open = false;
      this.editingTrack = null;
      this.openSnapshot = null;
    },

    // ── Difficulty picker ──

    toggleDifficulty(n) {
      this.selectedDifficulty = this.selectedDifficulty === n ? null : n;
    },

    // ── oEmbed ──

    async handleTabUrlBlur() {
      const url = this.tabUrl.trim();
      if (!url) return;

      const videoId = extractVideoId(url);
      if (!videoId) {
        this.tabOembedMsg = 'Invalid YouTube URL'; this.tabOembedType = 'error';
        return;
      }

      this.tabOembedMsg = ''; this.tabOembedType = '';

      const titleEmpty  = !this.title.trim();
      const artistEmpty = !this.artist.trim();
      if (!titleEmpty && !artistEmpty) return;

      this.tabOembedMsg = 'Fetching…';
      const data = await fetchOEmbed(url);

      if (!data) {
        this.tabOembedMsg = 'Could not fetch title from YouTube'; this.tabOembedType = 'error';
        return;
      }

      if (titleEmpty  && data.title)  this.title  = data.title;
      if (artistEmpty && data.artist) this.artist = data.artist;

      this.tabOembedMsg = 'Title filled from YouTube'; this.tabOembedType = 'success';
      setTimeout(() => {
        if (this.tabOembedMsg === 'Title filled from YouTube') {
          this.tabOembedMsg = ''; this.tabOembedType = '';
        }
      }, OEMBED_SUCCESS_TIMEOUT);
    },

    handleAudioUrlBlur() {
      const url = this.audioUrl.trim();
      if (!url) { this.audioOembedMsg = ''; this.audioOembedType = ''; return; }
      const valid = !!extractVideoId(url);
      this.audioOembedMsg  = valid ? '' : 'Invalid YouTube URL';
      this.audioOembedType = valid ? '' : 'error';
    },

    // ── Validation ──

    validate() {
      this.titleInvalid    = !this.title.trim();
      this.artistInvalid   = !this.artist.trim();
      this.tabUrlInvalid   = !this.tabUrl.trim() || !extractVideoId(this.tabUrl.trim());
      this.audioUrlInvalid = !!(this.audioUrl.trim() && !extractVideoId(this.audioUrl.trim()));
      return !this.titleInvalid && !this.artistInvalid
          && !this.tabUrlInvalid && !this.audioUrlInvalid;
    },

    // ── Submit ──

    submit() {
      if (!this.validate()) return;

      let resolvedFolderId = this.folderId || null;
      if (this.folderId === '__new__' && this.newFolderName.trim()) {
        const folder = createFolder(this.newFolderName.trim());
        resolvedFolderId = folder.id;
      }

      const fields = {
        title:        this.title.trim(),
        artist:       this.artist.trim(),
        tabVideoId:   extractVideoId(this.tabUrl.trim()),
        tabStart:     parseFloat(this.tabStart) || 0,
        audioVideoId: this.audioUrl.trim() ? extractVideoId(this.audioUrl.trim()) : null,
        audioStart:   parseFloat(this.audioStart) || 0,
        folderId:     resolvedFolderId,
        favourite:    this.isFavourite,
        difficulty:   this.selectedDifficulty,
        countIn:      this.trackCountIn === 'true'  ? true
                    : this.trackCountIn === 'false' ? false
                    : null,
      };

      if (this.editingTrack) {
        const updated = updateTrack(this.editingTrack.id, fields);
        dispatch('tabsync:track-updated', updated);
      } else {
        createTrack(fields);
      }

      dispatch('tabsync:library-changed');
      this.close();
    },
  }));
}
