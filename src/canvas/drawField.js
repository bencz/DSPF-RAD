// Regular input/output/both field renderer.  Hidden (H) and Non-display
// (ND) fields paint a slot-marker so the designer can still see them.

import { COLOR_CSS, DEFAULT_COLOR } from '../Attributes.js';
import { flagsOf, valueOf } from '../model/keywords.js';
import { hasKeyword } from './keywordReaders.js';
import { datePlaceholder, timePlaceholder } from './metrics.js';
import { getEntryDefaults } from './entryDefaults.js';

export function drawField (gc, it, parentRec) {
    const { ctx } = gc;

    const styling = resolveStyling(it, parentRec, gc.document);
    const text    = renderText(it);

    const x = (it.col - 1) * gc.cellW;
    const y = (it.row - 1) * gc.cellH;
    const len = Math.max(1, it._effectiveLength ?? it.length ?? 1);
    const w   = len * gc.cellW;
    const h   = gc.cellH;

    paintBackground(ctx, x, y, w, h, styling);
    if (!styling.isHidden) paintUnderline(ctx, x, y, w, h, styling);
    paintText(ctx, x, y, w, h, gc, it, text, styling);
}

// Resolve flags + colour by folding in record-level entry defaults (only
// for entry usages I and B; output fields stay independent).
function resolveStyling (it, parentRec, doc) {
    const isEntry  = it.usage === 'I' || it.usage === 'B';
    const defaults = isEntry
        ? getEntryDefaults(parentRec, doc)
        : { flags: [], color: null };
    const own   = flagsOf(it, 'DSPATR');
    const flags = own.length ? own : defaults.flags;
    const color = valueOf(it, 'COLOR') ?? defaults.color;

    return {
        flags, color,
        colour:   COLOR_CSS[color || DEFAULT_COLOR] || COLOR_CSS.GRN,
        isHi:     flags.includes('HI'),
        isRi:     flags.includes('RI'),
        isUl:     flags.includes('UL'),
        isNd:     flags.includes('ND'),
        isBl:     flags.includes('BL') || hasKeyword(it, 'BLINK'),
        isPr:     flags.includes('PR'),
        isHidden: it.usage === 'H',
    };
}

function renderText (it) {
    const len = Math.max(1, it._effectiveLength ?? it.length ?? 1);
    if (it.dataType === 'L') {
        return (datePlaceholder(valueOf(it, 'DATFMT')) ?? '_'.repeat(len)).slice(0, len);
    }
    if (it.dataType === 'T') {
        return (timePlaceholder(valueOf(it, 'TIMFMT')) ?? '_'.repeat(len)).slice(0, len);
    }
    const label = (it.name || '').slice(0, len);
    if (label.length === 0)   return '_'.repeat(len);
    if (label.length === len) return label;
    return label + '_'.repeat(len - label.length);
}

function paintBackground (ctx, x, y, w, h, s) {
    if (s.isRi) {
        ctx.fillStyle = s.colour;
    } else if (!s.isHidden) {
        ctx.fillStyle = s.isPr ? 'rgba(80,80,80,0.10)' : 'rgba(60,110,60,0.10)';
    } else {
        ctx.fillStyle = 'rgba(160,80,160,0.10)';
    }
    ctx.fillRect(x, y, w, h);
}

function paintUnderline (ctx, x, y, w, h, s) {
    ctx.strokeStyle = s.isRi ? '#000' : s.colour;
    ctx.globalAlpha = s.isUl ? 1.0 : 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h - 0.5);
    ctx.lineTo(x + w, y + h - 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
}

function paintText (ctx, x, y, w, h, gc, it, text, s) {
    if (s.isHidden) {
        // usage H: not sent to terminal at all.  Tag as "H:name" so the
        // designer remembers it's in the model.
        ctx.fillStyle = '#9466bb';
        ctx.font = `${Math.max(8, gc.fontSize * 0.55)}px monospace`;
        ctx.fillText(`H:${it.name || '?'}`, x + 2, y + h / 2 + 1);
        return;
    }
    if (!s.isNd) {
        ctx.fillStyle = s.isRi ? '#000' : s.colour;
        ctx.globalAlpha = s.isHi ? 1.0 : 0.85;
        if (s.isBl) ctx.globalAlpha *= 0.7;
        ctx.font = `${s.isHi ? 'bold ' : ''}${gc.fontSize}px ` +
                   `"SF Mono", Menlo, Consolas, monospace`;
        ctx.fillText(text, x + gc.cellW * 0.08, y + h / 2 + 1);
        ctx.globalAlpha = 1.0;
        return;
    }
    // DSPATR ND: sent to the terminal but invisible.  Show a phantom of
    // the field text at low alpha so the slot is obvious.
    ctx.fillStyle = s.colour;
    ctx.globalAlpha = 0.25;
    ctx.font = `${gc.fontSize}px "SF Mono", Menlo, Consolas, monospace`;
    ctx.fillText(text, x + gc.cellW * 0.08, y + h / 2 + 1);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#888';
    ctx.font = `${Math.max(7, gc.fontSize * 0.45)}px monospace`;
    ctx.fillText('ND', x + w - gc.cellW * 0.9, y + h * 0.20);
}
