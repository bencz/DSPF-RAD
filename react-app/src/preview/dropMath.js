// 拖放與點擊的格子數學（T-09，對等 hitTest.js）。
// 純函數，供測試與 DspfGrid 共用。

import { computeLayout } from '@dspf/canvas/styleResolver.js';
import { recordOffset } from '@dspf/canvas/windowSpec.js';

// 事件座標 → (row, col)。cellH = 2 × cellW（D-1 數學）。
export function cellFromPoint (rect, clientX, clientY, cellW, cols, rows) {
    const cellH = cellW * 2;
    const col = Math.floor((clientX - rect.left) / cellW) + 1;
    const row = Math.floor((clientY - rect.top) / cellH) + 1;
    if (col < 1 || row < 1 || col > cols || row > rows) return null;
    return { row, col };
}

// (row, col) 下最上層的項目（鏡像 hitTest.itemAt：H/P、hideCond 跳過、
// WINDOW offset、用 spanCol/spanRow 判定足跡）。
export function itemAtCell (doc, cell) {
    if (!doc) return null;
    const rec = doc.activeRecord;
    if (!rec) return null;
    const offset = recordOffset(rec);
    const dr = offset?.rowOffset ?? 0;
    const dc = offset?.colOffset ?? 0;
    const hideCnd = !!doc.hideConditioned;

    for (let i = rec.items.length - 1; i >= 0; i--) {
        const it = rec.items[i];
        if (it.kind === 'field' && (it.usage === 'H' || it.usage === 'P')) continue;
        if (hideCnd && it.indicators?.length) continue;

        const l = computeLayout(it, rec, doc);
        const drawRow = it.row + dr;
        const drawCol = it.col + dc;
        if (cell.row >= drawRow && cell.row < drawRow + l.spanRow &&
            cell.col >= drawCol && cell.col < drawCol + l.spanCol) {
            return it;
        }
    }
    return null;
}
