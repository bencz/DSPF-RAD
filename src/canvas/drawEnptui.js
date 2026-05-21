// ENPTUI widgets: choice fields, menu bars, push buttons, continued
// fields.  They share the dark canvas + COLOR conventions of the regular
// field renderer but each has its own shape.

import { COLOR_CSS, DEFAULT_COLOR } from '../Attributes.js';
import { valueOf } from '../model/keywords.js';
import {
    choicesOf, mnubarChoicesOf, pushbtnChoicesOf,
    getNumRow, getNumCol, cntfldWidth,
} from './keywordReaders.js';
import { drawField } from './drawField.js';

// SNGCHCFLD / MLTCHCFLD: vertical stack by default, *NUMROW / *NUMCOL
// flip to grid layouts.
export function drawChoiceField (gc, it, multi) {
    const choices = choicesOf(it);
    if (!choices.length) { drawField(gc, it); return; }

    const colour = COLOR_CSS[valueOf(it, 'COLOR') || DEFAULT_COLOR] || COLOR_CSS.GRN;
    const glyph  = multi ? '☐' : '◯';
    const numRow = getNumRow(it);
    const numCol = getNumCol(it);
    const widest = Math.max(...choices.map(c => c.label.length));
    const colW   = widest + 3;     // "◯ " + label + 1 col gap

    const useRowGrid = numRow > 0 && choices.length > numRow;
    const useColGrid = !useRowGrid && numCol > 0 && choices.length > numCol;

    const { ctx } = gc;
    ctx.font = `${gc.fontSize}px "SF Mono", Menlo, monospace`;
    for (let i = 0; i < choices.length; i++) {
        const { rowIdx, colIdx } = gridPos(i, { useRowGrid, useColGrid, numRow, numCol });
        const x = (it.col - 1 + colIdx * colW) * gc.cellW;
        const y = (it.row - 1 + rowIdx)        * gc.cellH;
        ctx.fillStyle = colour;
        ctx.fillText(`${glyph} ${choices[i].label}`,
                     x + gc.cellW * 0.08, y + gc.cellH / 2 + 1);
    }
}

function gridPos (i, { useRowGrid, useColGrid, numRow, numCol }) {
    if (useRowGrid) return { rowIdx: i % numRow,         colIdx: Math.floor(i / numRow) };
    if (useColGrid) return { rowIdx: Math.floor(i / numCol), colIdx: i % numCol };
    return { rowIdx: i, colIdx: 0 };
}

export function drawMenuBarField (gc, it) {
    const items  = mnubarChoicesOf(it);
    const colour = COLOR_CSS[valueOf(it, 'COLOR') || 'WHT'] || COLOR_CSS.WHT;
    const { ctx } = gc;
    ctx.font = `bold ${gc.fontSize}px "SF Mono", Menlo, monospace`;

    let cursorCol = it.col;
    for (const choice of items) {
        const label = choice.label;
        const x = (cursorCol - 1) * gc.cellW;
        const y = (it.row - 1)    * gc.cellH;
        const w = label.length    * gc.cellW;
        // Highlight bar per choice (the active one would be inverted at
        // runtime — we paint a neutral tint to keep the design preview
        // stable).
        ctx.fillStyle = 'rgba(220, 200, 80, 0.18)';
        ctx.fillRect(x, y, w, gc.cellH);
        ctx.fillStyle = colour;
        ctx.fillText(label, x + gc.cellW * 0.08, y + gc.cellH / 2 + 1);
        cursorCol += label.length + 1;
    }
}

export function drawPushbtnField (gc, it) {
    const items  = pushbtnChoicesOf(it);
    const colour = COLOR_CSS[valueOf(it, 'COLOR') || 'BLU'] || COLOR_CSS.BLU;
    const { ctx } = gc;
    ctx.font = `${gc.fontSize}px "SF Mono", Menlo, monospace`;

    // No PSHBTNCHCs yet → show a single bracketed placeholder.
    const labels = items.length
        ? items.map(c => `[${c.label}]`)
        : [`[${it.name || 'PUSH'}]`];

    let cursorCol = it.col;
    for (const lbl of labels) {
        const x = (cursorCol - 1) * gc.cellW;
        const y = (it.row - 1)    * gc.cellH;
        const w = lbl.length      * gc.cellW;
        ctx.fillStyle = 'rgba(85, 153, 255, 0.12)';
        ctx.fillRect(x, y, w, gc.cellH);
        ctx.fillStyle = colour;
        ctx.fillText(lbl, x + gc.cellW * 0.08, y + gc.cellH / 2 + 1);
        cursorCol += lbl.length + 1;
    }
}

export function drawCntField (gc, it) {
    const width  = cntfldWidth(it);
    const total  = it.length ?? width;
    const lines  = Math.max(1, Math.ceil(total / width));
    const colour = COLOR_CSS[valueOf(it, 'COLOR') || DEFAULT_COLOR] || COLOR_CSS.GRN;
    const text   = (it.name || '').padEnd(total, '_');
    const { ctx } = gc;

    for (let i = 0; i < lines; i++) {
        const seg = text.substring(i * width, (i + 1) * width);
        const x = (it.col - 1)      * gc.cellW;
        const y = (it.row - 1 + i)  * gc.cellH;
        const w = width             * gc.cellW;

        ctx.fillStyle = 'rgba(60,110,60,0.10)';
        ctx.fillRect(x, y, w, gc.cellH);
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + gc.cellH - 0.5);
        ctx.lineTo(x + w, y + gc.cellH - 0.5);
        ctx.stroke();
        ctx.fillStyle = colour;
        ctx.font = `${gc.fontSize}px "SF Mono", Menlo, monospace`;
        ctx.fillText(seg, x + gc.cellW * 0.08, y + gc.cellH / 2 + 1);
    }
}
