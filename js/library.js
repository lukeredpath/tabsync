// ── Data layer ──
// Manages tracks and folders in localStorage.

import { uuid } from './utils.js';

const STORAGE_KEY = 'tabsync-library';
const SCHEMA_VERSION = 2;

/**
 * @typedef {Object} Track
 * @property {string}      id
 * @property {string}      title
 * @property {string}      artist
 * @property {string}      tabVideoId
 * @property {number}      tabStart       - seconds (0.1s precision)
 * @property {string|null} audioVideoId
 * @property {number}      audioStart     - seconds (0.1s precision)
 * @property {string|null} folderId
 * @property {boolean}     favourite
 * @property {number|null} difficulty     - 1–5
 * @property {string}      createdAt      - ISO timestamp
 * @property {string}      updatedAt      - ISO timestamp
 * @property {boolean|null} countIn       - null = follow global toggle
 */

/**
 * @typedef {Object} Folder
 * @property {string} id
 * @property {string} name
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Library
 * @property {Track[]}  tracks
 * @property {Folder[]} folders
 */

// ── Internal helpers ──

function migrate(data) {
  if ((data.version ?? 1) < 2) {
    data.tracks = (data.tracks ?? []).map(t =>
      'countIn' in t ? t : { ...t, countIn: null }
    );
    data.version = 2;
  }
  return data;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return empty();
    return migrate(parsed);
  } catch {
    return empty();
  }
}

function empty() {
  return { version: SCHEMA_VERSION, tracks: [], folders: [] };
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Public API ──

/** @returns {Library} */
export function getLibrary() {
  const data = load();
  return { tracks: data.tracks ?? [], folders: data.folders ?? [] };
}

// Tracks

/** @param {Omit<Track, 'id'|'createdAt'|'updatedAt'>} fields */
export function createTrack(fields) {
  const data = load();
  const now = new Date().toISOString();
  const track = { ...fields, id: uuid(), createdAt: now, updatedAt: now };
  data.tracks.push(track);
  save(data);
  return track;
}

/** @param {string} id @param {Partial<Track>} fields */
export function updateTrack(id, fields) {
  const data = load();
  const idx = data.tracks.findIndex(t => t.id === id);
  if (idx === -1) throw new Error(`Track not found: ${id}`);
  data.tracks[idx] = { ...data.tracks[idx], ...fields, id, updatedAt: new Date().toISOString() };
  save(data);
  return data.tracks[idx];
}

/** @param {string} id */
export function deleteTrack(id) {
  const data = load();
  data.tracks = data.tracks.filter(t => t.id !== id);
  save(data);
}

// Folders

/** @param {string} name */
export function createFolder(name) {
  const data = load();
  const folder = { id: uuid(), name, createdAt: new Date().toISOString() };
  data.folders.push(folder);
  save(data);
  return folder;
}

/** @param {string} id @param {string} name */
export function updateFolder(id, name) {
  const data = load();
  const idx = data.folders.findIndex(f => f.id === id);
  if (idx === -1) throw new Error(`Folder not found: ${id}`);
  data.folders[idx] = { ...data.folders[idx], name };
  save(data);
  return data.folders[idx];
}

/** @param {string} id - Tracks in the folder are unassigned (folderId set to null) */
export function deleteFolder(id) {
  const data = load();
  data.folders = data.folders.filter(f => f.id !== id);
  data.tracks = data.tracks.map(t => t.folderId === id ? { ...t, folderId: null } : t);
  save(data);
}

// Export / import

export function exportLibrary() {
  return JSON.stringify(load(), null, 2);
}

/** @param {string} json */
export function importLibrary(json) {
  const parsed = JSON.parse(json);
  if (!parsed.tracks || !parsed.folders) throw new Error('Invalid library file');
  save({ ...parsed, version: SCHEMA_VERSION });
}
