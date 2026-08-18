// 常數內容（T-04 對等 drawTextRun）：
// RI 反白底、UL 底線、ND 低透明度、HI 粗體、BLINK 0.7。

import { flagsOf, valueOf } from '@dspf/model/keywords.js';
import { COLOR_CSS, DEFAULT_COLOR } from '@dspf/Attributes.js';

export function ConstantItem ({ item }) {
    const flags = flagsOf(item, 'DSPATR');
    const isHi = flags.includes('HI');
    const isRi = flags.includes('RI');
    const isUl = flags.includes('UL');
    const isNd = flags.includes('ND');
    const isBl = flags.includes('BL')
        || (item.keywords ?? []).some((k) => k.name === 'BLINK');
    const colour = COLOR_CSS[valueOf(item, 'COLOR') || DEFAULT_COLOR] || COLOR_CSS.GRN;

    const style = {
        position: 'relative',
        color: isRi ? '#000' : colour,
        fontWeight: isHi ? 'bold' : 'normal',
        opacity: isBl ? 0.7 : 1,
        backgroundImage: isRi ? `linear-gradient(${colour}, ${colour})` : undefined,
        textDecoration: isUl ? 'underline' : 'none',
    };
    if (isNd) style.opacity = 0.25;

    return <div style={style}>{item.text ?? ''}</div>;
}
