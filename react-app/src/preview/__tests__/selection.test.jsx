// T-06 選取同步測試：
// - bus 在 designer.selectItem 時通知。
// - DspfGrid 點擊呼叫 onSelect 並反白。
// - adopt 後按內容簽名 remap 選取（D-10）。

import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { DspfDocument } from '@dspf/model/index.js';
import { parseDspf } from '@dspf/parser/parseDspf.js';
import { Designer } from '@dspf/designer/Designer.js';
import { itemSignature } from '@dspf/canvas/styleResolver.js';

import { DspfGrid } from '../DspfGrid.jsx';
import { createSelectionBus } from '../useSelection.js';

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

const SRC = [
    line({ nameType: 'R', name: 'TEST' }),
    line({ name: 'NAME', length: 10, dataType: 'A', usage: 'O', row: 2, col: 3 }),
    line({ row: 3, col: 5, kw: "'HI'" }),
].join('\n');

function makeDesigner (doc) {
    const canvas = document.createElement('canvas');
    return new Designer({
        canvas,
        document: doc,
        inspector: { setSelection: vi.fn() },
        palette: { clearArmed: vi.fn() },
        onChange: vi.fn(),
    });
}

describe('selection bus', () => {
    it('should notify subscribers on designer.selectItem', () => {
        const doc = new DspfDocument();
        doc.adopt(parseDspf(SRC));
        const designer = makeDesigner(doc);
        const bus = createSelectionBus(designer, doc);
        const listener = vi.fn();
        bus.subscribe(listener);

        const id = doc.records[0].items[0].id;
        designer.selectItem(id);

        expect(listener).toHaveBeenCalledOnce();
        expect(bus.current).toBe(id);
    });

    it('should remap selection after adopt with same content', () => {
        const doc = new DspfDocument();
        doc.adopt(parseDspf(SRC));
        const designer = makeDesigner(doc);
        const bus = createSelectionBus(designer, doc);

        const sig = itemSignature(doc.records[0].items[0]);
        designer.selectItem(doc.records[0].items[0].id);

        doc.adopt(parseDspf(SRC));       // 同內容 → 新 id

        expect(designer.selectedId).not.toBeNull();
        const remapped = doc.findItem(designer.selectedId);
        expect(itemSignature(remapped)).toBe(sig);
        expect(bus.current).toBe(designer.selectedId);
    });

    it('should clear selection after adopt with different content', () => {
        const doc = new DspfDocument();
        doc.adopt(parseDspf(SRC));
        const designer = makeDesigner(doc);
        const bus = createSelectionBus(designer, doc);

        designer.selectItem(doc.records[0].items[0].id);
        const other = SRC.replace('NAME', 'OTHER');
        doc.adopt(parseDspf(other));

        expect(designer.selectedId).toBeNull();
        expect(bus.current).toBeNull();
    });
});

describe('DspfGrid selection', () => {
    it('should call onSelect with the clicked item id', () => {
        const doc = new DspfDocument();
        doc.adopt(parseDspf(SRC));
        const stubBus = { current: null, subscribe: () => () => {} };
        const onSelect = vi.fn();

        const view = render(<DspfGrid doc={doc} bus={stubBus} onSelect={onSelect} />);
        // 點 NAME 欄位（row 2, col 3）：cellW 預設 10、cellH = 20。
        fireEvent.click(view.container.querySelector('.dspf-grid'), {
            clientX: 25, clientY: 30,
        });

        expect(onSelect).toHaveBeenCalledWith(doc.records[0].items[0].id);
    });

    it('should clear selection when clicking empty grid', () => {
        const doc = new DspfDocument();
        doc.adopt(parseDspf(SRC));
        const stubBus = { current: null, subscribe: () => () => {} };
        const onSelect = vi.fn();

        const view = render(<DspfGrid doc={doc} bus={stubBus} onSelect={onSelect} />);
        fireEvent.click(view.container.querySelector('.dspf-grid'), {
            clientX: 5, clientY: 5,     // (1,1) 無項目
        });

        expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('should highlight the selected item', () => {
        const doc = new DspfDocument();
        doc.adopt(parseDspf(SRC));
        const targetId = doc.records[0].items[0].id;
        const stubBus = { current: targetId, subscribe: () => () => {} };

        const view = render(<DspfGrid doc={doc} bus={stubBus} />);
        const items = view.container.querySelectorAll('.dspf-item');
        expect(items).toHaveLength(2);
        expect(items[0].className).toContain('dspf-selected');
        expect(items[1].className).not.toContain('dspf-selected');
    });
});
