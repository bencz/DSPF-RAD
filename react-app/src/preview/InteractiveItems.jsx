// 互動模擬層元件（T-12，D-8）：
// - 互動 state 只存 simulation.js，不寫 doc。
// - choice 切換更新模擬層選取集合（radio 單選 / checkbox 多選）。
// - pushbtn 點擊只記錄 AID（action），不偽造 5250 行為。
// - 內層點擊 stopPropagation，避免觸發 grid 的選取。

import { useSyncExternalStore } from 'react';

import { itemSignature } from '@dspf/canvas/styleResolver.js';
import { COLOR_CSS, DEFAULT_COLOR } from '@dspf/Attributes.js';
import { valueOf } from '@dspf/model/keywords.js';
import {
    choicesOf, pushbtnChoicesOf, hasKeyword, getNumRow, getNumCol,
} from '@dspf/canvas/keywordReaders.js';

import { simGet, simSet, simSubscribe } from './simulation.js';

function useSim (sig) {
    return useSyncExternalStore(simSubscribe, () => simGet(sig) ?? null);
}

export function SimChoiceField ({ item }) {
    const sig = itemSignature(item);
    const sim = useSim(sig);
    const choices = choicesOf(item);
    const isMulti = hasKeyword(item, 'MLTCHCFLD');
    const numRow = getNumRow(item);
    const numCol = getNumCol(item);
    const selected = sim?.selected ?? new Set();
    const colour = COLOR_CSS[valueOf(item, 'COLOR') || DEFAULT_COLOR] || COLOR_CSS.GRN;

    const glyph = (i) => {
        const on = selected.has(i);
        if (isMulti) return on ? '☑' : '☐';
        return on ? '◉' : '◯';
    };

    const toggle = (i, ev) => {
        ev.stopPropagation();
        const next = new Set(selected);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        simSet(sig, { selected: isMulti ? next : new Set([i]) });
    };

    // 佈局：*NUMROW/*NUMCOL 網格或垂直堆疊，與 canvas gridPos 一致。
    const perCol = numCol > 0 ? numCol
        : numRow > 0 ? Math.ceil(choices.length / numRow)
            : 1;
    const rows = [];
    for (let i = 0; i < choices.length; i += perCol) {
        rows.push(choices.slice(i, i + perCol));
    }

    return (
        <div style={{ color: colour, whiteSpace: 'pre' }}>
            {rows.map((row, ri) => (
                <div key={ri}>
                    {row.map((c, i) => {
                        const idx = ri * perCol + i;
                        return (
                            <span key={idx} data-choice={idx} className="dspf-choice"
                                  onClick={(ev) => toggle(idx, ev)}
                                  style={{ cursor: 'pointer', paddingRight: '0.5em' }}>
                                {glyph(idx)} {c.label}
                            </span>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

export function SimPushbtnField ({ item }) {
    const sig = itemSignature(item);
    const sim = useSim(sig);
    const choices = pushbtnChoicesOf(item);
    const colour = COLOR_CSS[valueOf(item, 'COLOR') || 'BLU'] || COLOR_CSS.BLU;

    return (
        <div style={{ color: colour, whiteSpace: 'pre' }}>
            {(choices.length ? choices : [{ label: item.name || 'PUSH' }]).map((c, i) => (
                <button key={i} data-pb={i} className="dspf-pb"
                        onClick={(ev) => {
                            ev.stopPropagation();
                            simSet(sig, { aid: c.action ?? 'ENTER' });
                        }}
                        style={{
                            cursor: 'pointer',
                            marginRight: '0.5em',
                            font: 'inherit',
                            color: 'inherit',
                            background: 'rgba(85,153,255,0.12)',
                            border: '1px solid rgba(85,153,255,0.4)',
                            padding: '0 0.3em',
                        }}>
                    [{c.label}]
                </button>
            ))}
            {sim?.aid && <span className="dspf-aid" data-aid={sim.aid} style={{ color: '#888' }}> AID:{sim.aid}</span>}
        </div>
    );
}
