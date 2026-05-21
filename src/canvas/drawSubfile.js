// Linked-subfile preview: when the active record is an SFLCTL, paint its
// SFL's items repeated SFLPAG times below the SFLCTL chrome so the
// designer sees the runtime "grid" of records.  Message subfiles
// (SFLMSGRCD present) collapse to a single status line instead.

import { drawItem } from './itemDispatch.js';
import { effectiveLength } from './metrics.js';
import { readNumericKeyword } from './keywordReaders.js';

export function drawLinkedSubfile (gc, sflctl) {
    // Message-subfile branch: SFLMSGRCD(row) declares a single line.
    const msgRcd = sflctl.keywords.find(kw => kw.name === 'SFLMSGRCD');
    if (msgRcd) { drawMessageLine(gc, msgRcd); return; }

    const linkKw = sflctl.keywords.find(kw => kw.name === 'SFLCTL');
    if (!linkKw || !linkKw.args.length) return;
    const sflName = linkKw.args[0];
    const sfl = gc.document.records.find(r =>
        r.name === sflName && r.type === 'SFL');
    if (!sfl || !sfl.items.length) return;

    const sflpag = readNumericKeyword(sflctl, 'SFLPAG') ?? 0;
    const sflsiz = readNumericKeyword(sflctl, 'SFLSIZ') ?? sflpag;
    const rows   = sflpag > 0 ? sflpag : (sflsiz > 0 ? sflsiz : 1);

    const anchorRow = Math.min(
        ...sfl.items
              .filter(it => !(it.kind === 'field' && it.usage === 'H'))
              .map(it => it.row));
    if (!Number.isFinite(anchorRow)) return;

    paintBackdrop(gc, anchorRow, rows);
    prepareTemplateWidths(gc, sfl);

    // Repeat each SFL item `rows` times, offsetting the row.  The spread
    // carries _effectiveLength into the shifted copies.
    for (let r = 0; r < rows; r++) {
        for (const tpl of sfl.items) {
            if (tpl.kind === 'field' && tpl.usage === 'H') continue;
            const shifted = {
                ...tpl,
                row: tpl.row + r,
                _isSubfileRepeat: r > 0,
            };
            drawItem(gc, shifted, /*selected*/ false, /*isOverlay*/ false, sfl);
        }
    }

    maybeDrawScrollbar(gc, sflctl, anchorRow, rows);
}

function drawMessageLine (gc, msgRcd) {
    const msgRow = parseInt(msgRcd.args?.[0], 10);
    if (!Number.isFinite(msgRow)) return;

    const { ctx } = gc;
    const x = 0;
    const y = (msgRow - 1) * gc.cellH;
    const w = gc.document.cols * gc.cellW;
    const h = gc.cellH;

    ctx.fillStyle = 'rgba(220, 180, 80, 0.18)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#cca844';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = '#cca844';
    ctx.font = `${Math.max(9, gc.fontSize * 0.7)}px monospace`;
    ctx.fillText('◆ message line (SFLMSGRCD)', x + 4, y + h / 2 + 1);
}

function paintBackdrop (gc, anchorRow, rows) {
    const { ctx } = gc;
    ctx.fillStyle = 'rgba(80, 150, 220, 0.06)';
    ctx.fillRect(0, (anchorRow - 1) * gc.cellH,
                 gc.document.cols * gc.cellW, rows * gc.cellH);
}

function prepareTemplateWidths (gc, sfl) {
    for (const tpl of sfl.items) {
        if (tpl.kind === 'field') {
            tpl._effectiveLength = effectiveLength(tpl, sfl.items, gc.document.cols);
        }
    }
}

function maybeDrawScrollbar (gc, sflctl, anchorRow, rowCount) {
    const sflend = sflctl.keywords.find(k => k.name === 'SFLEND');
    if (!sflend) return;
    const hasScrbar = (sflend.args ?? []).some(a =>
        String(a).toUpperCase() === '*SCRBAR');
    if (!hasScrbar) return;
    drawScrollBar(gc, anchorRow, rowCount, gc.document.cols);
}

// ENPTUI scroll bar on the right edge of the subfile band: up arrow +
// track + thumb + down arrow.  No runtime state — thumb at top by
// default.
function drawScrollBar (gc, startRow, rowCount, gridCols) {
    const { ctx } = gc;
    const sbCol = gridCols;                       // last col
    const x = (sbCol - 1) * gc.cellW;
    const y = (startRow - 1) * gc.cellH;
    const w = gc.cellW;
    const h = rowCount * gc.cellH;

    // Track
    ctx.fillStyle = '#0e1a0e';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#2a4a2a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Arrows at top / bottom row cells
    ctx.fillStyle = '#6f6';
    ctx.font = `${Math.max(8, gc.fontSize * 0.7)}px "SF Mono", Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲', x + w / 2, y + gc.cellH / 2);
    ctx.fillText('▼', x + w / 2, y + h - gc.cellH / 2);

    // Thumb — roughly a third of the track, sitting in the upper area.
    const thumbH = Math.max(gc.cellH * 1.5, h / 4);
    const thumbY = y + gc.cellH + (h - gc.cellH * 2 - thumbH) * 0.25;
    ctx.fillStyle = 'rgba(102, 255, 102, 0.25)';
    ctx.fillRect(x + 2, thumbY, w - 4, thumbH);
    ctx.strokeStyle = '#6f6';
    ctx.strokeRect(x + 2.5, thumbY + 0.5, w - 5, thumbH - 1);

    ctx.textAlign = 'left';
}
