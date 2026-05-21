// Pointer → grid translation and the inverse: which item is under a
// (row, col).  Both honour the active record's WINDOW offset and skip
// invisible items so clicks land on what the user actually sees.

import { recordOffset } from './windowSpec.js';
import { itemWidth, itemHeight } from './metrics.js';

export function cellAt (gc, clientX, clientY) {
    if (!gc.document) return null;
    const rect = gc.canvas.getBoundingClientRect();
    const x = clientX - rect.left - gc.rulerCols * gc.cellW;
    const y = clientY - rect.top  - gc.rulerRows * gc.cellH;
    if (x < 0 || y < 0) return null;
    const col = Math.floor(x / gc.cellW) + 1;
    const row = Math.floor(y / gc.cellH) + 1;
    if (col < 1 || row < 1 || col > gc.document.cols || row > gc.document.rows) {
        return null;
    }
    return { row, col };
}

// Top-most item whose displayed footprint contains (row, col).  Mirrors
// what the renderer skips so the user can't click a ghost hidden item.
export function itemAt (gc, row, col) {
    if (!gc.document) return null;
    const rec     = gc.document.activeRecord;
    const offset  = recordOffset(rec);
    const dr      = offset?.rowOffset ?? 0;
    const dc      = offset?.colOffset ?? 0;
    const items   = rec.items;
    const hideCnd = !!gc.document.hideConditioned;

    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.kind === 'field' && (it.usage === 'H' || it.usage === 'P')) continue;
        if (hideCnd && it.indicators?.length) continue;

        const drawRow = it.row + dr;
        const drawCol = it.col + dc;
        const w = itemWidth(it);
        const h = itemHeight(it);
        if (row >= drawRow && row < drawRow + h &&
            col >= drawCol && col < drawCol + w) {
            return it;
        }
    }
    return null;
}
