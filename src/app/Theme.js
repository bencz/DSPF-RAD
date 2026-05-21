// Theme controller.  Pairs with the no-FOUC inline script in
// index.html — that script runs synchronously in <head> and sets
// data-theme on <html> from localStorage / prefers-color-scheme.
// This module then takes over for runtime wiring:
//
//   - Click on #themeToggle flips light ↔ dark, writes the explicit
//     choice to localStorage, updates the button glyph.
//   - matchMedia('(prefers-color-scheme: dark)') is followed live
//     ONLY while localStorage has no saved value — once the user
//     clicks the toggle, their choice persists until cleared.
//
// localStorage key: 'dspf-theme', value: 'light' | 'dark'.

const STORAGE_KEY = 'dspf-theme';

/** Returns 'light' or 'dark'. */
function readSavedTheme () {
    try { return localStorage.getItem(STORAGE_KEY); }
    catch (_) { return null; }
}

function saveTheme (theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); }
    catch (_) { /* private mode — toggle still works in-memory */ }
}

function currentTheme () {
    return document.documentElement.getAttribute('data-theme') || 'light';
}

function applyTheme (theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

// Sun glyph means "click to switch to light" (we're in dark now).
// Moon glyph means "click to switch to dark" (we're in light now).
function updateToggleGlyph (btn, theme) {
    if (!btn) return;
    btn.textContent = theme === 'dark' ? '☀' : '☾';
    btn.setAttribute('title',
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

export function initTheme () {
    const btn = document.getElementById('themeToggle');
    updateToggleGlyph(btn, currentTheme());

    btn?.addEventListener('click', () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        saveTheme(next);
        updateToggleGlyph(btn, next);
    });

    // Live-follow OS preference while no explicit choice is saved.
    // Once the user clicks the toggle, readSavedTheme() returns a
    // value and this listener becomes a no-op.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (ev) => {
        if (readSavedTheme()) return;
        const next = ev.matches ? 'dark' : 'light';
        applyTheme(next);
        updateToggleGlyph(btn, next);
    };
    // Safari < 14 only supports addListener / removeListener.
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
}
