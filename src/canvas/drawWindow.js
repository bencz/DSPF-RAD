// WINDOW record chrome: dashed border, faint tinted fill, title text at
// the placement modifier's spot, optional "auto-pos" badge when geometry
// depends on a program variable.

import { RECORD_BG } from './theme.js';
import {
    parseWindowSpec, getWindowBorderColor,
    getWindowTitlePos, extractTitleText,
} from './windowSpec.js';

export function drawRecordChrome (gc, record, isOverlay) {
    if (record.type !== 'WINDOW') return;
    const spec = parseWindowSpec(record);
    if (!spec) return;

    const { top, left, rows, cols, isAutoPos } = spec;
    const borderColor = getWindowBorderColor(record);
    const { ctx } = gc;

    const x = (left - 1) * gc.cellW;
    const y = (top  - 1) * gc.cellH;
    const w = cols * gc.cellW;
    const h = rows * gc.cellH;

    ctx.fillStyle = RECORD_BG.WINDOW;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isOverlay ? 1 : 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.setLineDash([]);

    drawTitle(ctx, gc, record, borderColor, x, y, w, h);

    if (isAutoPos) {
        ctx.fillStyle = '#888';
        ctx.font = `${Math.max(8, gc.fontSize * 0.5)}px monospace`;
        const label = spec.hasVar ? '*var-pos' : '*DFT auto-pos';
        ctx.fillText(label, x + w - 100, y + h - 4);
    }
}

function drawTitle (ctx, gc, record, borderColor, x, y, w, h) {
    const title = record.keywords.find(kw => kw.name === 'WDWTITLE');
    if (!title || !title.args.length) return;

    const placement = getWindowTitlePos(title);
    const text      = extractTitleText(title.args[0]);
    ctx.fillStyle = borderColor;
    ctx.font = `bold ${Math.max(9, gc.fontSize * 0.65)}px monospace`;
    const tw = ctx.measureText(text).width;

    let tx;
    if      (placement.horizontal === 'left')  tx = x + 6;
    else if (placement.horizontal === 'right') tx = x + w - tw - 6;
    else                                        tx = x + (w - tw) / 2;
    const ty = placement.vertical === 'bottom' ? (y + h + 12) : (y - 4);

    ctx.fillText(text, tx, ty);
}
