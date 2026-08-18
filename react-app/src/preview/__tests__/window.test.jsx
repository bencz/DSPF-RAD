// T-07 WINDOW 與 overlay 測試：
// - RecordChrome 畫框（tint、虛線邊、座標數學）。
// - WINDOW 記錄內項目套 recordOffset（窗內座標 → 畫面座標）。
// - overlay 層整層 0.30。

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { DspfDocument } from '@dspf/model/index.js';
import { parseDspf } from '@dspf/parser/parseDspf.js';

import { RecordChrome } from '../RecordChrome.jsx';
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

const WIN_SRC = [
    line({ nameType: 'R', name: 'WIN1' }),
    line({ kw: 'WINDOW(2 6 9 65)' }),
    line({ name: 'F1', length: 10, dataType: 'A', usage: 'O', row: 3, col: 5 }),
    line({ kw: "WDWTITLE((*TEXT 'Double-click moves this window'))" }),
].join('\n');

const docFrom = (src) => {
    const doc = new DspfDocument();
    doc.adopt(parseDspf(src));
    return doc;
};

describe('RecordChrome', () => {
    it('should render the WINDOW frame at window coordinates', () => {
        const doc = docFrom(WIN_SRC);
        const rec = doc.records[0];
        const view = render(<RecordChrome record={rec} cellW={10} />);
        const el = view.container.firstChild;

        expect(el).not.toBeNull();
        expect(el.style.left).toBe('50px');     // (6-1) × 10
        expect(el.style.top).toBe('20px');      // (2-1) × 20
        expect(el.style.width).toBe('650px');   // 65 × 10
        expect(el.style.height).toBe('180px');  // 9 × 20
        expect(el.style.borderStyle).toBe('dashed');
    });

    it('should return null for non-WINDOW records', () => {
        const rec = { type: 'RECORD', items: [], keywords: [] };
        const view = render(<RecordChrome record={rec} cellW={10} />);
        expect(view.container.firstChild).toBeNull();
    });
});

describe('DspfGrid window integration', () => {
    it('should offset window items and draw the active record chrome', () => {
        const doc = docFrom(WIN_SRC);
        const view = render(<DspfGrid doc={doc} />);
        const grid = view.container.querySelector('.dspf-grid');

        expect(grid.querySelector('div')).not.toBeNull();   // chrome 存在
        const item = grid.querySelector('.dspf-item');
        // F1 窗內 (3,5) + offset (top-1=1, left-1=5) → (4, 10)
        expect(item.style.gridRow).toBe('4 / span 1');
        expect(item.style.gridColumn).toBe('10 / span 10');
    });

    it('should render overlay records at 0.30 opacity', () => {
        const doc = docFrom(WIN_SRC);
        doc.setShowOverlay(true);
        const view = render(<DspfGrid doc={doc} />);
        const overlay = view.container.querySelector('.dspf-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.style.opacity).toBe('0.3');
        expect(overlay.style.pointerEvents).toBe('none');
    });
});
