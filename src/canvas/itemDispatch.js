// Per-item draw dispatcher.  Decides which renderer to call based on
// item.kind + the ENPTUI keyword patterns it carries, applies the parent
// record's WINDOW offset, and paints the indicator / selection chrome.

import { RECORD_BG } from './theme.js';
import { recordOffset } from './windowSpec.js';
import { itemWidth, itemHeight } from './metrics.js';
import {
    hasKeyword, mnubarChoicesOf, pushbtnChoicesOf,
    hasPushbtnField, cntfldWidth,
} from './keywordReaders.js';
import { drawTextRun, drawSysvalue } from './drawText.js';
import { drawField } from './drawField.js';
import {
    drawChoiceField, drawMenuBarField,
    drawPushbtnField, drawCntField,
} from './drawEnptui.js';

const SELECT    = '#4a9aff';
const SELECT_BG = 'rgba(74, 154, 255, 0.10)';

export function drawItem (gc, it, selected, isOverlay, parentRec, offset) {
    // Hidden + Program-to-System fields are invisible at runtime; skip
    // them in the canvas too (unless selected, so the user can re-target
    // them via the inspector).  Program-to-System (usage P, e.g. WDWTITLE
    // buffer) comes without row/col and would pile up at (1,1).
    if (it.kind === 'field' && (it.usage === 'H' || it.usage === 'P') && !selected) return;

    // "Hide conditioned" toggle: skip items that only appear when an
    // indicator fires.  Massively cleans up screens like CLOCK that stack
    // one item per possible digit value.
    if (gc.document.hideConditioned && it.indicators?.length && !selected) return;

    // Apply WINDOW offset (items in a WINDOW record live in coords
    // relative to the window's top-left corner).
    const drawRow = it.row + (offset?.rowOffset ?? 0);
    const drawCol = it.col + (offset?.colOffset ?? 0);
    const view = drawRow === it.row && drawCol === it.col
        ? it
        : { ...it, row: drawRow, col: drawCol };

    paintParentTint(gc, view, parentRec);
    dispatchRenderer(gc, view, isOverlay, parentRec);

    if (view.indicators?.length && !isOverlay) {
        paintIndicatorBadge(gc, view);
    }
    if (selected) {
        paintSelection(gc, view);
    }
}

function paintParentTint (gc, view, parentRec) {
    const tint = parentRec && parentRec.type !== 'RECORD'
        ? RECORD_BG[parentRec.type]
        : null;
    if (!tint) return;
    const { ctx } = gc;
    const w = itemWidth(view)  * gc.cellW;
    const h = itemHeight(view) * gc.cellH;
    ctx.fillStyle = tint;
    ctx.fillRect((view.col - 1) * gc.cellW, (view.row - 1) * gc.cellH, w, h);
}

function dispatchRenderer (gc, view, isOverlay, parentRec) {
    if (view.kind === 'constant') {
        drawTextRun(gc, view, view.text ?? '');
        return;
    }
    if (view.kind === 'sysvalue') {
        drawSysvalue(gc, view);
        return;
    }

    // Field — branch by ENPTUI pattern in the keywords.
    if (hasKeyword(view, 'SNGCHCFLD') || hasKeyword(view, 'MLTCHCFLD')) {
        drawChoiceField(gc, view, hasKeyword(view, 'MLTCHCFLD'));
    } else if (mnubarChoicesOf(view).length) {
        drawMenuBarField(gc, view);
    } else if (hasPushbtnField(view) || pushbtnChoicesOf(view).length) {
        drawPushbtnField(gc, view);
    } else if (cntfldWidth(view)) {
        drawCntField(gc, view);
    } else {
        drawField(gc, view, parentRec);
    }
}

function paintIndicatorBadge (gc, view) {
    const { ctx } = gc;
    const x = (view.col - 1) * gc.cellW;
    const y = (view.row - 1) * gc.cellH;
    ctx.font = `${Math.max(7, gc.fontSize * 0.45)}px monospace`;
    ctx.fillStyle = '#cc6';
    ctx.fillText(view.indicators.join(','), x + 1, y + gc.cellH * 0.18);
}

function paintSelection (gc, view) {
    const { ctx } = gc;
    const x = (view.col - 1) * gc.cellW;
    const y = (view.row - 1) * gc.cellH;
    const w = itemWidth(view)  * gc.cellW;
    const h = itemHeight(view) * gc.cellH;
    ctx.fillStyle = SELECT_BG;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = SELECT;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = SELECT;
    ctx.fillRect(x - 2, y - 2, 4, 4);
}

// Re-export the chrome helpers the linked-subfile renderer needs to draw
// items through the same dispatcher.
export { recordOffset };
