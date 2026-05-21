// HTML5 drag/drop wiring for the canvas.  Translates dragenter/over/leave/
// drop into preview rectangles and final item placement.

import { readDropSpec, specWidth } from '../palette/Palette.js';

export function bindDragDrop (designer) {
    const c = designer.canvas;

    c.addEventListener('dragenter', (ev) => {
        ev.preventDefault();
        const spec = readDropSpec(ev);
        designer._dropSpecWidth = spec ? specWidth(spec) : 10;
    });

    c.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
        const cell = designer.renderer.cellAt(ev.clientX, ev.clientY);
        if (!cell) return;
        designer.renderer.preview = {
            row: cell.row, col: cell.col,
            width: designer._dropSpecWidth,
        };
        designer.renderer.draw();
    });

    c.addEventListener('dragleave', (ev) => {
        if (ev.target === c) {
            designer.renderer.preview = null;
            designer.renderer.draw();
        }
    });

    c.addEventListener('drop', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        designer.renderer.preview = null;

        const cell = designer.renderer.cellAt(ev.clientX, ev.clientY);
        const spec = readDropSpec(ev);

        if (!cell) { designer.renderer.draw(); return; }
        if (!spec) {
            // Custom-MIME drops can read empty on some browsers; the
            // click-to-place fallback covers the user-experience hole.
            designer.renderer.draw();
            return;
        }
        designer.placeFromSpec(spec, cell);
    });
}
