/**
 * theme.service.js
 * -----------------------------------------------------------------------
 * Light/dark mode. Persists the user's explicit choice in localStorage;
 * falls back to the OS preference when they've never toggled it. Applied
 * as early as possible (see index.html inline snippet) to avoid a flash
 * of the wrong theme before this module even loads.
 */

const STORAGE_KEY = 'autoclimas.theme';

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

// Keep in sync if the OS theme changes and the user never made an explicit choice.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  if (!localStorage.getItem(STORAGE_KEY)) applyTheme(event.matches ? 'dark' : 'light');
});
