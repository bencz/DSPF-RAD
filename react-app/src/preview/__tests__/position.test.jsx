// T-03 位置對等測試（position）。
// 斷言 inline style 字串（gridColumn / gridRow），不依賴 jsdom 版面引擎。
// 案例：基礎、越界 clamp、多列 span、usage H skip。

import { describe, expect, it } from 'vitest';
import { render, act } from '@testing-library/react';

import { DspfDocument } from '@dspf/model/index.js';
import { parseDspf } from '@dspf/parser/parseDspf.js';

import { DspfGrid } from '../DspfGrid.jsx';

// 80 欄 DSPF 行建行器（與 styleResolver.test 同款，維持單一 helper 於各檔）。
function line ({ inds = ['', '', ''], nameType = ' ', name = '',
                 refFlag = ' ', length = '', dataType = ' ',
                 usage = ' ', row = '', col = '', kw = '' } = {}) {
    return [
        '     A',
        inds.map((s) => String(s).padEnd(3)).join(''),
        ' ',
        nameType,
        ' ',
        name.padEnd(10),
        refFlag,
        String(length).padStart(5),
        dataType,
        '  ',
        usage,
        String(row).padStart(3),
        String(col).padStart(3),
        kw,
    ].join('');
}

function docFrom (src) {
    const doc = new DspfDocument();
    doc.adopt(parseDspf(src));
    return doc;
}

function renderGrid (doc) {
    const view = render(<DspfGrid doc={doc} />);
    const items = view.container.querySelectorAll('.dspf-item');
    const bySig = {};
    for (const el of items) bySig[el.dataset.sig] = el;
    return { view, items, bySig };
}

describe('DspfGrid placement', () => {
    it('should place a field at its grid position with natural span', () => {
        const src = [
            line({ nameType: 'R', name: 'TEST' }),
            line({ name: 'NAME', length: 10, dataType: 'A', usage: 'O', row: 2, col: 3 }),
        ].join('\n');
        const { bySig } = renderGrid(docFrom(src));
        const el = Object.values(bySig)[0];
        expect(el.style.gridColumn).toBe('3 / span 10');
        expect(el.style.gridRow).toBe('2 / span 1');
    });

    it('should clamp out-of-bounds span to the grid edge', () => {
        const src = [
            line({ nameType: 'R', name: 'TEST' }),
            line({ name: 'WIDE', length: 85, dataType: 'A', usage: 'O', row: 1, col: 2 }),
        ].join('\n');
        const { bySig } = renderGrid(docFrom(src));
        const el = Object.values(bySig)[0];
        expect(el.style.gridColumn).toBe('2 / span 79'); // 80 - 2 + 1
    });

    it('should span multiple rows for CNTFLD fields', () => {
        const src = [
            line({ nameType: 'R', name: 'TEST' }),
            line({ name: 'MSG', length: 150, dataType: 'A', usage: 'B', row: 1, col: 2,
                   kw: 'CNTFLD(030)' }),
        ].join('\n');
        const { bySig } = renderGrid(docFrom(src));
        const el = Object.values(bySig)[0];
        expect(el.style.gridRow).toBe('1 / span 5'); // ceil(150 / 30)
    });

    it('should skip usage H fields', () => {
        const src = [
            line({ nameType: 'R', name: 'TEST' }),
            line({ name: 'HID', length: 10, dataType: 'A', usage: 'H', row: 2, col: 3 }),
            line({ name: 'VIS', length: 10, dataType: 'A', usage: 'O', row: 3, col: 3 }),
        ].join('\n');
        const { items } = renderGrid(docFrom(src));
        expect(items).toHaveLength(1);
        expect(items[0].textContent).toBe('VIS_______');
    });

    it('should re-render when the doc emits', () => {
        const src = [
            line({ nameType: 'R', name: 'TEST' }),
            line({ name: 'NAME', length: 10, dataType: 'A', usage: 'O', row: 2, col: 3 }),
        ].join('\n');
        const doc = docFrom(src);
        const { view } = renderGrid(doc);

        const item = doc.records[0].items[0];
        act(() => { doc.updateItem(item.id, { name: 'RENAMED' }); });

        // 改名 → 內容簽名變 → key 變 → 元素重建。重新查詢。
        const el = view.container.querySelector('.dspf-item');
        expect(el.textContent).toBe('RENAMED___');
    });
});
