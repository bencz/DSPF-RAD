// 系統值內容（T-04 對等 drawSysvalue）：
// TRQ tint 底色、sysName 補寬、sys 角標。COLOR 預設 TRQ。

import { flagsOf, valueOf } from '@dspf/model/keywords.js';
import { COLOR_CSS } from '@dspf/Attributes.js';
import { SYS_WIDTH } from '@dspf/canvas/theme.js';

export function SysvalueItem ({ item }) {
    const name = item.sysName || 'DATE';
    const width = SYS_WIDTH[name] ?? Math.max(name.length, 8);
    const isHi = flagsOf(item, 'DSPATR').includes('HI');
    const colour = COLOR_CSS[valueOf(item, 'COLOR') || 'TRQ'] || COLOR_CSS.TRQ;

    return (
        <div style={{
            position: 'relative',
            color: colour,
            fontWeight: isHi ? 'bold' : 'normal',
            backgroundImage: 'linear-gradient(rgba(80,200,200,0.10), rgba(80,200,200,0.10))',
        }}>
            {name.padEnd(width)}
            <span className="dspf-sys-marker">sys</span>
        </div>
    );
}
