import { Page } from '@playwright/test';

export interface Track {
  id: string;
  title: string;
  artist: string;
  tabVideoId: string;
  tabStart: number;
  audioVideoId: string | null;
  audioStart: number;
  folderId: string | null;
  favourite: boolean;
  difficulty: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export interface Library {
  version: number;
  tracks: Track[];
  folders: Folder[];
}

export function makeTrack(id: string, title: string, artist: string, overrides: Partial<Track> = {}): Track {
  return {
    id,
    title,
    artist,
    tabVideoId: 'dQw4w9WgXcQ',
    tabStart: 0,
    audioVideoId: null,
    audioStart: 0,
    folderId: null,
    favourite: false,
    difficulty: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeFolder(id: string, name: string): Folder {
  return { id, name, createdAt: new Date().toISOString() };
}

export const defaultLibrary: Library = {
  version: 1,
  tracks: [
    makeTrack('track-1', 'Comfortably Numb', 'Pink Floyd', { favourite: true }),
    makeTrack('track-2', 'Smoke on the Water', 'Deep Purple', { folderId: 'folder-1' }),
  ],
  folders: [
    makeFolder('folder-1', 'Classics'),
  ],
};

export async function seedLibrary(page: Page, library: Library = defaultLibrary): Promise<void> {
  await page.evaluate((lib) => {
    localStorage.setItem('tabsync-library', JSON.stringify(lib));
  }, library);
  await page.reload();
}
