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
    if (!hit) {
        if (!ev.shiftKey && !ev.ctrlKey && !ev.metaKey) designer.selectItem(null);
        return;
    }

    const additive = ev.shiftKey || ev.ctrlKey || ev.metaKey;
    if (additive) designer.selectItem(hit.id, { toggle: true });
    else if (!designer.selectedIds.has(hit.id)) designer.selectItem(hit.id);
    if (!designer.selectedIds.has(hit.id)) return;

    designer._dragItem   = hit;
    designer._dragStartCell = cell;
    designer._dragOrigins = designer.selectedItems().map(item => ({
        id: item.id, row: item.row, col: item.col,
    }));
    designer._dragMoved  = false;
    designer.document.beginTransaction('Move items');
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
        let dr = cell.row - designer._dragStartCell.row;
        let dc = cell.col - designer._dragStartCell.col;
        ({ dr, dc } = designer.constrainMove(designer._dragOrigins, dr, dc));
        if (dr !== 0 || dc !== 0) designer._dragMoved = true;
        designer.document.updateItems(designer._dragOrigins.map(origin => ({
            id: origin.id,
            patch: { row: origin.row + dr, col: origin.col + dc },
        })));
    } else {
        designer.renderer.draw();
    }
}

function onPointerUp (designer, ev) {
    if (!designer._dragItem) return;
    try { designer.canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
    designer._dragItem   = null;
    designer._dragStartCell = null;
    designer._dragOrigins = null;
    designer.document.endTransaction();
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
        if (designer.selectedIds.size) designer.selectItem(null);
        return;
    }
    if (!designer.selectedIds.size) return;

    if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault();
        designer.deleteSelection();
        return;
    }

    const step = ev.shiftKey ? 5 : 1;
    let dr = 0, dc = 0;
    if      (ev.key === 'ArrowUp')    dr = -step;
    else if (ev.key === 'ArrowDown')  dr =  step;
    else if (ev.key === 'ArrowLeft')  dc = -step;
    else if (ev.key === 'ArrowRight') dc =  step;
    else return;
    ev.preventDefault();
    designer.moveSelection(dr, dc);
}
