// T-08 SFLCTL 連動 SFL 測試：
// - 依 SFLPAG 重複繪製 SFL 項目（複合 key）。
// - SFLSIZ 爆量 clamp 到畫面列數。
// - band 底色與捲軸出現於 *SCRBAR 案例。

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { DspfDocument } from '@dspf/model/index.js';
import { parseDspf } from '@dspf/parser/parseDspf.js';

import { DspfGrid } from '../DspfGrid.jsx';

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

function docFromSfl (pag) {
    const src = [
        line({ nameType: 'R', name: 'SFL01' }),
        line({ name: 'SEL', length: 1, dataType: 'A', usage: 'I', row: 1, col: 2 }),
        line({ name: 'NAME', length: 20, dataType: 'A', usage: 'O', row: 1, col: 4 }),
        line({ nameType: 'R', name: 'SFLCTL' }),
        line({ kw: 'SFLCTL(SFL01)' }),
        line({ kw: `SFLPAG(${String(pag).padStart(4, '0')})` }),
        line({ kw: 'SFLSIZ(50)' }),
    ].join('\n');
    const doc = new DspfDocument();
    doc.adopt(parseDspf(src));
    doc.setActiveRecord(1);   // SFLCTL
    return doc;
}

describe('SubfileBand', () => {
    it('should repeat SFL items per SFLPAG', () => {
        const doc = docFromSfl(5);
        const view = render(<DspfGrid doc={doc} />);
        const grid = view.container.querySelector('.dspf-grid');

        // 2 個 SFL 項目 × 5 列 + band
        expect(grid.querySelectorAll('.dspf-item')).toHaveLength(10);
        expect(grid.querySelector('.dspf-sfl-band')).not.toBeNull();

        // 每列 2 個項目（SEL + NAME），列 1..5 各出現一次
        const atRow = (r) => [...grid.querySelectorAll('.dspf-item')]
            .filter((el) => el.style.gridRow.startsWith(`${r} /`));
        expect(atRow(1)).toHaveLength(2);
        expect(atRow(2)).toHaveLength(2);
        expect(atRow(5)).toHaveLength(2);
    });

    it('should clamp SFLSIZ explosion to the grid rows', () => {
        const doc = docFromSfl(9999);
        const view = render(<DspfGrid doc={doc} />);
        const grid = view.container.querySelector('.dspf-grid');

        // 24 列 - anchorRow(1) + 1 = 24 → 24 × 2 項目，不爆 DOM
        expect(grid.querySelectorAll('.dspf-item')).toHaveLength(48);
    });
});
