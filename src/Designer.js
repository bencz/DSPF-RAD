// Orchestrator: owns the canvas renderer, holds selection state, and
// translates pointer + drag/drop events into document mutations.  Also
// honours the palette's click-to-place mode: if the palette has an
// armed spec, the next canvas click places that spec instead of
// performing the usual select/drag behaviour.

import { GridCanvas } from './GridCanvas.js';
import { readDropSpec, specWidth } from './Palette.js';
import { keywordsFromShortcuts } from './Keywords.js';

export class Designer {
    constructor ({ canvas, document, inspector, palette, onChange, onSelectionChange }) {
        this.canvas    = canvas;
        this.document  = document;
        this.inspector = inspector;
        this.palette   = palette;
        this.onChange  = onChange;
        // Fired after selectItem changes the selected id (including to null).
        // main.js uses this to drive the source-pane cursor for cursor↔item
        // link.  Kept separate from onChange since the doc itself didn't
        // mutate when selection alone changes.
        this.onSelectionChange = onSelectionChange;
        this.renderer  = new GridCanvas(canvas);
        this.renderer.document = document;
        this.selectedId = null;

        this._dragItem      = null;
        this._dragOffset    = null;
        this._dragMoved     = false;
        this._dropSpecWidth = 1;
        this._lastDropAttempt = null;       // for debugging

        document.onChange(() => this._refresh());
        this._bind();
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

    /** Called from main.js after window resize / CSS class toggle so we
     *  can re-read the canvas dimensions and redraw at the new scale. */
    forceResize () {
        this.renderer.resize();
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

    _bind () {
        const c = this.canvas;

        // ---------- HTML5 drag/drop from palette ----------
        c.addEventListener('dragenter', (ev) => {
            ev.preventDefault();
            const spec = readDropSpec(ev);
            this._dropSpecWidth = spec ? specWidth(spec) : 10;
            console.debug('[designer] dragenter, specWidth:', this._dropSpecWidth);
        });
        c.addEventListener('dragover', (ev) => {
            ev.preventDefault();
            if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
            const cell = this.renderer.cellAt(ev.clientX, ev.clientY);
            if (!cell) return;
            this.renderer.preview = {
                row: cell.row, col: cell.col, width: this._dropSpecWidth,
            };
            this.renderer.draw();
        });
        c.addEventListener('dragleave', (ev) => {
            if (ev.target === c) {
                this.renderer.preview = null;
                this.renderer.draw();
            }
        });
        c.addEventListener('drop', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this.renderer.preview = null;
            const cell = this.renderer.cellAt(ev.clientX, ev.clientY);
            const spec = readDropSpec(ev);
            this._lastDropAttempt = { cell, spec, at: Date.now() };
            console.debug('[designer] drop', { cell, spec });
            if (!cell)  { this.renderer.draw(); return; }
            if (!spec)  {
                console.warn('[designer] drop with no spec (dataTransfer was empty); '
                           + 'click-to-place fallback may help.');
                this.renderer.draw();
                return;
            }
            this._placeFromSpec(spec, cell);
        });

        // ---------- pointer: select / drag-move / click-to-place ----------
        c.addEventListener('pointerdown',  (ev) => this._onPointerDown(ev));
        c.addEventListener('pointermove',  (ev) => this._onPointerMove(ev));
        c.addEventListener('pointerup',    (ev) => this._onPointerUp(ev));
        c.addEventListener('pointercancel',(ev) => this._onPointerUp(ev));
        c.addEventListener('pointerleave', () => {
            if (this._dragItem) return;
            this.renderer.hoverCell = null;
            this.renderer.draw();
        });

        // ---------- keyboard ----------
        c.addEventListener('keydown', (ev) => this._onKeyDown(ev));
        c.addEventListener('mousedown', () => c.focus());
    }

    _placeFromSpec (spec, cell) {
        const item = this._specToItem(spec, cell);
        const created = this.document.addItem(item);
        this.selectItem(created.id);
        if (this.palette?.getArmedSpec?.()) this.palette.clearArmed();
        // Reflect armed state visually.
        this.canvas.classList.remove('canvas-armed');
    }

    _specToItem (spec, cell) {
        const keywords = keywordsFromShortcuts(spec);
        const at = { row: cell.row, col: cell.col };

        if (spec.kind === 'constant') {
            return { kind: 'constant', ...at, text: spec.text ?? 'Text', keywords };
        }
        if (spec.kind === 'sysvalue') {
            return {
                kind: 'sysvalue', ...at,
                sysName: spec.sys ?? 'DATE',
                keywords: [{ name: spec.sys ?? 'DATE', args: [], indicators: [] }, ...keywords],
            };
        }

        // ENPTUI presets - field kind with the appropriate keywords
        // pre-loaded so the renderer's branch by SNGCHCFLD / MNUBARCHC /
        // PSHBTNFLD / CNTFLD kicks in immediately.
        if (spec.kind === 'pushbtn') {
            return {
                kind: 'field', ...at,
                name: spec.name ?? 'BTN', length: 2,
                usage: 'B', dataType: 'Y', decimals: 0,
                keywords: [
                    { name: 'PSHBTNFLD', args: [], indicators: [] },
                    { name: 'PSHBTNCHC', args: ['1', "'OK'"], indicators: [] },
                    ...keywords,
                ],
            };
        }
        if (spec.kind === 'pushbtnGroup') {
            return {
                kind: 'field', ...at,
                name: spec.name ?? 'BTNS', length: 2,
                usage: 'B', dataType: 'Y', decimals: 0,
                keywords: [
                    { name: 'PSHBTNFLD', args: [], indicators: [] },
                    { name: 'PSHBTNCHC', args: ['1', "'OK'"],     indicators: [] },
                    { name: 'PSHBTNCHC', args: ['2', "'Cancel'"], indicators: [] },
                    { name: 'PSHBTNCHC', args: ['3', "'Help'"],   indicators: [] },
                    ...keywords,
                ],
            };
        }
        if (spec.kind === 'radio' || spec.kind === 'checkbox') {
            const head = spec.kind === 'radio' ? 'SNGCHCFLD' : 'MLTCHCFLD';
            return {
                kind: 'field', ...at,
                name: spec.name ?? (spec.kind === 'radio' ? 'RAD' : 'CHK'),
                length: 1, usage: 'B', dataType: 'Y', decimals: 0,
                keywords: [
                    { name: head, args: [], indicators: [] },
                    { name: 'CHOICE', args: ['1', "'Option'"], indicators: [] },
                    ...keywords,
                ],
            };
        }
        if (spec.kind === 'radioGroup' || spec.kind === 'checkGroup') {
            const head = spec.kind === 'radioGroup' ? 'SNGCHCFLD' : 'MLTCHCFLD';
            return {
                kind: 'field', ...at,
                name: spec.name ?? (spec.kind === 'radioGroup' ? 'RAD' : 'CHK'),
                length: 1, usage: 'B', dataType: 'Y', decimals: 0,
                keywords: [
                    { name: head, args: [], indicators: [] },
                    { name: 'CHOICE', args: ['1', "'Option 1'"], indicators: [] },
                    { name: 'CHOICE', args: ['2', "'Option 2'"], indicators: [] },
                    { name: 'CHOICE', args: ['3', "'Option 3'"], indicators: [] },
                    ...keywords,
                ],
            };
        }
        if (spec.kind === 'mnubar') {
            return {
                kind: 'field', ...at,
                name: spec.name ?? 'MENU', length: 2,
                usage: 'B', dataType: 'Y', decimals: 0,
                keywords: [
                    { name: 'MNUBARCHC', args: ['1', 'PULL1', "' Item 1 '"], indicators: [] },
                    { name: 'MNUBARCHC', args: ['2', 'PULL2', "' Item 2 '"], indicators: [] },
                    ...keywords,
                ],
            };
        }
        if (spec.kind === 'cntfld') {
            return {
                kind: 'field', ...at,
                name: spec.name ?? 'TEXT', length: 120,
                usage: 'B', dataType: 'A', decimals: 0,
                keywords: [
                    { name: 'CNTFLD', args: ['60'], indicators: [] },
                    ...keywords,
                ],
            };
        }
        if (spec.kind === 'errmsg') {
            return {
                kind: 'field', ...at,
                name: spec.name ?? 'MSG', length: 60,
                usage: 'O', dataType: 'A', decimals: 0,
                keywords: [
                    { name: 'DSPATR', args: ['HI'],  indicators: [] },
                    { name: 'COLOR',  args: ['RED'], indicators: [] },
                    ...keywords,
                ],
            };
        }

        // Default: regular input/output/both field.
        const usage =
            spec.kind === 'input'  ? 'I' :
            spec.kind === 'output' ? 'O' :
            spec.kind === 'both'   ? 'B' : 'B';
        return {
            kind: 'field', ...at,
            name: spec.name ?? '',
            length: spec.length ?? 10,
            usage, dataType: 'A', decimals: 0,
            keywords,
        };
    }

    _onPointerDown (ev) {
        const cell = this.renderer.cellAt(ev.clientX, ev.clientY);
        if (!cell) return;

        // Click-to-place: if the palette has an armed spec, drop it here.
        const armed = this.palette?.getArmedSpec?.();
        if (armed) {
            this._placeFromSpec(armed, cell);
            return;
        }

        const hit = this.renderer.itemAt(cell.row, cell.col);
        if (!hit) { this.selectItem(null); return; }
        this.selectItem(hit.id);
        this._dragItem   = hit;
        this._dragOffset = { dr: cell.row - hit.row, dc: cell.col - hit.col };
        this._dragMoved  = false;
        try { this.canvas.setPointerCapture(ev.pointerId); } catch (_) {}
    }
    _onPointerMove (ev) {
        const cell = this.renderer.cellAt(ev.clientX, ev.clientY);
        if (!cell) {
            if (!this._dragItem) {
                this.renderer.hoverCell = null;
                this.renderer.draw();
            }
            return;
        }
        this.renderer.hoverCell = cell;
        // Show armed-cursor preview as the hover cell.
        if (this.palette?.getArmedSpec?.()) {
            const armed = this.palette.getArmedSpec();
            this.renderer.preview = {
                row: cell.row, col: cell.col, width: specWidth(armed),
            };
            this.renderer.draw();
            return;
        } else if (this.renderer.preview) {
            this.renderer.preview = null;
        }
        if (this._dragItem) {
            const r = cell.row - this._dragOffset.dr;
            const c = cell.col - this._dragOffset.dc;
            if (r !== this._dragItem.row || c !== this._dragItem.col) {
                this._dragMoved = true;
                this.document.updateItem(this._dragItem.id, { row: r, col: c });
            }
        } else {
            this.renderer.draw();
        }
    }
    _onPointerUp (ev) {
        if (this._dragItem) {
            try { this.canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
            this._dragItem   = null;
            this._dragOffset = null;
        }
    }

    _onKeyDown (ev) {
        if (ev.key === 'Escape') {
            ev.preventDefault();
            if (this.palette?.getArmedSpec?.()) {
                this.palette.clearArmed();
                this.renderer.preview = null;
                this.renderer.draw();
                return;
            }
            if (this.selectedId) { this.selectItem(null); return; }
            return;
        }
        if (!this.selectedId) return;
        if (ev.key === 'Delete' || ev.key === 'Backspace') {
            ev.preventDefault();
            this.document.removeItem(this.selectedId);
            this.selectItem(null);
            return;
        }
        const it = this.document.findItem(this.selectedId);
        if (!it) return;
        const step = ev.shiftKey ? 5 : 1;
        let dr = 0, dc = 0;
        if      (ev.key === 'ArrowUp')    dr = -step;
        else if (ev.key === 'ArrowDown')  dr =  step;
        else if (ev.key === 'ArrowLeft')  dc = -step;
        else if (ev.key === 'ArrowRight') dc =  step;
        else return;
        ev.preventDefault();
        this.document.updateItem(it.id, { row: it.row + dr, col: it.col + dc });
    }
}
