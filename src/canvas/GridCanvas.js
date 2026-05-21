// Canvas renderer.  Reads attributes via the keyword helpers so even
// indicator-conditioned items paint as if active at design time.  Per-
// kind drawing lives in the sibling modules; this file is the
// orchestrator — sizing, the draw() loop, and the public selection /
// preview hooks the Designer pokes at.

import {
    BG, GRID_DOT, COL_LINE, OVERLAY_ALPHA,
} from './theme.js';
import { drawRulers } from './rulers.js';
import { drawRecordChrome } from './drawWindow.js';
import { drawLinkedSubfile } from './drawSubfile.js';
import { drawItem } from './itemDispatch.js';
import { recordOffset } from './windowSpec.js';
import { effectiveLength } from './metrics.js';
import { cellAt, itemAt } from './hitTest.js';

export class GridCanvas {
    constructor (canvas) {
        this.canvas   = canvas;
        this.ctx      = canvas.getContext('2d');
        this.dpr      = window.devicePixelRatio || 1;

        // Cell metrics (recomputed on every resize).
        this.cellW    = 10;
        this.cellH    = 20;
        this.fontSize = 14;
        // Top ruler: row 0 is the "tens" digit, row 1 is "units".
        // Left ruler: 4 cells wide so row numbers up to 999 fit.
        this.rulerCols = 4;
        this.rulerRows = 2;

        this.document  = null;
        this.selection = null;
        this.preview   = null;
        this.hoverCell = null;

        this._ro = new ResizeObserver(() => this.resize());
        this._ro.observe(canvas);
        this.resize();
    }

    resize () {
        const rect = this.canvas.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        this.dpr = dpr;
        this.canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
        this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
        if (this.document) {
            const totalCols = this.document.cols + this.rulerCols;
            const totalRows = this.document.rows + this.rulerRows;
            this.cellW    = rect.width  / totalCols;
            this.cellH    = rect.height / totalRows;
            this.fontSize = Math.min(this.cellH * 0.85, this.cellW * 1.7);
        }
        this.draw();
    }

    cellAt (clientX, clientY) {
        return cellAt(this, clientX, clientY);
    }

    itemAt (row, col) {
        return itemAt(this, row, col);
    }

    draw () {
        if (!this.document) return;
        const { ctx, canvas } = this;

        ctx.save();
        ctx.scale(this.dpr, this.dpr);
        const cssW = canvas.width  / this.dpr;
        const cssH = canvas.height / this.dpr;

        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, cssW, cssH);

        // Rulers paint in canvas-absolute coords, then we shift origin so
        // every other drawer can use grid-local (col, row) math.
        drawRulers(this);
        ctx.translate(this.rulerCols * this.cellW, this.rulerRows * this.cellH);

        this._paintGridBackdrop(cssH);

        ctx.textBaseline = 'middle';
        ctx.textAlign    = 'left';

        if (this.document.showOverlay) this._paintOverlayRecords();

        // When the active record is an SFLCTL, paint the linked SFL's
        // items first so the SFLCTL chrome can land on top on overlap.
        const active = this.document.activeRecord;
        if (active.type === 'SFLCTL') drawLinkedSubfile(this, active);

        this._drawRecord(active, false);

        if (this.preview)   this._paintPreview();
        if (this.hoverCell) this._paintHover();

        ctx.restore();
    }

    // ---- internals -----------------------------------------------------

    _paintGridBackdrop (cssH) {
        const { ctx } = this;
        // Column rules every 10 cols.
        ctx.fillStyle = COL_LINE;
        for (let c = 10; c < this.document.cols; c += 10) {
            const x = c * this.cellW;
            ctx.fillRect(Math.round(x), 0, 1, cssH);
        }
        // Grid dots.
        ctx.fillStyle = GRID_DOT;
        for (let r = 0; r < this.document.rows; r++) {
            for (let c = 0; c < this.document.cols; c++) {
                const x = c * this.cellW + this.cellW / 2 - 0.5;
                const y = r * this.cellH + this.cellH / 2 - 0.5;
                ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
        }
    }

    _paintOverlayRecords () {
        const { ctx } = this;
        ctx.globalAlpha = OVERLAY_ALPHA;
        for (let i = 0; i < this.document.records.length; i++) {
            if (i === this.document.activeRecordIndex) continue;
            this._drawRecord(this.document.records[i], true);
        }
        ctx.globalAlpha = 1.0;
    }

    _drawRecord (record, isOverlay) {
        drawRecordChrome(this, record, isOverlay);
        const offset = recordOffset(record);
        // Pre-compute REFFLD clamp so the renderer + hit-tester agree.
        for (const it of record.items) {
            if (it.kind === 'field') {
                it._effectiveLength = effectiveLength(it, record.items, this.document.cols);
            }
        }
        for (const it of record.items) {
            const selected = !isOverlay && it.id === this.selection;
            drawItem(this, it, selected, isOverlay, record, offset);
        }
    }

    _paintPreview () {
        const { row, col, width } = this.preview;
        const { ctx } = this;
        ctx.fillStyle   = 'rgba(102, 255, 102, 0.18)';
        ctx.strokeStyle = '#6f6';
        ctx.lineWidth   = 1;
        const x = (col - 1) * this.cellW;
        const y = (row - 1) * this.cellH;
        const w = Math.max(1, width) * this.cellW;
        ctx.fillRect(x, y, w, this.cellH);
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, this.cellH - 1);
    }

    _paintHover () {
        if (this.preview) return;       // preview wins over hover ghost
        const { row, col } = this.hoverCell;
        const { ctx } = this;
        ctx.strokeStyle = '#234a23';
        ctx.lineWidth = 1;
        const x = (col - 1) * this.cellW;
        const y = (row - 1) * this.cellH;
        ctx.strokeRect(x + 0.5, y + 0.5, this.cellW - 1, this.cellH - 1);
    }
}

// Re-export the metrics + display-text helpers that callers outside the
// canvas (e.g. Inspector) reach for.
export { itemWidth, itemHeight, effectiveLength, itemDisplayText } from './metrics.js';
