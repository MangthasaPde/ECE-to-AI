'use strict';
// Loaded without defer so the theme is set before first paint (no flash of the wrong colours).
// A saved choice wins; otherwise follow the system setting, live.

(() => {
  const root = document.documentElement, system = matchMedia('(prefers-color-scheme: dark)');
  const saved = () => { try { return localStorage.getItem('theme'); } catch { return null; } };
  const apply = theme => root.dataset.theme = theme;
  apply(saved() || (system.matches ? 'dark' : 'light'));
  system.addEventListener('change', e => { if (!saved()) apply(e.matches ? 'dark' : 'light'); });

  window.toggleTheme = () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.classList.add('theme-fade');
    apply(next);
    try { localStorage.setItem('theme', next); } catch {}
    clearTimeout(toggleTheme.fade);
    toggleTheme.fade = setTimeout(() => root.classList.remove('theme-fade'), 500);
    return next;
  };
})();
