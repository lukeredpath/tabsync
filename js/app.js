// ── TabSync — entry point ──

import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3/dist/module.esm.js';
import { initStore }           from './store.js';
import { initEditorComponent } from './editor.js';
import { initPlayer }          from './player.js';

// ── Theme ──

const THEME_KEY = 'tabsync-theme';

// Cycle: null (system) → 'dark' → 'light' → null (system)
const THEME_CYCLE = [null, 'dark', 'light'];

const THEME_META = {
  system: { icon: '⊙', title: 'System theme (click for dark)' },
  dark:   { icon: '☀', title: 'Dark theme (click for light)' },
  light:  { icon: '☾', title: 'Light theme (click for system)' },
};

// System preference media query — used to resolve 'null' (system) theme.
// By always setting data-theme explicitly, the CSS needs no @media block.
const systemMQ = window.matchMedia('(prefers-color-scheme: light)');

// Tracks the user's saved preference (null = follow system)
let currentPreference = null;

function resolveTheme(pref) {
  return pref ?? (systemMQ.matches ? 'light' : 'dark');
}

function applyTheme(pref) {
  currentPreference = pref;
  document.documentElement.setAttribute('data-theme', resolveTheme(pref));
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    const meta = THEME_META[pref ?? 'system'];
    btn.textContent = meta.icon;
    btn.title = meta.title;
    btn.setAttribute('aria-label', meta.title);
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || null;
  applyTheme(saved);

  // When in system mode, follow OS preference changes in real time
  systemMQ.addEventListener('change', () => {
    if (currentPreference === null) applyTheme(null);
  });

  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    const idx = THEME_CYCLE.indexOf(currentPreference);
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

// Register store and components before Alpine processes the DOM
initStore(Alpine);
initEditorComponent(Alpine);

initTheme();
initHelp();

// Expose Alpine globally (useful for devtools)
window.Alpine = Alpine;
Alpine.start();

initPlayer();
