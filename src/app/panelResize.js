// Source panel resize handle (drag-up grows the panel) and the
// window-shade collapse arrow.  Both mutate CSS vars on :root and tell
// the designer to re-measure the canvas.

const DEFAULT_PANEL_H   = 260;
const COLLAPSED_PANEL_H = 24;        // title-bar height — leaves the ▴ button clickable
const HANDLE_H          = 5;
const MIN_PANEL_H       = 80;
const MAX_PANEL_RATIO   = 0.7;       // 70vh

export function bindPanelResize ({ designer, handle, collapseBtn }) {
    bindResizeDrag(handle, designer);
    bindCollapse(collapseBtn, designer);
}

function bindResizeDrag (handle, designer) {
    if (!handle) return;
    let drag = null;

    handle.addEventListener('pointerdown', (ev) => {
        drag = {
            y: ev.clientY,
            startH: parseFloat(
                getComputedStyle(document.documentElement)
                    .getPropertyValue('--source-panel-h')) || DEFAULT_PANEL_H,
        };
        handle.setPointerCapture(ev.pointerId);
        handle.classList.add('dragging');
    });

    handle.addEventListener('pointermove', (ev) => {
        if (!drag) return;
        // Dragging up grows the panel.  Clamp so the canvas always has
        // breathing room.
        const delta = drag.y - ev.clientY;
        const max   = Math.floor(window.innerHeight * MAX_PANEL_RATIO);
        const next  = Math.min(Math.max(MIN_PANEL_H, drag.startH + delta), max);
        document.documentElement.style.setProperty('--source-panel-h', next + 'px');
    });

    handle.addEventListener('pointerup', (ev) => {
        if (!drag) return;
        handle.releasePointerCapture(ev.pointerId);
        handle.classList.remove('dragging');
        drag = null;
        // Canvas sizes off CSS vars we just mutated.
        designer.forceResize();
    });
}

// Window-shade collapse: the title-bar peeks out so the ▴ button is
// always clickable.  CSS hides the source-toolbar + editor in the
// collapsed state; the handle goes to 0.
function bindCollapse (collapseBtn, designer) {
    if (!collapseBtn) return;

    collapseBtn.addEventListener('click', () => {
        const collapsed = document.body.classList.toggle('source-collapsed');
        collapseBtn.textContent = collapsed ? '▴' : '▾';
        collapseBtn.title       = collapsed ? 'Show source panel' : 'Hide source panel';

        document.documentElement.style.setProperty(
            '--source-panel-h',
            collapsed ? COLLAPSED_PANEL_H + 'px' : DEFAULT_PANEL_H + 'px');
        document.documentElement.style.setProperty(
            '--source-handle-h',
            collapsed ? '0px' : HANDLE_H + 'px');
        requestAnimationFrame(() => designer.forceResize());
    });
}
