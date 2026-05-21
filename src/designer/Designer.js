// Orchestrator: owns the canvas renderer, holds selection state, and
// turns input events into document mutations.  Honours the palette's
// click-to-place mode (the next canvas click drops the armed spec
// instead of selecting / dragging).

import { GridCanvas } from '../canvas/GridCanvas.js';
import { specToItem } from './specToItem.js';
import { bindDragDrop } from './dragDrop.js';
import { bindPointerInput, bindKeyboardInput } from './input.js';

export class Designer {
    constructor ({ canvas, document, inspector, palette, onChange, onSelectionChange }) {
        this.canvas    = canvas;
        this.document  = document;
        this.inspector = inspector;
        this.palette   = palette;
        this.onChange  = onChange;
        // Fires after selectItem changes the selected id (including to null).
        // Kept separate from onChange because the doc itself doesn't mutate
        // when selection alone changes.
        this.onSelectionChange = onSelectionChange;

        this.renderer  = new GridCanvas(canvas);
        this.renderer.document = document;
        this.selectedId = null;

        this._dragItem      = null;
        this._dragOffset    = null;
        this._dragMoved     = false;
        this._dropSpecWidth = 1;

        document.onChange(() => this._refresh());

        bindDragDrop(this);
        bindPointerInput(this);
        bindKeyboardInput(this);

        this._refresh();
    }

    selectItem (id) {
        const changed = this.selectedId !== id;
        this.selectedId = id;
        this.renderer.selection = id;
        this.inspector.setSelection(id ? this.document.findItem(id) : null);
        this.renderer.draw();
        if (changed) this.onSelectionChange?.(id);
    }

    // Called after window resize or a CSS class toggle so the canvas can
    // re-read its dimensions and redraw at the new scale.
    forceResize () { this.renderer.resize(); }

    placeFromSpec (spec, cell) {
        const item    = specToItem(spec, cell);
        const created = this.document.addItem(item);
        this.selectItem(created.id);
        this.palette?.clearArmed?.();
        this.canvas.classList.remove('canvas-armed');
    }

    _refresh () {
        this.renderer.document = this.document;
        this.renderer.resize();
        if (this.selectedId && !this.document.findItem(this.selectedId)) {
            this.selectedId = null;
        }
        this.renderer.selection = this.selectedId;
        this.renderer.draw();
        const sel = this.selectedId ? this.document.findItem(this.selectedId) : null;
        this.inspector.setSelection(sel);
        this.onChange?.(this.document);
    }
}
