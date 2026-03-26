// ── TabSync — entry point ──

import { initLibraryUI } from './ui-library.js';
import { initEditorUI }  from './ui-editor.js';
import { initPlayer }    from './player.js';

// ── Theme ──

const THEME_KEY = 'tabsync-theme';

// Cycle: null (system) → 'dark' → 'light' → null (system)
const THEME_CYCLE = [null, 'dark', 'light'];

const THEME_META = {
  system: { icon: '⊙', title: 'System theme (click for dark)' },
  dark:   { icon: '☀', title: 'Dark theme (click for light)' },
  light:  { icon: '☾', title: 'Light theme (click for system)' },
};

function applyTheme(theme) {
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    const meta = THEME_META[theme ?? 'system'];
    btn.textContent = meta.icon;
    btn.title = meta.title;
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || null;
  applyTheme(saved);

  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || null;
    const idx = THEME_CYCLE.indexOf(current);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    if (next === null) {
      localStorage.removeItem(THEME_KEY);
    } else {
      localStorage.setItem(THEME_KEY, next);
    }
    applyTheme(next);
  });
}

// ── Help panel ──

function initHelp() {
  const overlay = document.getElementById('help-overlay');
  document.getElementById('help-btn').addEventListener('click', () => {
    overlay.removeAttribute('hidden');
  });
  document.getElementById('help-close-btn').addEventListener('click', () => {
    overlay.setAttribute('hidden', '');
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.setAttribute('hidden', '');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) {
      overlay.setAttribute('hidden', '');
    }
  });
}

// ── Init ──

initTheme();
initHelp();
initLibraryUI();
initEditorUI();
initPlayer();
