// T-12 模擬層測試：sim store 與互動元件（D-8 契約：不寫 doc）。

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { makeItem } from '@dspf/model/factories.js';
import { itemSignature } from '@dspf/canvas/styleResolver.js';
import { DspfDocument } from '@dspf/model/index.js';

import { DspfItem } from '../DspfItem.jsx';
import { simClear, simGet, simSet, simSubscribe } from '../simulation.js';

const doc80 = { cols: 80, rows: 24, records: [] };
const rec = { type: 'RECORD', items: [], keywords: [] };

function choiceItem (multi = false) {
    return makeItem({
        kind: 'field', row: 1, col: 1, name: 'CHC', length: 10,
        usage: 'B', dataType: 'A', decimals: 0,
        keywords: [
            { name: multi ? 'MLTCHCFLD' : 'SNGCHCFLD', args: [], indicators: [] },
            { name: 'CHOICE', args: ['1', "'One'"], indicators: [] },
            { name: 'CHOICE', args: ['2', "'Two'"], indicators: [] },
        ],
    });
}

function pushbtnItem () {
    return makeItem({
        kind: 'field', row: 1, col: 1, name: 'PB', length: 10,
        usage: 'B', dataType: 'A', decimals: 0,
        keywords: [
            { name: 'PSHBTNFLD', args: [], indicators: [] },
            { name: 'PSHBTNCHC', args: ['1', "'OK'", 'CF03'], indicators: [] },
        ],
    });
}

afterEach(() => simClear());

describe('simulation store', () => {
    it('should set, get and notify', () => {
        const listener = vi.fn();
        simSubscribe(listener);
        simSet('a', { selected: new Set([0]) });
        expect(simGet('a')?.selected?.has(0)).toBe(true);
        expect(listener).toHaveBeenCalledOnce();
        simClear();
        expect(simGet('a')).toBeNull();
    });
});

describe('SimChoiceField', () => {
    it('should toggle a radio choice in the sim layer', () => {
        const item = choiceItem(false);
        const view = render(<DspfItem item={item} record={rec} doc={doc80} />);
        const sig = itemSignature(item);
        fireEvent.click(view.container.querySelector('[data-choice="0"]'));

        expect(simGet(sig)?.selected?.has(0)).toBe(true);
        expect(simGet(sig)?.selected?.has(1)).toBe(false);
    });

    it('should keep radio single-select', () => {
        const item = choiceItem(false);
        const view = render(<DspfItem item={item} record={rec} doc={doc80} />);
        const sig = itemSignature(item);
        fireEvent.click(view.container.querySelector('[data-choice="0"]'));
        fireEvent.click(view.container.querySelector('[data-choice="1"]'));

        expect(simGet(sig)?.selected?.has(0)).toBe(false);
        expect(simGet(sig)?.selected?.has(1)).toBe(true);
    });

    it('should allow multi-select for MLTCHCFLD', () => {
        const item = choiceItem(true);
        const view = render(<DspfItem item={item} record={rec} doc={doc80} />);
        const sig = itemSignature(item);
        fireEvent.click(view.container.querySelector('[data-choice="0"]'));
        fireEvent.click(view.container.querySelector('[data-choice="1"]'));

        expect(simGet(sig)?.selected?.has(0)).toBe(true);
        expect(simGet(sig)?.selected?.has(1)).toBe(true);
    });
});

describe('SimPushbtnField', () => {
    it('should record the AID on click and leave the doc untouched', () => {
        const item = pushbtnItem();
        const kwBefore = JSON.stringify(item.keywords);
        const view = render(<DspfItem item={item} record={rec} doc={doc80} />);
        const sig = itemSignature(item);
        fireEvent.click(view.container.querySelector('.dspf-pb'));

        expect(simGet(sig)?.aid).toBe('CF03');
        expect(JSON.stringify(item.keywords)).toBe(kwBefore);
    });
});

describe('interactions never touch the document', () => {
    it('should not mutate doc on choice toggle', () => {
        const item = choiceItem(false);
        const doc = new DspfDocument();
        doc.records = [{ name: 'T', type: 'RECORD', keywords: [], items: [item] }];
        doc.activeRecordIndex = 0;
        const before = JSON.stringify(item.keywords);

        const view = render(<DspfItem item={item} record={rec} doc={doc80} />);
        fireEvent.click(view.container.querySelector('[data-choice="0"]'));

        expect(JSON.stringify(item.keywords)).toBe(before);
    });
});
