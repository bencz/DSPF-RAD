// T-05 ENPTUI 外觀測試（對等 drawEnptui）。
// 斷言 choice 字形與標籤、pushbtn 標籤、CNTFLD 多列。

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { makeItem } from '@dspf/model/factories.js';

import { DspfItem } from '../DspfItem.jsx';

const doc80 = { cols: 80, rows: 24, records: [] };
const rec = { type: 'RECORD', items: [], keywords: [] };

function renderItem (item) {
    return render(<DspfItem item={item} record={rec} doc={doc80} />)
        .container.querySelector('.dspf-item');
}

function withChoices (head, choices) {
    return makeItem({
        kind: 'field', row: 1, col: 1, name: 'CHC', length: 10,
        usage: 'B', dataType: 'A', decimals: 0,
        keywords: [
            { name: head, args: [], indicators: [] },
            ...choices.map((label, i) => ({
                name: 'CHOICE', args: [String(i + 1), `'${label}'`], indicators: [],
            })),
        ],
    });
}

describe('ChoiceField', () => {
    it('should render radio glyph and labels for SNGCHCFLD', () => {
        const el = renderItem(withChoices('SNGCHCFLD', ['One', 'Two']));
        expect(el.textContent).toContain('◯');
        expect(el.textContent).toContain('One');
        expect(el.textContent).toContain('Two');
    });

    it('should render checkbox glyph for MLTCHCFLD', () => {
        const el = renderItem(withChoices('MLTCHCFLD', ['Tick']));
        expect(el.textContent).toContain('☐');
    });
});

describe('PushbtnField', () => {
    it('should render bracketed button labels', () => {
        const item = makeItem({
            kind: 'field', row: 1, col: 1, name: 'PB', length: 10,
            usage: 'B', dataType: 'A', decimals: 0,
            keywords: [
                { name: 'PSHBTNFLD', args: [], indicators: [] },
                { name: 'PSHBTNCHC', args: ['1', "'OK'"], indicators: [] },
            ],
        });
        const el = renderItem(item);
        expect(el.textContent).toContain('OK');
    });
});

describe('CntField', () => {
    it('should wrap text across multiple rows', () => {
        const item = makeItem({
            kind: 'field', row: 1, col: 1, name: 'MSG', length: 150,
            usage: 'B', dataType: 'A', decimals: 0,
            keywords: [{ name: 'CNTFLD', args: ['030'], indicators: [] }],
        });
        const el = renderItem(item);
        const root = el.querySelector('div');            // CntField 根層
        const rows = root ? [...root.children] : [];     // 逐列 div
        expect(rows).toHaveLength(5);                    // ceil(150 / 30)
        expect(rows[0].textContent.startsWith('MSG')).toBe(true);
        expect(rows[0].textContent.length).toBe(30);
    });
});
