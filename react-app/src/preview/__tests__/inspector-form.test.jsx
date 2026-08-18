// T-10 InspectorForm 測試（D-2/D-3）：
// - 空選取顯示 Nothing selected。
// - 身分欄位顯示與提交（doc 更新）。
// - clamp resync：length 0 → doc 1 → 表單回寫 1。

import { describe, expect, it } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

import { makeItem } from '@dspf/model/factories.js';
import { DspfDocument } from '@dspf/model/index.js';

import { InspectorForm } from '../InspectorForm.jsx';

const NO_BUS = { current: null, subscribe: () => () => {} };

function docWith (item) {
    const doc = new DspfDocument();
    doc.records = [{ name: 'T', type: 'RECORD', keywords: [], items: [item] }];
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

describe('InspectorForm', () => {
    it('should show nothing selected without a selection', () => {
        const doc = docWith(field());
        const view = render(<InspectorForm doc={doc} bus={NO_BUS} />);
        expect(view.container.textContent).toContain('Nothing selected');
    });

    it('should show identity fields for a selected field', () => {
        const doc = docWith(field({ name: 'CUSTMAST' }));
        const bus = { current: doc.records[0].items[0].id, subscribe: () => () => {} };
        const view = render(<InspectorForm doc={doc} bus={bus} />);

        expect(view.getByLabelText('Name').value).toBe('CUSTMAST');
        expect(view.getByLabelText('Length').value).toBe('10');
        expect(view.getByLabelText('Usage').value).toBe('B');
    });

    it('should commit name changes to the doc on change', () => {
        const item = field({ name: 'OLD' });
        const doc = docWith(item);
        const bus = { current: item.id, subscribe: () => () => {} };
        const view = render(<InspectorForm doc={doc} bus={bus} />);

        act(() => {
            fireEvent.change(view.getByLabelText('Name'), { target: { value: 'new' } });
        });

        expect(item.name).toBe('NEW');          // 大寫化
        expect(doc.findItem(item.id).name).toBe('NEW');
    });

    it('should resync the form when the doc clamps the value', () => {
        const item = field({ length: 10 });
        const doc = docWith(item);
        const bus = { current: item.id, subscribe: () => () => {} };
        const view = render(<InspectorForm doc={doc} bus={bus} />);

        act(() => {
            fireEvent.change(view.getByLabelText('Length'), { target: { value: '0' } });
        });

        expect(item.length).toBe(1);            // updateItem clamp
        expect(view.getByLabelText('Length').value).toBe('1');   // resync
    });
});
