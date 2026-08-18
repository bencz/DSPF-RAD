// T-01 共用解析模組測試（對等表基礎）。
// 依 vitest skill：描述式命名、一測試一概念、複用既有 factory
// （makeItem + keywordsFromShortcuts），不重造測試資料。

import { describe, expect, it } from 'vitest';

import { makeItem, makeRecord } from '@dspf/model/factories.js';
import { keywordsFromShortcuts } from '@dspf/model/keywords.js';
import { parseDspf } from '@dspf/parser/parseDspf.js';
import {
    computeLayout, itemSignature, renderItemText, resolveItemStyle,
} from '@dspf/canvas/styleResolver.js';

// Factory with sensible defaults（setup-test-factories）。
function field (overrides = {}) {
    return makeItem({
        kind: 'field', row: 1, col: 1, name: 'FIELD', length: 10,
        usage: 'B', dataType: 'A', decimals: 0,
        keywords: keywordsFromShortcuts(overrides),
        ...overrides,
    });
}

function recordWithDefaults (recOverrides = {}) {
    return makeRecord({
        name: 'TEST',
        keywords: [{ name: 'CHGINPDFT', args: ['UL'], indicators: [] }],
        ...recOverrides,
    });
}

const doc80 = { cols: 80, rows: 24, records: [] };

// Build an 80-col DSPF line with exact column alignment
// (parseSourceLine: seq 1-5, 'A' col 6, indicators 7-15, nameType 17,
//  name 19-28, ref 29, len 30-34, type 35, dec 36-37, usage 38,
//  row 39-41, col 42-44, keyword 45+).
function dspfLine ({ inds = ['', '', ''], nameType = ' ', name = '',
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

describe('resolveItemStyle', () => {
    it('should map DSPATR(HI) to isHi', () => {
        const s = resolveItemStyle(field({ dspatr: ['HI'] }), null, doc80);
        expect(s.isHi).toBe(true);
    });

    it('should map COLOR(GRN) to the terminal green', () => {
        const s = resolveItemStyle(field({ color: 'GRN' }), null, doc80);
        expect(s.colour).toBe('#33ff33');
    });

    it('should map BLINK keyword to isBl', () => {
        const s = resolveItemStyle(
            field({ keywords: [{ name: 'BLINK', args: [], indicators: [] }] }),
            null, doc80);
        expect(s.isBl).toBe(true);
    });

    it('should flag usage H as hidden', () => {
        const s = resolveItemStyle(field({ usage: 'H' }), null, doc80);
        expect(s.isHidden).toBe(true);
    });

    it('should fold record entry defaults into entry fields', () => {
        const rec = recordWithDefaults();
        const s = resolveItemStyle(field({ usage: 'I' }), rec, doc80);
        expect(s.isUl).toBe(true);
    });

    it('should ignore record entry defaults for output fields', () => {
        const rec = recordWithDefaults();
        const s = resolveItemStyle(field({ usage: 'O' }), rec, doc80);
        expect(s.isUl).toBe(false);
    });

    it('should prefer own DSPATR over record defaults', () => {
        const rec = recordWithDefaults();
        const s = resolveItemStyle(field({ usage: 'I', dspatr: ['RI'] }), rec, doc80);
        expect(s.isRi).toBe(true);
        expect(s.isUl).toBe(false);
    });
});

describe('renderItemText', () => {
    it('should pad field name with underscores', () => {
        expect(renderItemText(field({ name: 'USER' }))).toBe('USER______');
    });

    it('should render underscores for nameless fields', () => {
        expect(renderItemText(field({ name: '' }))).toBe('__________');
    });

    it('should render DATFMT placeholder for L fields', () => {
        const it = field({ dataType: 'L' });
        it.keywords.push({ name: 'DATFMT', args: ['*MDY'], indicators: [] });
        expect(renderItemText(it)).toBe('MM/DD/YY');
    });
});

describe('computeLayout', () => {
    it('should return natural width and span for a plain field', () => {
        const layout = computeLayout(field({ row: 2, col: 5, length: 10 }), null, doc80);
        expect(layout.width).toBe(10);
        expect(layout.spanCol).toBe(10);
        expect(layout.spanRow).toBe(1);
    });

    it('should clamp span to the grid edge for out-of-bounds fields', () => {
        const layout = computeLayout(field({ row: 1, col: 2, length: 85 }), null, doc80);
        expect(layout.width).toBe(85);
        expect(layout.spanCol).toBe(79); // 80 - 2 + 1
    });

    it('should span multiple rows for CNTFLD fields', () => {
        const it = field({
            row: 1, col: 2, length: 150,
            keywords: [{ name: 'CNTFLD', args: ['030'], indicators: [] }],
        });
        const layout = computeLayout(it, null, doc80);
        expect(layout.height).toBe(5);      // ceil(150 / 30)
        expect(layout.spanRow).toBe(5);
    });

    it('should clamp REFFLD width to the next same-row sibling', () => {
        // REFFLD 無長度 → parser 給 10 加 _lengthInferred。NAME 在 col 3，
        // 兄弟 OTHER 在 col 15 → effectiveLength = min(10, 15 - 3) = 10。
        const src = [
            dspfLine({ nameType: 'R', name: 'TEST' }),
            dspfLine({ name: 'NAME', refFlag: 'R', dataType: 'A', usage: 'O', row: 2, col: 3 }),
            dspfLine({ name: 'OTHER', length: 10, dataType: 'A', usage: 'O', row: 2, col: 15 }),
        ].join('\n');
        const doc = parseDspf(src);
        const rec = doc.records[0];
        const name = rec.items.find((i) => i.name === 'NAME');

        expect(name._lengthInferred).toBe(true);
        const layout = computeLayout(name, rec, doc);
        expect(layout.effectiveLength).toBe(10);
        expect(layout.spanCol).toBe(10);
    });
});

describe('itemSignature', () => {
    it('should be stable across two parses of the same source', () => {
        const src = [
            dspfLine({ nameType: 'R', name: 'TEST' }),
            dspfLine({ name: 'NAME', length: 10, dataType: 'A', usage: 'O', row: 2, col: 3 }),
            dspfLine({ row: 3, col: 5, kw: "'HI'" }),
        ].join('\n');
        const a = parseDspf(src).records[0].items;
        const b = parseDspf(src).records[0].items;
        expect(a.map(itemSignature)).toEqual(b.map(itemSignature));
    });

    it('should distinguish indicator-conditioned siblings at the same cell', () => {
        const src = [
            dspfLine({ nameType: 'R', name: 'TEST' }),
            dspfLine({ inds: ['30'], row: 10, col: 5, kw: "'IN30 = *on'" }),
            dspfLine({ inds: ['N30'], row: 10, col: 5, kw: "'IN30 = *off'" }),
        ].join('\n');
        const items = parseDspf(src).records[0].items;
        expect(items).toHaveLength(2);
        expect(itemSignature(items[0])).not.toBe(itemSignature(items[1]));
    });
});
