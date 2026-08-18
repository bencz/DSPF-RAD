// WINDOW record chrome（T-07 對等 drawRecordChrome）：
// - 單一 absolute div：tint 填滿（RECORD_BG.WINDOW）、虛線邊框、
//   WDWTITLE 標題、auto-pos 角標（*var-pos / *DFT auto-pos）。
// - 座標數學與 canvas 相同（1-indexed：(left-1)*cellW、(top-1)*cellH）。
// - *BOTTOM 標題畫在框外（top: h + 12），overflow visible 不裁剪。
// - 字級沿用 preview 慣例：fontSize = 1.7 × cellW（= canvas
//   min(cellH×0.85, cellW×1.7)，cellH = 2 × cellW 時兩者相等）。

import { RECORD_BG } from '@dspf/canvas/theme.js';
import {
    parseWindowSpec, getWindowBorderColor,
    getWindowTitlePos, extractTitleText,
} from '@dspf/canvas/windowSpec.js';

export { recordOffset } from '@dspf/canvas/windowSpec.js';

export function RecordChrome ({ record, cellW }) {
    if (record.type !== 'WINDOW') return null;
    const spec = parseWindowSpec(record);
    if (!spec) return null;

    const { top, left, rows, cols, isAutoPos, hasVar } = spec;
    const cellH = cellW * 2;
    const fontSize = 1.7 * cellW;

    const x = (left - 1) * cellW;
    const y = (top  - 1) * cellH;
    const w = cols * cellW;
    const h = rows * cellH;

    const borderColor = getWindowBorderColor(record);

    const title = record.keywords.find(kw => kw.name === 'WDWTITLE');

    let titleNode = null;
    if (title && title.args.length) {
        const placement = getWindowTitlePos(title);
        const text = extractTitleText(title.args[0]);
        const pos = {
            position: 'absolute',
            fontWeight: 'bold',
            fontSize: `${Math.max(9, fontSize * 0.65)}px`,
            fontFamily: 'monospace',
            color: borderColor,
            whiteSpace: 'nowrap',
            top: placement.vertical === 'bottom' ? h + 12 : -4,
        };
        if (placement.horizontal === 'left') {
            pos.left = 6;
        } else if (placement.horizontal === 'right') {
            pos.right = 6;
        } else {
            pos.left = 0;
            pos.right = 0;
            pos.textAlign = 'center';
        }
        titleNode = <div style={pos}>{text}</div>;
    }

    const style = {
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        boxSizing: 'border-box',
        overflow: 'visible',
        backgroundColor: RECORD_BG.WINDOW,
        border: `1.5px dashed ${borderColor}`,
    };

    return (
        <div style={style}>
            {titleNode}
            {isAutoPos && (
                <div style={{
                    position: 'absolute',
                    left: w - 100,
                    top: h - 4,
                    color: '#888',
                    fontSize: `${Math.max(8, fontSize * 0.5)}px`,
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                }}>
                    {hasVar ? '*var-pos' : '*DFT auto-pos'}
                </div>
            )}
        </div>
    );
}
