// 欄位內容（T-04 對等 drawField）：
// - 樣式與文字來自共用 styleResolver（與左側 canvas 同源）。
// - 底線：canvas 對非 hidden 欄位恆畫（UL 全 alpha，否則 0.45）。
// - ND 角標、H 標籤與 canvas 相同。

import { resolveItemStyle, renderItemText } from '@dspf/canvas/styleResolver.js';

export function FieldItem ({ item, record, doc }) {
    const s = resolveItemStyle(item, record, doc);
    const text = renderItemText(item);

    const bg = s.isRi
        ? s.colour
        : s.isPr
            ? 'rgba(80,80,80,0.10)'
            : s.isHidden
                ? 'rgba(160,80,160,0.10)'
                : 'rgba(60,110,60,0.10)';
    const ulColor = s.isRi ? '#000' : s.colour;

    const style = {
        position: 'relative',
        color: s.isHidden ? '#9466bb' : s.isRi ? '#000' : s.colour,
        fontWeight: s.isHi ? 'bold' : 'normal',
        opacity: s.isBl ? 0.7 : 1,
        backgroundImage: `linear-gradient(${bg}, ${bg})`,
        borderBottom: s.isHidden
            ? 'none'
            : `1px solid ${s.isUl ? ulColor : `color-mix(in srgb, ${ulColor} 45%, transparent)`}`,
    };
    if (s.isNd) style.opacity = 0.25;

    return (
        <div style={style}>
            {s.isHidden ? `H:${item.name || '?'}` : text}
            {s.isNd && !s.isHidden && <span className="dspf-nd-badge">ND</span>}
        </div>
    );
}
