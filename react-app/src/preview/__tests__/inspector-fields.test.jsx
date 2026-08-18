// T-11 屬性/條件/文字/記錄欄位測試（D-3/D-9）。

import { describe, expect, it } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

import { makeItem } from '@dspf/model/factories.js';
import { DspfDocument } from '@dspf/model/index.js';
import { flagsOf, valueOf } from '@dspf/model/keywords.js';

import { InspectorForm } from '../InspectorForm.jsx';

function docWithItems (items) {
    const doc = new DspfDocument();
    doc.records = [{ name: 'T', type: 'RECORD', keywords: [], items }];
    doc.activeRecordIndex = 0;
    return doc;
}

function field (overrides = {}) {
    return makeItem({
        kind: 'field', row: 1, col: 1, name: 'FIELD', length: 10,
        usage: 'B', dataType: 'A', decimals: 0,
        ...overrides,
    });
}

function formFor (doc) {
    const item = doc.records[0].items[0];
    const bus = { current: item.id, subscribe: () => () => {} };
    return render(<InspectorForm doc={doc} bus={bus} />);
}

describe('COLOR field', () => {
    it('should commit a free-form color (D-9) and resync uppercase', () => {
        const doc = docWithItems([field()]);
        const view = formFor(doc);
        act(() => {
            fireEvent.change(view.getByLabelText('Color'), { target: { value: 'blk' } });
        });
        expect(valueOf(doc.records[0].items[0], 'COLOR')).toBe('BLK');
        expect(view.getByLabelText('Color').value).toBe('BLK');
    });

    it('should remove COLOR when cleared', () => {
        const doc = docWithItems([field()]);
        const view = formFor(doc);
        const input = view.container.querySelector('input[list="dspf-colors"]');
        act(() => {
            fireEvent.change(input, { target: { value: '' } });
        });
        expect(valueOf(doc.records[0].items[0], 'COLOR')).toBeNull();
    });
});

describe('DSPATR flags', () => {
    it('should set and clear a flag via setFlag', () => {
        const item = field();
        const doc = docWithItems([item]);
        const view = formFor(doc);
        const bus = { current: item.id, subscribe: () => () => {} };
        const hi = view.getByLabelText('HI');
        expect(hi.checked).toBe(false);

        act(() => { fireEvent.click(hi); });
        // emit 不會自動重繪（測試環境無 App 訂閱），手動 rerender。
        view.rerender(<InspectorForm doc={doc} bus={bus} />);
        expect(flagsOf(item, 'DSPATR')).toContain('HI');
        expect(view.getByLabelText('HI').checked).toBe(true);

        act(() => { fireEvent.click(view.getByLabelText('HI')); });
        view.rerender(<InspectorForm doc={doc} bus={bus} />);
        expect(flagsOf(item, 'DSPATR')).not.toContain('HI');
    });
});

describe('indicators', () => {
    it('should parse and commit indicator tokens', () => {
        const item = field();
        const doc = docWithItems([item]);
        const view = formFor(doc);
        act(() => {
            fireEvent.change(view.getByLabelText('Indicators'), { target: { value: '33 N34' } });
        });
        expect(item.indicators).toEqual(['33', 'N34']);
    });
});

describe('DATFMT', () => {
    it('should commit DATFMT for L fields', () => {
        const item = field({ dataType: 'L' });
        const doc = docWithItems([item]);
        const view = formFor(doc);
        act(() => {
            fireEvent.change(view.getByLabelText('DATFMT'), { target: { value: '*MDY' } });
        });
        expect(valueOf(item, 'DATFMT')).toBe('*MDY');
    });
});

describe('record form', () => {
    it('should rename the active record without changing the index', () => {
        const doc = docWithItems([field()]);
        const view = render(<InspectorForm doc={doc} bus={{ current: null, subscribe: () => () => {} }} />);
        const before = doc.activeRecordIndex;
        act(() => {
            fireEvent.change(view.getByLabelText('Record name'), { target: { value: 'newrec' } });
        });
        expect(doc.activeRecord.name).toBe('NEWREC');
        expect(doc.activeRecordIndex).toBe(before);   // index 不跳
    });

    it('should dedupe renamed records and resync the form', () => {
        const a = field({ name: 'A' });
        const b = field({ name: 'B' });
        const doc = new DspfDocument();
        doc.records = [
            { name: 'REC1', type: 'RECORD', keywords: [], items: [a] },
            { name: 'REC2', type: 'RECORD', keywords: [], items: [b] },
        ];
        doc.activeRecordIndex = 0;
        const view = render(<InspectorForm doc={doc} bus={{ current: null, subscribe: () => () => {} }} />);

        act(() => {
            fireEvent.change(view.getByLabelText('Record name'), { target: { value: 'rec2' } });
        });
        expect(doc.records[0].name).toBe('REC22');     // uniqueRecordName 去重（+2 起）
        expect(view.getByLabelText('Record name').value).toBe('REC22');   // resync
    });

    it('should change the record type', () => {
        const doc = docWithItems([field()]);
        const view = render(<InspectorForm doc={doc} bus={{ current: null, subscribe: () => () => {} }} />);
        act(() => {
            fireEvent.change(view.getByLabelText('Record type'), { target: { value: 'WINDOW' } });
        });
        expect(doc.activeRecord.type).toBe('WINDOW');
    });
});
