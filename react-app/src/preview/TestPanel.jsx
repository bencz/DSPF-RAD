// 互動 FUNCTION TEST 面板（T-12，契約 C-6）。
// - 產生腳本：對每個 pushbtn 點擊並斷言 AID 記錄；每個 choice 切換並
//   斷言選取；最後斷言 doc 未變（D-8：互動不寫 doc）。
// - 結果：PASS / FAIL 清單，一鍵重跑。
// - getGrid 可注入（測試用）；預設查詢右側預覽的 grid。

import { useState } from 'react';

import { itemSignature } from '@dspf/canvas/styleResolver.js';
import {
    hasKeyword, pushbtnChoicesOf,
} from '@dspf/canvas/keywordReaders.js';

import { simClear, simGet } from './simulation.js';

export function TestPanel ({ doc, getGrid }) {
    const [results, setResults] = useState(null);
    const gridOf = getGrid ?? (() => document.querySelector('#reactGridPane .dspf-grid'));

    const run = () => {
        simClear();
        const grid = gridOf();
        if (!grid) {
            setResults([{ step: 'grid not found', pass: false, detail: '' }]);
            return;
        }
        const out = [];
        const before = snapshot(doc);

        for (const it of doc.activeRecord.items) {
            const sig = itemSignature(it);
            const el = grid.querySelector(`.dspf-item[data-sig="${CSS.escape(sig)}"]`);
            if (!el) continue;

            if (hasKeyword(it, 'PSHBTNFLD') || pushbtnChoicesOf(it).length) {
                const btn = el.querySelector('.dspf-pb');
                if (btn) btn.click();
                const sim = simGet(sig);
                out.push({
                    step: `click pushbtn ${it.name || sig.slice(0, 12)}`,
                    pass: !!sim?.aid,
                    detail: sim?.aid ? `AID=${sim.aid}` : 'no AID recorded',
                });
            } else if (hasKeyword(it, 'SNGCHCFLD') || hasKeyword(it, 'MLTCHCFLD')) {
                const first = el.querySelector('[data-choice="0"]');
                if (first) first.click();
                const sim = simGet(sig);
                out.push({
                    step: `toggle choice ${it.name || sig.slice(0, 12)}`,
                    pass: !!sim?.selected?.has?.(0),
                    detail: sim?.selected?.has?.(0) ? 'selected' : 'not selected',
                });
            }
        }

        const unchanged = snapshot(doc) === before;
        out.push({ step: 'doc unchanged after interactions', pass: unchanged, detail: '' });
        setResults(out);
    };

    return (
        <div className="test-panel">
            <button type="button" className="test-run" onClick={run}>Run function tests</button>
            {results && (
                <ul className="test-results">
                    {results.map((r, i) => (
                        <li key={i} className={r.pass ? 'test-pass' : 'test-fail'}>
                            {r.pass ? 'PASS' : 'FAIL'} {r.step}
                            {r.detail ? ` (${r.detail})` : ''}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// doc 內容快照（不含 id：id 每次 parse 重生，比較語意不比較身份）。
function snapshot (doc) {
    return JSON.stringify(doc.records.map((r) => ({
        name: r.name,
        type: r.type,
        items: r.items.map((i) => ({
            kind: i.kind, name: i.name ?? '', text: i.text ?? '',
            row: i.row, col: i.col,
            length: i.length ?? null, usage: i.usage ?? '', dataType: i.dataType ?? '',
            keywords: (i.keywords ?? []).map((k) => [k.name, k.args ?? [], k.indicators ?? []]),
        })),
    })));
}
