// ENPTUI widget 內容（T-05/T-07/T-08，對等 src/canvas/drawEnptui.js）：
// - ChoiceField：SNGCHCFLD / MLTCHCFLD 的 glyph + label；*NUMROW / *NUMCOL
//   網格沿用 canvas gridPos 數學（monospace 每格一字，colW = widest + 3）。
// - MenuBarField：水平 MNUBARCHC 臂，粗體 + 中性 highlight 底。
// - PushbtnField：水平 `[label]` 按鈕；無 PSHBTNCHC 時退化成 `[name]`。
// - CntField：以 CNTFLD 寬度換行，每行各自底線。
// 外層定位（grid span / record tint / 選取 / 點擊）由 DspfItem 處理；
// 此處只畫內容與內容樣式（顏色/粗體/底線），互動屬 T-12。
//
// 與 canvas 的對齊約定：
// - .dspf-item 已提供 monospace font、white-space: pre 與 0.08em 水平內縮
//   （= canvas 的 x + cellW * 0.08），故元件內不再加 padding。
// - lineHeight: 1 讓每一行文字佔一個網格列（fontSize = 1.7 × cellW）。

import { hasKeyword, valueOf } from '@dspf/model/keywords.js';
import { COLOR_CSS, DEFAULT_COLOR } from '@dspf/Attributes.js';
import {
    choicesOf, getNumRow, getNumCol,
    mnubarChoicesOf, pushbtnChoicesOf, cntfldWidth,
} from '@dspf/canvas/keywordReaders.js';

import { FieldItem } from './FieldItem.jsx';

// SNGCHCFLD / MLTCHCFLD：預設垂直堆疊，*NUMROW / *NUMCOL 翻成網格。
// glyph 與 canvas 逐字一致：MLTCHCFLD 用 '☐'，SNGCHCFLD 用 '◯'。
export function ChoiceField ({ item }) {
    const choices = choicesOf(item);
    if (!choices.length) return <FieldItem item={item} />;

    const colour = COLOR_CSS[valueOf(item, 'COLOR') || DEFAULT_COLOR] || COLOR_CSS.GRN;
    const glyph  = hasKeyword(item, 'MLTCHCFLD') ? '☐' : '◯';
    const numRow = getNumRow(item);
    const numCol = getNumCol(item);
    const widest = Math.max(...choices.map(c => c.label.length));
    const colW   = widest + 3;     // "◯ " + label + 1 col gap

    const useRowGrid = numRow > 0 && choices.length > numRow;
    const useColGrid = !useRowGrid && numCol > 0 && choices.length > numCol;

    // gridPos 數學：row-grid → colIdx = i / numRow；col-grid → rowIdx = i / numCol。
    const rows = [];
    for (let i = 0; i < choices.length; i++) {
        const rowIdx = useRowGrid
            ? i % numRow
            : useColGrid
                ? Math.floor(i / numCol)
                : i;
        const colIdx = useRowGrid
            ? Math.floor(i / numRow)
            : useColGrid
                ? i % numCol
                : 0;
        if (!rows[rowIdx]) rows[rowIdx] = [];
        rows[rowIdx][colIdx] = `${glyph} ${choices[i].label}`;
    }
    // 每格以 colW 補到等寬，下一欄從 colIdx * colW 開始（canvas 的 x 數學）。
    const content = rows
        .map(row => {
            let line = '';
            for (let c = 0; c < row.length; c++) {
                line += (row[c] ?? '').padEnd(c < row.length - 1 ? colW : 0);
            }
            return line;
        })
        .join('\n');

    return (
        <div style={{
            color: colour,
            lineHeight: 1,
            whiteSpace: 'pre',
        }}>
            {content}
        </div>
    );
}

// MNUBAR 記錄上的水平選單臂。canvas 在臂之間留 1 欄空白（無 '|' 字元），
// 每臂墊淡黃 highlight；此處以 ' ' 分隔 + per-arm 背景重現。
export function MenuBarField ({ item }) {
    const items  = mnubarChoicesOf(item);
    const colour = COLOR_CSS[valueOf(item, 'COLOR') || 'WHT'] || COLOR_CSS.WHT;

    return (
        <div style={{
            color: colour,
            fontWeight: 'bold',
            lineHeight: 1,
            whiteSpace: 'pre',
        }}>
            {items.map((c, i) => (
                <span key={i}>
                    {i > 0 ? ' ' : ''}
                    <span style={{ backgroundColor: 'rgba(220, 200, 80, 0.18)' }}>{c.label}</span>
                </span>
            ))}
        </div>
    );
}

// PSHBTNFLD / PUSHBTNFLD：水平 `[label]` 按鈕，淡藍 highlight；沒有
// PSHBTNCHC 時畫 `[name]`（canvas 的 placeholder 行為）。GUTTER 依 D-6
// 忽略，與 canvas 的水平佈局對齊。
export function PushbtnField ({ item }) {
    const items  = pushbtnChoicesOf(item);
    const colour = COLOR_CSS[valueOf(item, 'COLOR') || 'BLU'] || COLOR_CSS.BLU;
    const labels = items.length
        ? items.map(c => `[${c.label}]`)
        : [`[${item.name || 'PUSH'}]`];

    return (
        <div style={{
            color: colour,
            lineHeight: 1,
            whiteSpace: 'pre',
        }}>
            {labels.map((lbl, i) => (
                <span key={i}>
                    {i > 0 ? ' ' : ''}
                    <span style={{ backgroundColor: 'rgba(85, 153, 255, 0.12)' }}>{lbl}</span>
                </span>
            ))}
        </div>
    );
}

// CNTFLD(N)：欄位名以 '_' 墊到 total，按 width 換行；每行獨立底線 +
// 淡綠底（canvas 的 per-row fillRect + stroke）。
export function CntField ({ item }) {
    const width  = cntfldWidth(item) ?? Math.max(1, item.length ?? 1);
    const total  = item.length ?? width;
    const lines  = Math.max(1, Math.ceil(total / width));
    const colour = COLOR_CSS[valueOf(item, 'COLOR') || DEFAULT_COLOR] || COLOR_CSS.GRN;
    const text   = (item.name || '').padEnd(total, '_');

    const segments = [];
    for (let i = 0; i < lines; i++) {
        segments.push(text.substring(i * width, (i + 1) * width));
    }

    return (
        <div style={{
            color: colour,
            lineHeight: 1,
            whiteSpace: 'pre',
        }}>
            {segments.map((seg, i) => (
                <div key={i} style={{
                    backgroundColor: 'rgba(60,110,60,0.10)',
                    borderBottom: `1px solid ${colour}`,
                }}>
                    {seg}
                </div>
            ))}
        </div>
    );
}
