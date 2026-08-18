// T-04 外觀對等測試（對等表 §9.4 的 React 側）。
// 直接掛 DspfItem，斷言內容元件的樣式與角標。

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { makeItem } from '@dspf/model/factories.js';
import { keywordsFromShortcuts } from '@dspf/model/keywords.js';

import { DspfItem } from '../DspfItem.jsx';

const doc80 = { cols: 80, rows: 24, records: [] };
const rec = { type: 'RECORD', items: [], keywords: [] };

function field (overrides = {}) {
    return makeItem({
        kind: 'field', row: 1, col: 1, name: 'FIELD', length: 10,
        usage: 'B', dataType: 'A', decimals: 0,
        keywords: keywordsFromShortcuts(overrides),
        ...overrides,
    });
}

function constant (overrides = {}) {
    return makeItem({
        kind: 'constant', row: 1, col: 1, text: 'SAMPLE',
        keywords: keywordsFromShortcuts(overrides),
        ...overrides,
    });
}

function renderItem (item, record = rec, selected = false) {
    return render(<DspfItem item={item} record={record} doc={doc80} selected={selected} />)
        .container.querySelector('.dspf-item');
}

describe('FieldItem parity', () => {
    it('should render bold for DSPATR(HI)', () => {
        expect(renderItem(field({ dspatr: ['HI'] })).firstChild.style.fontWeight).toBe('bold');
    });

    it('should render COLOR(GRN) as terminal green', () => {
        const el = renderItem(field({ color: 'GRN' }));
        expect(el.firstChild.style.color).toContain('51, 255, 51');
    });

    it('should render ND badge and low opacity for DSPATR(ND)', () => {
        const el = renderItem(field({ dspatr: ['ND'] }));
        expect(el.querySelector('.dspf-nd-badge')).not.toBeNull();
        expect(el.firstChild.style.opacity).toBe('0.25');
    });

    it('should render H:name tag for usage H', () => {
        const el = renderItem(field({ usage: 'H' }));
        expect(el.firstChild.textContent).toBe('H:FIELD');
    });

    it('should render underline for DSPATR(UL)', () => {
        const el = renderItem(field({ dspatr: ['UL'] }));
        expect(el.firstChild.style.borderBottom).toContain('solid');
    });

    it('should render reduced opacity for BLINK', () => {
        const it = field({ keywords: [{ name: 'BLINK', args: [], indicators: [] }] });
        expect(renderItem(it).firstChild.style.opacity).toBe('0.7');
    });
});

describe('ConstantItem parity', () => {
    it('should render reverse image with black text', () => {
        const el = renderItem(constant({ dspatr: ['RI'] }));
        expect(el.firstChild.style.color).toBe('rgb(0, 0, 0)');
        expect(el.firstChild.style.backgroundImage).toContain('linear-gradient');
    });

    it('should render text verbatim', () => {
        expect(renderItem(constant()).firstChild.textContent).toBe('SAMPLE');
    });
});

describe('SysvalueItem parity', () => {
    it('should render padded name and sys marker', () => {
        const it = makeItem({ kind: 'sysvalue', row: 1, col: 1, sysName: 'DATE' });
        const el = renderItem(it);
        expect(el.firstChild.textContent).toContain('DATE');
        expect(el.querySelector('.dspf-sys-marker')).not.toBeNull();
        expect(el.firstChild.style.backgroundImage).toContain('200, 200');
    });
});

describe('record tint and selection', () => {
    it('should tint items in an SFL record', () => {
        const sfl = { type: 'SFL', items: [], keywords: [] };
        const el = renderItem(field(), sfl);
        expect(el.style.backgroundColor).toContain('150, 220');
    });

    it('should overlay selection chrome when selected', () => {
        const el = renderItem(field(), rec, true);
        expect(el.querySelector('.dspf-sel')).not.toBeNull();
        expect(el.className).toContain('dspf-selected');
    });
});
