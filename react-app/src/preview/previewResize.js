// Horizontal splitter for the React preview pane.  Drag left grows the
// pane (cells scale up: cellW = gridWidth / cols), drag right shrinks it.
// Width lives in --preview-panel-w on :root (read by .panel.preview) and
// is persisted so a reload keeps the last size.
//
// The clamp is two-part: a ratio cap on the window width, plus a
// height-aware cap so the magnified grid never clips vertically.  The
// grid is width-driven (aspect-ratio from doc.cols/doc.rows), so its
// rendered height is gridWidth / ratio; we cap the pane so that height
// still fits inside .preview-body.

const DEFAULT_W = 400;
const MIN_W     = 320;
const MAX_RATIO = 0.75;      // of window width
const KEY       = 'dspf-rad:preview-w';
const BODY_PAD_PX = 24;      // 6px padding each side + title-bar slack

export function bindPreviewResize ({ handle }) {
    restoreWidth();

    if (!handle) return;
    let drag = null;

    handle.addEventListener('pointerdown', (ev) => {
        drag = { x: ev.clientX, startW: readWidth() };
        try { handle.setPointerCapture(ev.pointerId); } catch { /* no pointer capture in this env */ }
        handle.classList.add('dragging');
    });

    handle.addEventListener('pointermove', (ev) => {
        if (!drag) return;
        // Left drag → negative delta → grows the pane.
        const delta = drag.x - ev.clientX;
        const next  = clampWidth(drag.startW + delta);
        document.documentElement.style.setProperty('--preview-panel-w', next + 'px');
    });

    handle.addEventListener('pointerup', (ev) => {
        if (!drag) return;
        try { handle.releasePointerCapture(ev.pointerId); } catch { /* no pointer capture in this env */ }
        handle.classList.remove('dragging');
        drag = null;
        persistWidth();
    });
}

function clampWidth (w) {
    const max = Math.min(window.innerWidth * MAX_RATIO, heightBudgetCap());
    return Math.min(Math.max(MIN_W, w), Math.max(MIN_W, max));
}

// How wide may the grid be before its height (gridW / grid-aspect-ratio)
// exceeds the preview body?  Returns Infinity when measurement is not
// available (initial render, jsdom) so the ratio cap alone applies.
function heightBudgetCap () {
    const body = document.querySelector('.preview-body');
    const grid = document.querySelector('.dspf-grid');
    if (!body || !grid) return Infinity;
    const ratio = parseAspect(getComputedStyle(grid).aspectRatio);
    if (!ratio) return Infinity;
    const budget = body.getBoundingClientRect().height - BODY_PAD_PX;
    if (budget <= 0) return Infinity;
    return Math.floor(budget * ratio);
}

// "80 / 48" → 1.666… (width/height).  Returns 0 on anything unexpected.
export function parseAspect (s) {
    const parts = String(s).split('/');
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    return (w > 0 && h > 0) ? w / h : 0;
}

function readWidth () {
    return parseFloat(
        getComputedStyle(document.documentElement)
            .getPropertyValue('--preview-panel-w')) || DEFAULT_W;
}

function restoreWidth () {
    try {
        const saved = localStorage.getItem(KEY);
        if (saved) document.documentElement.style.setProperty('--preview-panel-w', saved);
    } catch {
        // private mode / disabled storage — keep the CSS default
    }
}

function persistWidth () {
    try { localStorage.setItem(KEY, readWidth() + 'px'); } catch { /* swallow */ }
}