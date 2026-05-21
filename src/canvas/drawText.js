// Text-based renderers: constants and sysvalues.  Both honour DSPATR
// flags (HI/UL/RI/ND/BL) and the COLOR keyword.

import { COLOR_CSS, DEFAULT_COLOR } from '../Attributes.js';
import { flagsOf, valueOf } from '../model/keywords.js';
import { hasKeyword } from './keywordReaders.js';
import { SYS_WIDTH } from './theme.js';

export function drawTextRun (gc, it, text) {
    const { ctx } = gc;
    const flags  = flagsOf(it, 'DSPATR');
    const color  = valueOf(it, 'COLOR');
    const colour = COLOR_CSS[color || DEFAULT_COLOR] || COLOR_CSS.GRN;

    const isHi = flags.includes('HI');
    const isRi = flags.includes('RI');
    const isUl = flags.includes('UL');
    const isNd = flags.includes('ND');
    // BLINK is a standalone DSPF keyword and an alias for DSPATR(BL).
    const isBl = flags.includes('BL') || hasKeyword(it, 'BLINK');

    const x = (it.col - 1) * gc.cellW;
    const y = (it.row - 1) * gc.cellH;
    const w = text.length * gc.cellW;
    const h = gc.cellH;

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
        ctx.font = `${isHi ? 'bold ' : ''}${gc.fontSize}px ` +
                   `"SF Mono", Menlo, Consolas, monospace`;
        ctx.fillText(text, x + gc.cellW * 0.08, y + h / 2 + 1);
        ctx.globalAlpha = 1.0;
    } else {
        // ND on a constant: render at low alpha so the slot is visible
        // but you can tell it won't show at runtime.
        ctx.fillStyle = colour;
        ctx.globalAlpha = 0.25;
        ctx.font = `${gc.fontSize}px "SF Mono", Menlo, Consolas, monospace`;
        ctx.fillText(text, x + gc.cellW * 0.08, y + h / 2 + 1);
        ctx.globalAlpha = 1.0;
    }
}

export function drawSysvalue (gc, it) {
    const name   = it.sysName || 'DATE';
    const width  = SYS_WIDTH[name] ?? Math.max(name.length, 8);
    const text   = name.padEnd(width);
    const flags  = flagsOf(it, 'DSPATR');
    // Force a turquoise tint to mark it as a system value.
    const colour = COLOR_CSS[valueOf(it, 'COLOR') || 'TRQ'] || COLOR_CSS.TRQ;
    const isHi   = flags.includes('HI');

    const { ctx } = gc;
    const x = (it.col - 1) * gc.cellW;
    const y = (it.row - 1) * gc.cellH;
    const w = width * gc.cellW;
    const h = gc.cellH;

    ctx.fillStyle = 'rgba(80, 200, 200, 0.10)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colour;
    ctx.font = `${isHi ? 'bold ' : ''}${gc.fontSize}px ` +
               `"SF Mono", Menlo, monospace`;
    ctx.fillText(text, x + gc.cellW * 0.08, y + h / 2 + 1);

    // Tiny "sys" marker so this stands out from regular fields.
    ctx.fillStyle = '#888';
    ctx.font = `${Math.max(7, gc.fontSize * 0.45)}px monospace`;
    ctx.fillText('sys', x + w - gc.cellW * 1.0, y + h * 0.20);
}
