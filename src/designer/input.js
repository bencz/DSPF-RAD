// Pointer + keyboard input handlers for the canvas.  The Designer owns
// the state mutation; this module just turns events into method calls.

import { specWidth } from '../palette/Palette.js';

export function bindPointerInput (designer) {
    const c = designer.canvas;

    c.addEventListener('pointerdown',   (ev) => onPointerDown(designer, ev));
    c.addEventListener('pointermove',   (ev) => onPointerMove(designer, ev));
    c.addEventListener('pointerup',     (ev) => onPointerUp(designer, ev));
    c.addEventListener('pointercancel', (ev) => onPointerUp(designer, ev));
    c.addEventListener('pointerleave',  () => {
        if (designer._dragItem) return;
        designer.renderer.hoverCell = null;
        designer.renderer.draw();
    });

    // Focus the canvas on click so the keyboard handler below receives
    // arrow keys / Delete without a separate Tab navigation.
    c.addEventListener('mousedown', () => c.focus());
}

export function bindKeyboardInput (designer) {
    designer.canvas.addEventListener('keydown', (ev) => onKeyDown(designer, ev));
}

// ---- handlers ------------------------------------------------------------

function onPointerDown (designer, ev) {
    const cell = designer.renderer.cellAt(ev.clientX, ev.clientY);
    if (!cell) return;

    // Click-to-place takes priority over hit-testing.
    const armed = designer.palette?.getArmedSpec?.();
    if (armed) { designer.placeFromSpec(armed, cell); return; }

    const hit = designer.renderer.itemAt(cell.row, cell.col);
    if (!hit) { designer.selectItem(null); return; }

    designer.selectItem(hit.id);
    designer._dragItem   = hit;
    designer._dragOffset = { dr: cell.row - hit.row, dc: cell.col - hit.col };
    designer._dragMoved  = false;
    try { designer.canvas.setPointerCapture(ev.pointerId); } catch (_) {}
}

function onPointerMove (designer, ev) {
    const cell = designer.renderer.cellAt(ev.clientX, ev.clientY);
    if (!cell) {
        if (!designer._dragItem) {
            designer.renderer.hoverCell = null;
            designer.renderer.draw();
        }
        return;
    }

    designer.renderer.hoverCell = cell;

    const armed = designer.palette?.getArmedSpec?.();
    if (armed) {
        designer.renderer.preview = {
            row: cell.row, col: cell.col, width: specWidth(armed),
        };
        designer.renderer.draw();
        return;
    } else if (designer.renderer.preview) {
        designer.renderer.preview = null;
    }

    if (designer._dragItem) {
        const r = cell.row - designer._dragOffset.dr;
        const c = cell.col - designer._dragOffset.dc;
        if (r !== designer._dragItem.row || c !== designer._dragItem.col) {
            designer._dragMoved = true;
            designer.document.updateItem(designer._dragItem.id, { row: r, col: c });
        }
    } else {
        designer.renderer.draw();
    }
}

function onPointerUp (designer, ev) {
    if (!designer._dragItem) return;
    try { designer.canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
    designer._dragItem   = null;
    designer._dragOffset = null;
}

function onKeyDown (designer, ev) {
    if (ev.key === 'Escape') {
        ev.preventDefault();
        if (designer.palette?.getArmedSpec?.()) {
            designer.palette.clearArmed();
            designer.renderer.preview = null;
            designer.renderer.draw();
            return;
        }
        if (designer.selectedId) designer.selectItem(null);
        return;
    }
    if (!designer.selectedId) return;

    if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault();
        designer.document.removeItem(designer.selectedId);
        designer.selectItem(null);
        return;
    }

    const it = designer.document.findItem(designer.selectedId);
    if (!it) return;

    const step = ev.shiftKey ? 5 : 1;
    let dr = 0, dc = 0;
    if      (ev.key === 'ArrowUp')    dr = -step;
    else if (ev.key === 'ArrowDown')  dr =  step;
    else if (ev.key === 'ArrowLeft')  dc = -step;
    else if (ev.key === 'ArrowRight') dc =  step;
    else return;
    ev.preventDefault();
    designer.document.updateItem(it.id, { row: it.row + dr, col: it.col + dc });
}
