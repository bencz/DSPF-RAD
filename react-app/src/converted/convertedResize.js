// Horizontal splitter for the Modern React converted pane.
// Drag left grows the pane and reduces the flexible Canvas width.

const DEFAULT_W = 430;
const MIN_W = 320;
const MAX_RATIO = 0.65;
const KEY = 'dspf-rad:converted-w';

export function bindConvertedResize ({ handle }) {
    restoreWidth();
    if (!handle) return;

    let drag = null;
    handle.addEventListener('pointerdown', (event) => {
        drag = { x: event.clientX, startW: readWidth() };
        try { handle.setPointerCapture(event.pointerId); } catch { /* test DOM */ }
        handle.classList.add('dragging');
    });

    handle.addEventListener('pointermove', (event) => {
        if (!drag) return;
        const delta = drag.x - event.clientX;
        const next = Math.min(
            Math.max(MIN_W, drag.startW + delta),
            Math.max(MIN_W, Math.floor(window.innerWidth * MAX_RATIO)),
        );
        document.documentElement.style.setProperty('--converted-panel-w', `${next}px`);
    });

    handle.addEventListener('pointerup', (event) => {
        if (!drag) return;
        try { handle.releasePointerCapture(event.pointerId); } catch { /* test DOM */ }
        handle.classList.remove('dragging');
        drag = null;
        persistWidth();
    });
}

function readWidth () {
    return parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--converted-panel-w')) || DEFAULT_W;
}

function restoreWidth () {
    try {
        const saved = localStorage.getItem(KEY);
        if (saved) document.documentElement.style.setProperty('--converted-panel-w', saved);
    } catch { /* private mode */ }
}

function persistWidth () {
    try { localStorage.setItem(KEY, `${readWidth()}px`); } catch { /* private mode */ }
}
