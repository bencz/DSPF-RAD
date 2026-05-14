// Canvas renderer.  Reads attributes off items via the Keywords helpers
// (flagsOf / valueOf), so even indicator-conditioned entries paint as if
// active at design time.  Also dispatches by item.kind and by ENPTUI
// keyword patterns so SFL / SFLCTL / MNUBAR / PULLDOWN / WINDOW records
// look distinct from one another.

import { COLOR_CSS, DEFAULT_COLOR } from './Attributes.js';
import { flagsOf, valueOf } from './Keywords.js';

const BG       = '#050a05';
const GRID_DOT = '#0e2412';
const COL_LINE = '#0a1a0a';
const SELECT   = '#4a9aff';
const SELECT_BG = 'rgba(74, 154, 255, 0.10)';
const OVERLAY_ALPHA = 0.30;

// Per-record-type backdrop tints behind items.  Subtle so they don't
// overwhelm the content but still make record membership obvious.
const RECORD_BG = {
    SFL:      'rgba( 80, 150, 220, 0.10)',
    SFLCTL:   'rgba( 80, 220, 180, 0.08)',
    MNUBAR:   'rgba(220, 200,  80, 0.12)',
    PULLDOWN: 'rgba(180, 180, 180, 0.10)',
    WINDOW:   'rgba(150, 100, 220, 0.08)',
};
const RECORD_BORDER = {
    WINDOW:   '#9b6cd9',
};

// Conventional design-time widths for sysvalues (runtime fills with the
// real value; here we just need a stable footprint to render).
const SYS_WIDTH = {
    DATE: 8, TIME: 8, USER: 10, SYSNAME: 8, USRNAME: 10,
    DATEUSA: 10, TIMEUSA: 8, EUROPE: 10, JOBNAME: 10, NETID: 8,
};

export class GridCanvas {
    constructor (canvas) {
        this.canvas   = canvas;
        this.ctx      = canvas.getContext('2d');
        this.dpr      = window.devicePixelRatio || 1;
        this.cellW    = 10;
        this.cellH    = 20;
        this.fontSize = 14;
        // Top ruler shows "tens" digit on row 0 and "units" digit on row 1.
        // Left ruler reserves 4 cells for the row number (1..999).
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
            // Total addressable cells include the top/left ruler strips.
            const totalCols = this.document.cols + this.rulerCols;
            const totalRows = this.document.rows + this.rulerRows;
            this.cellW = rect.width  / totalCols;
            this.cellH = rect.height / totalRows;
            this.fontSize = Math.min(this.cellH * 0.85, this.cellW * 1.7);
        }
        this.draw();
    }

    cellAt (clientX, clientY) {
        if (!this.document) return null;
        const rect = this.canvas.getBoundingClientRect();
        const x = clientX - rect.left - this.rulerCols * this.cellW;
        const y = clientY - rect.top  - this.rulerRows * this.cellH;
        if (x < 0 || y < 0) return null;
        const col = Math.floor(x / this.cellW) + 1;
        const row = Math.floor(y / this.cellH) + 1;
        if (col < 1 || row < 1 || col > this.document.cols || row > this.document.rows)
            return null;
        return { row, col };
    }

    /** Most recently placed item whose displayed footprint contains the
     *  given cell (top-most wins).  Mirrors the renderer: applies the
     *  WINDOW offset, skips invisible / filtered items so clicks land on
     *  what the user actually sees. */
    itemAt (row, col) {
        if (!this.document) return null;
        const rec     = this.document.activeRecord;
        const offset  = recordOffset(rec);
        const dr      = offset?.rowOffset ?? 0;
        const dc      = offset?.colOffset ?? 0;
        const items   = rec.items;
        const hideCnd = !!this.document.hideConditioned;

        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            // Match what the renderer skips, otherwise the user clicks a
            // visible cell and gets a "ghost" hidden item selected.
            if (it.kind === 'field' && (it.usage === 'H' || it.usage === 'P')) continue;
            if (hideCnd && it.indicators?.length) continue;

            const drawRow = it.row + dr;
            const drawCol = it.col + dc;
            const w = itemWidth(it);
            const h = itemHeight(it);
            if (row >= drawRow && row < drawRow + h &&
                col >= drawCol && col < drawCol + w)
                return it;
        }
        return null;
    }

    draw () {
        if (!this.document) return;
        const { ctx, canvas } = this;
        const dpr = this.dpr;

        ctx.save();
        ctx.scale(dpr, dpr);
        const cssW = canvas.width  / dpr;
        const cssH = canvas.height / dpr;

        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, cssW, cssH);

        // Top/left rulers painted in absolute (unshifted) coordinates,
        // then we translate so the rest of the renderer can keep using
        // grid-local (col, row) math.
        this._drawRulers();
        ctx.translate(this.rulerCols * this.cellW, this.rulerRows * this.cellH);

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

        ctx.textBaseline = 'middle';
        ctx.textAlign    = 'left';

        // Overlay: paint non-active records first, faded.
        if (this.document.showOverlay) {
            ctx.globalAlpha = OVERLAY_ALPHA;
            for (let i = 0; i < this.document.records.length; i++) {
                if (i === this.document.activeRecordIndex) continue;
                this._drawRecord(this.document.records[i], true);
            }
            ctx.globalAlpha = 1.0;
        }

        // When the active record is an SFLCTL, paint the linked SFL's
        // items repeated SFLPAG times below the SFLCTL's chrome so the
        // designer sees the runtime "grid" of records.  We draw the SFL
        // *before* the active record's own items so the SFLCTL header /
        // legend wins on overlap.
        const active = this.document.activeRecord;
        if (active.type === 'SFLCTL') {
            this._drawLinkedSubfile(active);
        }

        // Active record.
        this._drawRecord(active, false);

        // Drag-preview / armed-spec preview.
        if (this.preview) {
            const { row, col, width } = this.preview;
            ctx.fillStyle   = 'rgba(102, 255, 102, 0.18)';
            ctx.strokeStyle = '#6f6';
            ctx.lineWidth   = 1;
            const x = (col - 1) * this.cellW;
            const y = (row - 1) * this.cellH;
            const w = Math.max(1, width) * this.cellW;
            ctx.fillRect(x, y, w, this.cellH);
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, this.cellH - 1);
        }

        // Hover ghost.
        if (this.hoverCell && !this.preview) {
            const { row, col } = this.hoverCell;
            ctx.strokeStyle = '#234a23';
            ctx.lineWidth = 1;
            const x = (col - 1) * this.cellW;
            const y = (row - 1) * this.cellH;
            ctx.strokeRect(x + 0.5, y + 0.5, this.cellW - 1, this.cellH - 1);
        }

        ctx.restore();
    }

    /** Paint the top + left rulers in the canvas margins.  Called from
     *  draw() BEFORE the translate-to-grid, so coordinates here are the
     *  canvas-absolute ones. */
    _drawRulers () {
        const { ctx, cellW, cellH, rulerCols, rulerRows } = this;
        const cols = this.document.cols;
        const rows = this.document.rows;
        const gx0 = rulerCols * cellW;
        const gy0 = rulerRows * cellH;

        // Faint backdrop so the rulers read as chrome, not as data.
        ctx.fillStyle = '#0a1810';
        ctx.fillRect(0, 0, gx0 + cols * cellW, gy0);   // top strip
        ctx.fillRect(0, 0, gx0, gy0 + rows * cellH);   // left strip

        ctx.fillStyle = '#5a8a5a';
        ctx.font = `${Math.max(8, Math.min(cellH * 0.7, cellW * 1.4))}px "SF Mono", Menlo, monospace`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        // Top ruler row 1: "tens" digit at col 10, 20, 30, ..., highlights.
        for (let c = 10; c <= cols; c += 10) {
            const x = gx0 + (c - 1) * cellW + cellW / 2;
            const y = cellH / 2;
            ctx.fillText(String(Math.floor(c / 10)), x, y);
        }
        // Top ruler row 2: every-column units digit (1..0 cycling).
        for (let c = 1; c <= cols; c++) {
            const x = gx0 + (c - 1) * cellW + cellW / 2;
            const y = cellH + cellH / 2;
            ctx.fillText(String(c % 10), x, y);
        }

        // Left ruler: row numbers, right-aligned in the strip.
        ctx.textAlign = 'right';
        for (let r = 1; r <= rows; r++) {
            const x = gx0 - 3;
            const y = gy0 + (r - 1) * cellH + cellH / 2;
            ctx.fillText(String(r), x, y);
        }

        // Crisp separator between rulers and grid.
        ctx.strokeStyle = '#1f3a1f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, gy0 + 0.5);
        ctx.lineTo(gx0 + cols * cellW, gy0 + 0.5);
        ctx.moveTo(gx0 + 0.5, 0);
        ctx.lineTo(gx0 + 0.5, gy0 + rows * cellH);
        ctx.stroke();

        // Restore drawing defaults for the rest of draw().
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
    }

    _drawRecord (record, isOverlay) {
        this._drawRecordChrome(record, isOverlay);
        const offset = recordOffset(record);
        for (const it of record.items) {
            if (it.kind === 'field') it._effectiveLength = effectiveLength(it, record.items, this.document.cols);
        }
        for (const it of record.items) {
            const selected = !isOverlay && it.id === this.selection;
            this._drawItem(it, selected, isOverlay, record, offset);
        }
    }

    /** Renders the linked subfile (SFL) of an SFLCTL record, repeated
     *  SFLPAG times starting at the SFL items' anchor row.  Items remain
     *  selectable through the linked record's overlay - selection itself
     *  isn't drawn on the repeats, only on the canonical first row.
     *  Message subfiles (SFLMSGRCD present) are rendered as a single
     *  yellow status line at the SFLMSGRCD row instead. */
    _drawLinkedSubfile (sflctl) {
        // Message-subfile path: SFLMSGRCD(row) declares a single message
        // line, not a list of records.
        const msgRcd = sflctl.keywords.find(kw => kw.name === 'SFLMSGRCD');
        if (msgRcd) {
            const msgRow = parseInt(msgRcd.args?.[0], 10);
            if (Number.isFinite(msgRow)) {
                const { ctx } = this;
                const x = 0;
                const y = (msgRow - 1) * this.cellH;
                const w = this.document.cols * this.cellW;
                const h = this.cellH;
                ctx.fillStyle = 'rgba(220, 180, 80, 0.18)';
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = '#cca844';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
                ctx.fillStyle = '#cca844';
                ctx.font = `${Math.max(9, this.fontSize * 0.7)}px monospace`;
                ctx.fillText('◆ message line (SFLMSGRCD)', x + 4, y + h / 2 + 1);
            }
            return;
        }

        const linkKw = sflctl.keywords.find(kw => kw.name === 'SFLCTL');
        if (!linkKw || !linkKw.args.length) return;
        const sflName = linkKw.args[0];
        const sfl = this.document.records.find(r => r.name === sflName && r.type === 'SFL');
        if (!sfl || !sfl.items.length) return;
        const sflpag = readNumericKeyword(sflctl, 'SFLPAG') ?? 0;
        const sflsiz = readNumericKeyword(sflctl, 'SFLSIZ') ?? sflpag;
        const rows   = sflpag > 0 ? sflpag : (sflsiz > 0 ? sflsiz : 1);

        const anchorRow = Math.min(
            ...sfl.items.filter(it => !(it.kind === 'field' && it.usage === 'H'))
                        .map(it => it.row));
        if (!Number.isFinite(anchorRow)) return;

        // Subtle full-area backdrop so the subfile region is obvious.
        const { ctx } = this;
        ctx.fillStyle = 'rgba(80, 150, 220, 0.06)';
        ctx.fillRect(0, (anchorRow - 1) * this.cellH,
                     this.document.cols * this.cellW, rows * this.cellH);

        // Pre-compute effective widths on the templates (REFFLD clamp).
        for (const tpl of sfl.items) {
            if (tpl.kind === 'field') tpl._effectiveLength = effectiveLength(tpl, sfl.items, this.document.cols);
        }

        // Repeat each SFL item `rows` times, offsetting its row.  The
        // spread carries _effectiveLength into the shifted copies.
        for (let r = 0; r < rows; r++) {
            for (const tplItem of sfl.items) {
                if (tplItem.kind === 'field' && tplItem.usage === 'H') continue;
                const shifted = { ...tplItem, row: tplItem.row + r,
                                  _isSubfileRepeat: r > 0 };
                this._drawItem(shifted, false, /*isOverlay*/ false, sfl);
            }
        }

        // Optional scroll bar.  When SFLEND has *SCRBAR among its args we
        // render an ENPTUI-style scroll bar on the right edge of the
        // subfile area.  Thumb is shown at "top half" by default since
        // we don't have runtime state.
        const sflend = sflctl.keywords.find(k => k.name === 'SFLEND');
        if (sflend && (sflend.args ?? []).some(a => String(a).toUpperCase() === '*SCRBAR')) {
            this._drawScrollBar(anchorRow, rows, this.document.cols);
        }
    }

    /** Draw an ENPTUI scroll bar at the right edge of the subfile band:
     *  up arrow + track + thumb + down arrow.  No runtime state so the
     *  thumb sits in the middle as a static preview. */
    _drawScrollBar (startRow, rowCount, gridCols) {
        const { ctx } = this;
        const sbCol = gridCols;                       // last col
        const x = (sbCol - 1) * this.cellW;
        const y = (startRow - 1) * this.cellH;
        const w = this.cellW;
        const h = rowCount * this.cellH;
        // Track
        ctx.fillStyle = '#0e1a0e';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#2a4a2a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        // Up / down arrows in the first and last row cells
        ctx.fillStyle = '#6f6';
        ctx.font = `${Math.max(8, this.fontSize * 0.7)}px "SF Mono", Menlo, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▲', x + w / 2, y + this.cellH / 2);
        ctx.fillText('▼', x + w / 2, y + h - this.cellH / 2);
        // Thumb (third of the track, top half by default)
        const thumbH = Math.max(this.cellH * 1.5, h / 4);
        const thumbY = y + this.cellH + (h - this.cellH * 2 - thumbH) * 0.25;
        ctx.fillStyle = 'rgba(102, 255, 102, 0.25)';
        ctx.fillRect(x + 2, thumbY, w - 4, thumbH);
        ctx.strokeStyle = '#6f6';
        ctx.strokeRect(x + 2.5, thumbY + 0.5, w - 5, thumbH - 1);
        ctx.textAlign = 'left';
    }

    _drawRecordChrome (record, isOverlay) {
        if (record.type !== 'WINDOW') return;
        const spec = parseWindowSpec(record);
        if (!spec) return;
        const { top, left, rows, cols, isAutoPos } = spec;
        const borderColor = getWindowBorderColor(record);
        const { ctx } = this;
        const x = (left - 1) * this.cellW;
        const y = (top  - 1) * this.cellH;
        const w = cols * this.cellW;
        const h = rows * this.cellH;
        ctx.fillStyle   = RECORD_BG.WINDOW;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = isOverlay ? 1 : 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.setLineDash([]);
        // Title placement: WDWTITLE supports vertical (`*TOP`/`*BOTTOM`)
        // and horizontal (`*LEFT`/`*CENTER`/`*RIGHT`) modifiers in any
        // order.  IBM defaults to *TOP + *CENTER.
        const title = record.keywords.find(kw => kw.name === 'WDWTITLE');
        if (title && title.args.length) {
            const placement = getWindowTitlePos(title);
            ctx.fillStyle = borderColor;
            ctx.font = `bold ${Math.max(9, this.fontSize * 0.65)}px monospace`;
            const text = extractTitleText(title.args[0]);
            const tw = ctx.measureText(text).width;
            let tx;
            if (placement.horizontal === 'left')       tx = x + 6;
            else if (placement.horizontal === 'right') tx = x + w - tw - 6;
            else                                        tx = x + (w - tw) / 2;
            const ty = placement.vertical === 'bottom' ? (y + h + 12) : (y - 4);
            ctx.fillText(text, tx, ty);
        }
        if (isAutoPos) {
            ctx.fillStyle = '#888';
            ctx.font = `${Math.max(8, this.fontSize * 0.5)}px monospace`;
            const label = spec.hasVar ? '*var-pos' : '*DFT auto-pos';
            ctx.fillText(label, x + w - 100, y + h - 4);
        }
    }

    _drawItem (it, selected, isOverlay, parentRec, offset) {
        // Hidden + Program-to-System fields are invisible at runtime - skip
        // them in the canvas too.  P fields (e.g. WDWTITLE buffer) come in
        // without row/col and would otherwise pile up at (1,1).
        if (it.kind === 'field' && (it.usage === 'H' || it.usage === 'P') && !selected) return;

        // "Hide conditioned" toggle: skip items that only appear when an
        // indicator is on/off.  Massively cleans up screens like CLOCK
        // that have one item per possible digit value, all stacked.
        if (this.document.hideConditioned && it.indicators?.length && !selected) return;

        // Apply parent record's positional offset (WINDOW records hold
        // items in coords relative to the window's top-left corner).
        const drawRow = it.row + (offset?.rowOffset ?? 0);
        const drawCol = it.col + (offset?.colOffset ?? 0);
        const view = drawRow === it.row && drawCol === it.col
            ? it
            : { ...it, row: drawRow, col: drawCol };

        const { ctx } = this;
        const tint = parentRec && parentRec.type !== 'RECORD' ? RECORD_BG[parentRec.type] : null;
        if (tint) {
            const w = itemWidth(view) * this.cellW;
            const h = itemHeight(view) * this.cellH;
            ctx.fillStyle = tint;
            ctx.fillRect((view.col - 1) * this.cellW, (view.row - 1) * this.cellH, w, h);
        }

        // Dispatch by item kind / ENPTUI pattern.  All inner drawers
        // read view.row / view.col so the window offset applies uniformly.
        if (view.kind === 'constant') {
            this._drawTextRun(view, selected, isOverlay, view.text ?? '');
        } else if (view.kind === 'sysvalue') {
            this._drawSysvalue(view, selected, isOverlay);
        } else { // field
            if (hasKeyword(view, 'SNGCHCFLD') || hasKeyword(view, 'MLTCHCFLD')) {
                this._drawChoiceField(view, selected, isOverlay, hasKeyword(view, 'MLTCHCFLD'));
            } else if (mnubarChoicesOf(view).length) {
                this._drawMenuBarField(view, selected, isOverlay);
            } else if (hasPushbtnField(view) || pushbtnChoicesOf(view).length) {
                this._drawPushbtnField(view, selected, isOverlay);
            } else if (cntfldWidth(view)) {
                this._drawCntField(view, selected, isOverlay);
            } else {
                this._drawField(view, selected, isOverlay, parentRec);
            }
        }

        // Item-level indicators badge.
        if (view.indicators && view.indicators.length && !isOverlay) {
            const x = (view.col - 1) * this.cellW;
            const y = (view.row - 1) * this.cellH;
            ctx.font = `${Math.max(7, this.fontSize * 0.45)}px monospace`;
            ctx.fillStyle = '#cc6';
            ctx.fillText(view.indicators.join(','), x + 1, y + this.cellH * 0.18);
        }

        // Selection rectangle (extended footprint).
        if (selected) {
            const x = (view.col - 1) * this.cellW;
            const y = (view.row - 1) * this.cellH;
            const w = itemWidth(view)  * this.cellW;
            const h = itemHeight(view) * this.cellH;
            ctx.fillStyle = SELECT_BG;
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = SELECT;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
            ctx.fillStyle = SELECT;
            ctx.fillRect(x - 2, y - 2, 4, 4);
        }
    }

    // ---- individual drawers --------------------------------------------

    _drawTextRun (it, selected, isOverlay, text) {
        const { ctx } = this;
        const flags = flagsOf(it, 'DSPATR');
        const color = valueOf(it, 'COLOR');
        const colour = COLOR_CSS[color || DEFAULT_COLOR] || COLOR_CSS.GRN;
        const isHi = flags.includes('HI'), isRi = flags.includes('RI');
        const isUl = flags.includes('UL'), isNd = flags.includes('ND');
        // BLINK is a standalone DSPF keyword that's an alias for DSPATR(BL).
        const isBl = flags.includes('BL') || hasKeyword(it, 'BLINK');

        const x = (it.col - 1) * this.cellW;
        const y = (it.row - 1) * this.cellH;
        const w = text.length * this.cellW;
        const h = this.cellH;

        if (isRi) { ctx.fillStyle = colour; ctx.fillRect(x, y, w, h); }
        if (isUl) {
            ctx.strokeStyle = isRi ? '#000' : colour;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + h - 0.5); ctx.lineTo(x + w, y + h - 0.5);
            ctx.stroke();
        }
        if (!isNd) {
            ctx.fillStyle = isRi ? '#000' : colour;
            ctx.globalAlpha = isHi ? 1.0 : 0.85;
            if (isBl) ctx.globalAlpha *= 0.7;
            ctx.font = `${isHi ? 'bold ' : ''}${this.fontSize}px "SF Mono", Menlo, Consolas, monospace`;
            ctx.fillText(text, x + this.cellW * 0.08, y + h / 2 + 1);
            ctx.globalAlpha = 1.0;
        } else {
            // ND on constants: draw the literal at low alpha so the slot
            // is visible but you can tell it won't render at runtime.
            ctx.fillStyle = colour;
            ctx.globalAlpha = 0.25;
            ctx.font = `${this.fontSize}px "SF Mono", Menlo, Consolas, monospace`;
            ctx.fillText(text, x + this.cellW * 0.08, y + h / 2 + 1);
            ctx.globalAlpha = 1.0;
        }
    }

    _drawSysvalue (it, selected, isOverlay) {
        const name = it.sysName || 'DATE';
        const width = SYS_WIDTH[name] ?? Math.max(name.length, 8);
        const text = name.padEnd(width);
        // Force a turquoise tint to mark it as a system value.
        const flags = flagsOf(it, 'DSPATR');
        const colour = COLOR_CSS[valueOf(it, 'COLOR') || 'TRQ'] || COLOR_CSS.TRQ;
        const isHi = flags.includes('HI');
        const { ctx } = this;
        const x = (it.col - 1) * this.cellW;
        const y = (it.row - 1) * this.cellH;
        const w = width * this.cellW;
        const h = this.cellH;
        ctx.fillStyle = 'rgba(80, 200, 200, 0.10)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = colour;
        ctx.font = `${isHi ? 'bold ' : ''}${this.fontSize}px "SF Mono", Menlo, monospace`;
        ctx.fillText(text, x + this.cellW * 0.08, y + h / 2 + 1);
        // Tiny "sys" marker
        ctx.fillStyle = '#888';
        ctx.font = `${Math.max(7, this.fontSize * 0.45)}px monospace`;
        ctx.fillText('sys', x + w - this.cellW * 1.0, y + h * 0.20);
    }

    _drawField (it, selected, isOverlay, parentRec) {
        const { ctx } = this;
        // For entry fields (I/B usage) we fold in record-level
        // CHGINPDFT / ENTFLDATR defaults so the design-time preview shows
        // the appearance the runtime would inherit.
        const isEntry = it.usage === 'I' || it.usage === 'B';
        const defaults = isEntry
            ? getEntryDefaults(parentRec, this.document)
            : { flags: [], color: null };
        const own  = flagsOf(it, 'DSPATR');
        const flags = own.length ? own : defaults.flags;
        const color = valueOf(it, 'COLOR') ?? defaults.color;
        const colour = COLOR_CSS[color || DEFAULT_COLOR] || COLOR_CSS.GRN;
        const isHi = flags.includes('HI'), isRi = flags.includes('RI');
        const isUl = flags.includes('UL'), isNd = flags.includes('ND');
        const isBl = flags.includes('BL') || hasKeyword(it, 'BLINK');
        const isPr = flags.includes('PR'), isHidden = it.usage === 'H';

        // Use the effective (potentially clamped) length so REFFLD fields
        // imported from a DSPF without explicit length stop overlapping.
        const len = Math.max(1, it._effectiveLength ?? it.length ?? 1);
        let text;
        if (it.dataType === 'L') {
            text = (datePlaceholder(valueOf(it, 'DATFMT')) ?? '_'.repeat(len)).slice(0, len);
        } else if (it.dataType === 'T') {
            text = (timePlaceholder(valueOf(it, 'TIMFMT')) ?? '_'.repeat(len)).slice(0, len);
        } else {
            const label = (it.name || '').slice(0, len);
            text = label.length === 0 ? '_'.repeat(len)
                 : label.length === len ? label
                 : label + '_'.repeat(len - label.length);
        }

        const x = (it.col - 1) * this.cellW;
        const y = (it.row - 1) * this.cellH;
        const w = len * this.cellW;
        const h = this.cellH;

        if (isRi) { ctx.fillStyle = colour; ctx.fillRect(x, y, w, h); }
        else if (!isHidden) {
            ctx.fillStyle = isPr ? 'rgba(80,80,80,0.10)' : 'rgba(60,110,60,0.10)';
            ctx.fillRect(x, y, w, h);
        } else {
            ctx.fillStyle = 'rgba(160,80,160,0.10)';
            ctx.fillRect(x, y, w, h);
        }

        if (!isHidden) {
            ctx.strokeStyle = isRi ? '#000' : colour;
            ctx.globalAlpha = isUl ? 1.0 : 0.45;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + h - 0.5); ctx.lineTo(x + w, y + h - 0.5);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        if (!isNd && !isHidden) {
            ctx.fillStyle = isRi ? '#000' : colour;
            ctx.globalAlpha = isHi ? 1.0 : 0.85;
            if (isBl) ctx.globalAlpha *= 0.7;
            ctx.font = `${isHi ? 'bold ' : ''}${this.fontSize}px "SF Mono", Menlo, Consolas, monospace`;
            ctx.fillText(text, x + this.cellW * 0.08, y + h / 2 + 1);
            ctx.globalAlpha = 1.0;
        } else if (isHidden) {
            // Hidden (usage H): not sent to terminal at all.  Show as a
            // small purple "H:name" marker so the designer remembers it
            // exists in the model.
            ctx.fillStyle = '#9466bb';
            ctx.font = `${Math.max(8, this.fontSize * 0.55)}px monospace`;
            ctx.fillText(`H:${it.name || '?'}`, x + 2, y + h / 2 + 1);
        } else if (isNd) {
            // Non-display (DSPATR ND): sent to terminal but invisible.
            // Show as a phantom of the field text at very low alpha so the
            // designer sees the slot is occupied but knows it won't render.
            ctx.fillStyle = colour;
            ctx.globalAlpha = 0.25;
            ctx.font = `${this.fontSize}px "SF Mono", Menlo, Consolas, monospace`;
            ctx.fillText(text, x + this.cellW * 0.08, y + h / 2 + 1);
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#888';
            ctx.font = `${Math.max(7, this.fontSize * 0.45)}px monospace`;
            ctx.fillText('ND', x + w - this.cellW * 0.9, y + h * 0.20);
        }
    }

    _drawChoiceField (it, selected, isOverlay, multi) {
        const choices = choicesOf(it);
        if (choices.length === 0) { this._drawField(it, selected, isOverlay); return; }

        const colour  = COLOR_CSS[valueOf(it, 'COLOR') || DEFAULT_COLOR] || COLOR_CSS.GRN;
        const glyph   = multi ? '☐' : '◯';
        const numRow  = getNumRow(it);
        const numCol  = getNumCol(it);
        const widest  = Math.max(...choices.map(c => c.label.length));
        const colW    = widest + 3;     // "◯ " + label + 1 col gap
        const useRowGrid = numRow > 0 && choices.length > numRow;
        const useColGrid = !useRowGrid && numCol > 0 && choices.length > numCol;

        const { ctx } = this;
        ctx.font = `${this.fontSize}px "SF Mono", Menlo, monospace`;
        for (let i = 0; i < choices.length; i++) {
            let rowIdx, colIdx;
            if (useRowGrid) {
                rowIdx = i % numRow;
                colIdx = Math.floor(i / numRow);
            } else if (useColGrid) {
                rowIdx = Math.floor(i / numCol);
                colIdx = i % numCol;
            } else {
                rowIdx = i;
                colIdx = 0;
            }
            const x = (it.col - 1 + colIdx * colW) * this.cellW;
            const y = (it.row - 1 + rowIdx)       * this.cellH;
            ctx.fillStyle = colour;
            ctx.fillText(`${glyph} ${choices[i].label}`,
                         x + this.cellW * 0.08, y + this.cellH / 2 + 1);
        }
    }

    _drawMenuBarField (it, selected, isOverlay) {
        const items = mnubarChoicesOf(it);
        const colour = COLOR_CSS[valueOf(it, 'COLOR') || 'WHT'] || COLOR_CSS.WHT;
        const { ctx } = this;
        ctx.font = `bold ${this.fontSize}px "SF Mono", Menlo, monospace`;
        let cursorCol = it.col;
        for (let i = 0; i < items.length; i++) {
            const label = items[i].label;
            const x = (cursorCol - 1) * this.cellW;
            const y = (it.row - 1) * this.cellH;
            const w = label.length * this.cellW;
            // Highlight bar background per choice.
            ctx.fillStyle = 'rgba(220, 200, 80, 0.18)';
            ctx.fillRect(x, y, w, this.cellH);
            ctx.fillStyle = colour;
            ctx.fillText(label, x + this.cellW * 0.08, y + this.cellH / 2 + 1);
            cursorCol += label.length + 1;
        }
    }

    _drawPushbtnField (it, selected, isOverlay) {
        const items = pushbtnChoicesOf(it);
        const colour = COLOR_CSS[valueOf(it, 'COLOR') || 'BLU'] || COLOR_CSS.BLU;
        const { ctx } = this;
        ctx.font = `${this.fontSize}px "SF Mono", Menlo, monospace`;
        let cursorCol = it.col;
        const labels = items.length ? items.map(c => `[${c.label}]`) : [`[${it.name || 'PUSH'}]`];
        for (const lbl of labels) {
            const x = (cursorCol - 1) * this.cellW;
            const y = (it.row - 1) * this.cellH;
            const w = lbl.length * this.cellW;
            ctx.fillStyle = 'rgba(85, 153, 255, 0.12)';
            ctx.fillRect(x, y, w, this.cellH);
            ctx.fillStyle = colour;
            ctx.fillText(lbl, x + this.cellW * 0.08, y + this.cellH / 2 + 1);
            cursorCol += lbl.length + 1;
        }
    }

    _drawCntField (it, selected, isOverlay) {
        const width = cntfldWidth(it);
        const total = it.length ?? width;
        const lines = Math.max(1, Math.ceil(total / width));
        const colour = COLOR_CSS[valueOf(it, 'COLOR') || DEFAULT_COLOR] || COLOR_CSS.GRN;
        const { ctx } = this;
        const text = (it.name || '').padEnd(total, '_');
        for (let i = 0; i < lines; i++) {
            const seg = text.substring(i * width, (i + 1) * width);
            const x = (it.col - 1) * this.cellW;
            const y = (it.row - 1 + i) * this.cellH;
            const w = width * this.cellW;
            ctx.fillStyle = 'rgba(60,110,60,0.10)';
            ctx.fillRect(x, y, w, this.cellH);
            ctx.strokeStyle = colour;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + this.cellH - 0.5); ctx.lineTo(x + w, y + this.cellH - 0.5);
            ctx.stroke();
            ctx.fillStyle = colour;
            ctx.font = `${this.fontSize}px "SF Mono", Menlo, monospace`;
            ctx.fillText(seg, x + this.cellW * 0.08, y + this.cellH / 2 + 1);
        }
    }
}

// --------------------------------------------------------------- helpers

export function itemWidth (it) {
    // Pre-computed in _drawRecord / _drawLinkedSubfile for REFFLD fields
    // that should clamp to the next sibling.  Stays set across renders;
    // recomputed every render so it stays in sync with model edits.
    if (it._effectiveLength != null && it.kind === 'field') {
        return Math.max(1, it._effectiveLength);
    }
    return naturalItemWidth(it);
}

/** Walk siblings on the same row to find the gap before the next item
 *  starting at a higher column.  Used to clamp REFFLD fields with
 *  inferred length so they don't overlap their neighbours.  Also bounds
 *  by the grid edge (cols) when supplied. */
export function effectiveLength (it, siblings, maxCol = null) {
    const natural = Math.max(1, it.length ?? 1);
    if (it.kind !== 'field' || !it._lengthInferred || !siblings) return natural;
    let bound = natural;
    let nextCol = null;
    for (const other of siblings) {
        if (other === it) continue;
        if (other.row !== it.row) continue;
        if (other.col <= it.col) continue;
        if (nextCol == null || other.col < nextCol) nextCol = other.col;
    }
    if (nextCol != null) bound = Math.min(bound, nextCol - it.col);
    if (maxCol != null)  bound = Math.min(bound, maxCol - it.col + 1);
    return Math.max(1, bound);
}

function naturalItemWidth (it) {
    if (it.kind === 'constant') return Math.max(1, (it.text ?? '').length);
    if (it.kind === 'sysvalue') {
        const name = it.sysName || 'DATE';
        return SYS_WIDTH[name] ?? Math.max(name.length, 8);
    }
    if (it.kind === 'field') {
        if (hasKeyword(it, 'SNGCHCFLD') || hasKeyword(it, 'MLTCHCFLD')) {
            const c = choicesOf(it);
            if (!c.length) return Math.max(1, it.length ?? 1);
            const widest = Math.max(...c.map(x => x.label.length + 2));
            const numRow = getNumRow(it);
            if (numRow > 0 && c.length > numRow) {
                const cols = Math.ceil(c.length / numRow);
                return (widest + 1) * cols;
            }
            return widest;
        }
        const mb = mnubarChoicesOf(it);
        if (mb.length) return mb.reduce((s, c) => s + c.label.length + 1, 0);
        const pb = pushbtnChoicesOf(it);
        if (pb.length) return Math.max(it.length ?? 1, pb.reduce((s, c) => s + c.label.length + 3, 0));
        const cnt = cntfldWidth(it);
        if (cnt) return cnt;
    }
    return Math.max(1, it.length ?? 1);
}

function readNumericKeyword (target, name) {
    const kw = (target.keywords ?? []).find(k => k.name === name);
    if (!kw) return null;
    const n = parseInt(kw.args?.[0], 10);
    return Number.isFinite(n) ? n : null;
}

/** DATFMT → display placeholder.  IBM rule: fields are stored as 4-digit
 *  years; the format selects how they appear at runtime. */
function datePlaceholder (fmt) {
    switch (String(fmt).toUpperCase()) {
        case '*ISO': case '*JIS': return 'YYYY-MM-DD';
        case '*USA':              return 'MM/DD/YYYY';
        case '*EUR':              return 'DD.MM.YYYY';
        case '*JUL':              return 'YY/DDD';
        case '*YMD':              return 'YY/MM/DD';
        case '*MDY':              return 'MM/DD/YY';
        case '*DMY':              return 'DD/MM/YY';
        case '*JOB':              return '<job-fmt>';
        default:                  return null;
    }
}
/** TIMFMT → display placeholder. */
function timePlaceholder (fmt) {
    switch (String(fmt).toUpperCase()) {
        case '*HMS': case '*ISO': case '*EUR': case '*JIS': return 'HH.MM.SS';
        case '*USA':                                          return 'HH:MM AM';
        default:                                               return null;
    }
}

export function itemHeight (it) {
    if (it.kind !== 'field') return 1;
    if (hasKeyword(it, 'SNGCHCFLD') || hasKeyword(it, 'MLTCHCFLD')) {
        const c = choicesOf(it);
        if (!c.length) return 1;
        const numRow = getNumRow(it);
        if (numRow > 0 && c.length > numRow) return numRow;
        const numCol = getNumCol(it);
        if (numCol > 0 && c.length > numCol) return Math.ceil(c.length / numCol);
        return c.length;
    }
    const cnt = cntfldWidth(it);
    if (cnt) return Math.max(1, Math.ceil((it.length ?? cnt) / cnt));
    return 1;
}

function hasKeyword (it, name) {
    return (it.keywords ?? []).some(kw => kw.name === name);
}

function choicesOf (it) {
    const out = [];
    for (const kw of it.keywords ?? []) {
        if (kw.name === 'CHOICE') {
            out.push({
                num: kw.args[0],
                label: unquoteArg(kw.args.slice(1).join(' ')),
            });
        }
    }
    return out;
}

function mnubarChoicesOf (it) {
    const out = [];
    for (const kw of it.keywords ?? []) {
        if (kw.name === 'MNUBARCHC') {
            out.push({
                num: kw.args[0],
                record: kw.args[1],
                label: unquoteArg(kw.args.slice(2).join(' ')),
            });
        }
    }
    return out;
}

function pushbtnChoicesOf (it) {
    // IBM DSPF official spelling is PSHBTNCHC; we accept PUSHBTNCHC too.
    // Args are (num, label[, action]) - the optional action is a CFnn/
    // CAnn/ENTER alias for what the button triggers.  Render only uses
    // the label.
    const out = [];
    for (const kw of it.keywords ?? []) {
        if (kw.name === 'PUSHBTNCHC' || kw.name === 'PSHBTNCHC') {
            out.push({
                num:    kw.args?.[0],
                label:  unquoteArg(kw.args?.[1] ?? ''),
                action: kw.args?.[2] ?? null,
            });
        }
    }
    return out;
}

function hasPushbtnField (it) {
    return (it.keywords ?? []).some(kw =>
        kw.name === 'PUSHBTNFLD' || kw.name === 'PSHBTNFLD');
}

/** Items inside a WINDOW record are positioned relative to the window's
 *  top-left corner; return the offset to apply at draw time so the static
 *  preview matches what the runtime would show. */
function recordOffset (record) {
    const spec = parseWindowSpec(record);
    if (!spec) return null;
    return { rowOffset: spec.top - 1, colOffset: spec.left - 1 };
}

/** Read WDWBORDER's `*COLOR XXX` arg.  Returns a CSS colour or the
 *  default purple when no override is set. */
function getWindowBorderColor (record) {
    const kw = record.keywords?.find(k => k.name === 'WDWBORDER');
    if (!kw) return RECORD_BORDER.WINDOW;
    const all = (kw.args ?? []).join(' ');
    const m = all.match(/\*COLOR\s+([A-Z]+)/i);
    if (m) {
        const c = m[1].toUpperCase();
        return COLOR_CSS[c] ?? RECORD_BORDER.WINDOW;
    }
    return RECORD_BORDER.WINDOW;
}

/** Parse the placement modifiers on a WDWTITLE keyword.  Accepts the
 *  vertical (`*TOP` / `*BOTTOM`) and horizontal (`*LEFT` / `*CENTER` /
 *  `*RIGHT`) tokens in any order.  IBM defaults: TOP + CENTER. */
function getWindowTitlePos (titleKw) {
    let vertical   = 'top';
    let horizontal = 'center';
    for (const arg of (titleKw.args ?? []).slice(1)) {
        const t = String(arg).toUpperCase();
        if      (t === '*BOTTOM') vertical = 'bottom';
        else if (t === '*TOP')    vertical = 'top';
        else if (t === '*LEFT')   horizontal = 'left';
        else if (t === '*CENTER') horizontal = 'center';
        else if (t === '*RIGHT')  horizontal = 'right';
    }
    return { vertical, horizontal };
}

const DSPATR_LONG_NAMES = {
    UNDERLINE: 'UL', HIGHINTENSITY: 'HI', 'HIGH-INTENSITY': 'HI',
    REVERSEIMAGE: 'RI', 'REVERSE-IMAGE': 'RI', BLINK: 'BL',
    NONDISPLAY: 'ND', 'NON-DISPLAY': 'ND',
    PROTECT: 'PR', POSITIONCURSOR: 'PC', 'POSITION-CURSOR': 'PC',
    COLUMNSEPARATOR: 'CS', 'COLUMN-SEPARATOR': 'CS',
};

/** Resolve record/doc-level default DSPATR flags + COLOR for entry
 *  fields (usage I or B).  Reads CHGINPDFT and ENTFLDATR from the
 *  record AND from `doc.records[0]` (where doc-level keywords end up
 *  after parse). */
function getEntryDefaults (record, doc) {
    const flags = new Set();
    let color = null;

    const scan = (rec) => {
        if (!rec) return;
        const ip = rec.keywords?.find(k => k.name === 'CHGINPDFT');
        if (ip) {
            for (const arg of ip.args ?? []) {
                const t = String(arg).toUpperCase();
                if (['HI','UL','RI','BL','ND','PR','PC','CS'].includes(t)) flags.add(t);
                else if (['GRN','WHT','RED','TRQ','YLW','PNK','BLU'].includes(t)) color = t;
            }
        }
        const ef = rec.keywords?.find(k => k.name === 'ENTFLDATR');
        if (ef) {
            const all = (ef.args ?? []).join(' ').toUpperCase();
            for (const m of all.matchAll(/\*?([A-Z][A-Z\-]+)/g)) {
                const tok = m[1];
                const mapped = DSPATR_LONG_NAMES[tok] ?? (tok.length === 2 ? tok : null);
                if (mapped && ['HI','UL','RI','BL','ND','PR','PC','CS'].includes(mapped)) {
                    flags.add(mapped);
                }
            }
        }
    };
    if (doc) scan(doc.records[0]);              // doc-level (keywords land on records[0])
    if (record !== doc?.records?.[0]) scan(record);   // record-level can add more
    return { flags: [...flags], color };
}

/** Parse a WINDOW(...) record-level keyword into a placement spec.
 *  Three shapes are accepted (per IBM DSPF spec):
 *    WINDOW(top left rows cols [option])           - explicit position
 *    WINDOW(*DFT rows cols [option])               - runtime picks position
 *    WINDOW(*REL top left rows cols [option])      - relative to caller
 *  Any arg may also be a `&FIELD;` reference (program supplies the value
 *  at runtime).  In that case we substitute a sensible placeholder and
 *  flag the spec so the renderer can show "var-pos" next to the chrome. */
function parseWindowSpec (record) {
    if (record.type !== 'WINDOW') return null;
    const win = record.keywords?.find(kw => kw.name === 'WINDOW');
    if (!win || !win.args?.length) return null;
    const a = win.args;
    const parse = (arg, fallback) => {
        if (typeof arg !== 'string') return { value: fallback, isVar: false };
        const t = arg.trim();
        if (/^&[A-Z0-9_]+;?$/i.test(t)) {
            return { value: fallback, isVar: true, varName: t.replace(/[&;]/g, '') };
        }
        const n = parseInt(t, 10);
        return Number.isFinite(n)
            ? { value: n, isVar: false }
            : { value: fallback, isVar: false, invalid: true };
    };
    let topR, leftR, rowsR, colsR;
    let isAutoPos = false;
    if (a[0] === '*DFT') {
        rowsR = parse(a[1], 10);
        colsR = parse(a[2], 40);
        topR  = { value: 4, isVar: false };
        leftR = { value: 8, isVar: false };
        isAutoPos = true;
    } else if (a[0] === '*REL') {
        topR  = parse(a[1], 4);
        leftR = parse(a[2], 8);
        rowsR = parse(a[3], 10);
        colsR = parse(a[4], 40);
    } else {
        topR  = parse(a[0], 4);
        leftR = parse(a[1], 8);
        rowsR = parse(a[2], 10);
        colsR = parse(a[3], 40);
    }
    // If any of the four is a `&var;`, mark as auto-positioned so the
    // designer knows the preview is just a guess.
    const hasVar = [topR, leftR, rowsR, colsR].some(r => r.isVar);
    if (hasVar) isAutoPos = true;
    return {
        top:  topR.value,
        left: leftR.value,
        rows: rowsR.value,
        cols: colsR.value,
        isAutoPos,
        hasVar,
        varNames: {
            top:  topR.varName  ?? null,
            left: leftR.varName ?? null,
            rows: rowsR.varName ?? null,
            cols: colsR.varName ?? null,
        },
    };
}

/** WDWTITLE arg can be a literal, a `&FIELD;` ref, or wrapped in
 *  `(*TEXT ...)`.  Render a friendly preview. */
function extractTitleText (raw) {
    if (!raw) return '';
    let t = String(raw).trim();
    // Strip one layer of outer parens.
    if (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1).trim();
    // Strip *TEXT prefix.
    if (t.startsWith('*TEXT')) t = t.slice(5).trim();
    // Strip one more layer of parens.
    if (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1).trim();
    // Variable reference &NAME; -> <NAME>
    const m = t.match(/^&([A-Z0-9_]+);?$/);
    if (m) return `<${m[1]}>`;
    // Quoted literal
    return unquoteArg(t);
}

function cntfldWidth (it) {
    const kw = (it.keywords ?? []).find(k => k.name === 'CNTFLD');
    if (!kw) return null;
    const n = parseInt(kw.args[0], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function unquoteArg (s) {
    if (!s) return '';
    const t = s.trim();
    if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
        return t.substring(1, t.length - 1).replace(/''/g, "'");
    }
    // Variable reference like &CB01; -> <CB01>.  Common in CHOICE labels
    // that pull their text from a program-filled hidden field.
    const m = t.match(/^&([A-Z0-9_]+);?$/i);
    if (m) return `<${m[1].toUpperCase()}>`;
    return t;
}

/** Extract the `*NUMROW N` directive from an SNGCHCFLD / MLTCHCFLD
 *  field's keyword args; 0 means "no grid, stack vertically". */
function getNumRow (it) {
    for (const kw of it.keywords ?? []) {
        if (kw.name !== 'SNGCHCFLD' && kw.name !== 'MLTCHCFLD') continue;
        const all = (kw.args ?? []).join(' ');
        const m = all.match(/\*NUMROW\s+(\d+)/i);
        if (m) return parseInt(m[1], 10);
    }
    return 0;
}
/** Complementary to NUMROW: `*NUMCOL N` wraps choices by columns. */
function getNumCol (it) {
    for (const kw of it.keywords ?? []) {
        if (kw.name !== 'SNGCHCFLD' && kw.name !== 'MLTCHCFLD') continue;
        const all = (kw.args ?? []).join(' ');
        const m = all.match(/\*NUMCOL\s+(\d+)/i);
        if (m) return parseInt(m[1], 10);
    }
    return 0;
}

/** Display text for an item.  Used by Inspector / tests. */
export function itemDisplayText (it) {
    if (it.kind === 'constant') return it.text ?? '';
    if (it.kind === 'sysvalue') return (it.sysName || 'DATE');
    const len = Math.max(1, it.length ?? 1);
    const label = (it.name || '').slice(0, len);
    if (label.length === 0)   return '_'.repeat(len);
    if (label.length === len) return label;
    return label + '_'.repeat(len - label.length);
}
