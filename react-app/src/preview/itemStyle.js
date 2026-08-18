// computeLayout → CSS-Grid 定位樣式（契約 C-4）。
// 與 canvas 的 (col-1)*cellW 數學共用同一份 computeLayout，
// 兩邊格子足跡結構上不可能分歧。
// offset：WINDOW 記錄內項目的 recordOffset（窗內座標 → 畫面座標）。

import { computeLayout } from '@dspf/canvas/styleResolver.js';

export function itemStyle (item, record, doc, offset = null) {
    const layout = computeLayout(item, record, doc);
    const row = item.row + (offset?.rowOffset ?? 0);
    const col = item.col + (offset?.colOffset ?? 0);
    // offset 後（WINDOW 內項目）可能超出右緣：以畫面座標重新 clamp。
    const cols = doc?.cols ?? null;
    const spanCol = cols != null
        ? Math.min(layout.spanCol, Math.max(1, cols - col + 1))
        : layout.spanCol;
    return {
        gridColumn: `${col} / span ${spanCol}`,
        gridRow:    `${row} / span ${layout.spanRow}`,
        layout,
    };
}
