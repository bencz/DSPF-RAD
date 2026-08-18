// T-09 palette 落點測試：
// - specToItem 純函數（jsdom 無 DnD，契約 §9.2）。
// - cellFromPoint / itemAtCell 格子數學（對等 hitTest）。

import { describe, expect, it } from 'vitest';

import { specToItem } from '@dspf/designer/specToItem.js';
import { DspfDocument } from '@dspf/model/index.js';
import { parseDspf } from '@dspf/parser/parseDspf.js';

import { cellFromPoint, itemAtCell } from '../dropMath.js';

describe('specToItem', () => {
    it('should build an input field at the given cell', () => {
        const item = specToItem({ kind: 'input', length: 10 }, { row: 5, col: 6 });
        expect(item.kind).toBe('field');
        expect(item.length).toBe(10);
        expect(item.row).toBe(5);
        expect(item.col).toBe(6);
    });

    it('should build a radio choice field with SNGCHCFLD', () => {
        const item = specToItem({ kind: 'radio' }, { row: 2, col: 3 });
        expect(item.kind).toBe('field');
        expect(item.keywords.some((k) => k.name === 'SNGCHCFLD')).toBe(true);
    });

    it('should build a constant with text', () => {
        const item = specToItem({ kind: 'constant', text: 'Hi' }, { row: 1, col: 1 });
        expect(item.kind).toBe('constant');
        expect(item.text).toBe('Hi');
    });

    it('should build a push button field', () => {
        const item = specToItem({ kind: 'pushbtn' }, { row: 1, col: 1 });
        expect(item.keywords.some((k) => k.name === 'PSHBTNFLD')).toBe(true);
    });
});

describe('cellFromPoint', () => {
    const rect = { left: 10, top: 5 };

    it('should convert pointer coordinates to a cell', () => {
        expect(cellFromPoint(rect, 25, 45, 10, 80, 24)).toEqual({ row: 3, col: 2 });
        expect(cellFromPoint(rect, 10, 5, 10, 80, 24)).toEqual({ row: 1, col: 1 });
    });

    it('should return null outside the grid', () => {
        expect(cellFromPoint(rect, 5, 5, 10, 80, 24)).toBeNull();        // 左界外
        expect(cellFromPoint(rect, 810, 5, 10, 80, 24)).toBeNull();      // 超過 80 欄
        expect(cellFromPoint(rect, 25, 490, 10, 80, 24)).toBeNull();     // 超過 24 列
    });
});

describe('itemAtCell', () => {
    function line ({ inds = ['', '', ''], nameType = ' ', name = '',
                     refFlag = ' ', length = '', dataType = ' ',
                     usage = ' ', row = '', col = '' } = {}) {
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
        ].join('');
    }

    it('should return the topmost item under a cell', () => {
        const src = [
            line({ nameType: 'R', name: 'TEST' }),
            line({ name: 'NAME', length: 10, dataType: 'A', usage: 'O', row: 2, col: 3 }),
            line({ name: 'OTHER', length: 5, dataType: 'A', usage: 'O', row: 2, col: 3 }),
        ].join('\n');
        const doc = new DspfDocument();
        doc.adopt(parseDspf(src));

        const hit = itemAtCell(doc, { row: 2, col: 4 });
        expect(hit).not.toBeNull();
        expect(hit.name).toBe('OTHER');    // 同位置，最上層（後宣告）贏
    });

    it('should skip usage H fields', () => {
        const src = [
            line({ nameType: 'R', name: 'TEST' }),
            line({ name: 'HID', length: 10, dataType: 'A', usage: 'H', row: 2, col: 3 }),
        ].join('\n');
        const doc = new DspfDocument();
        doc.adopt(parseDspf(src));
        expect(itemAtCell(doc, { row: 2, col: 5 })).toBeNull();
    });
});
