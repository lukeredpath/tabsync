// ── TabSync — entry point ──

import { initLibraryUI } from './ui-library.js';
import { initEditorUI }  from './ui-editor.js';
import { initPlayer }    from './player.js';

// ── Theme ──

const THEME_KEY = 'tabsync-theme';

function applyTheme(theme) {
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  // Update toggle button icon
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    const isDark = theme === 'dark' ||
      (!theme && !window.matchMedia('(prefers-color-scheme: light)').matches);
    btn.textContent = isDark ? '☀' : '☾';
    btn.title = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved);

  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    let next;
    if (!current) {
      // Following system — flip to opposite of system
      next = systemDark ? 'light' : 'dark';
    } else if (current === 'dark') {
      next = 'light';
    } else {
      next = 'dark';
    }
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

// ── Init ──

initTheme();
initLibraryUI();
initEditorUI();
initPlayer();
