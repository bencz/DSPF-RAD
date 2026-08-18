// T-12 TestPanel 測試：真實渲染的 grid 上跑互動腳本，
// pushbtn/choice 步驟 PASS，doc 未變。

import { afterEach, describe, expect, it } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { makeItem } from '@dspf/model/factories.js';
import { DspfDocument } from '@dspf/model/index.js';

import { DspfGrid } from '../DspfGrid.jsx';
import { TestPanel } from '../TestPanel.jsx';
import { simClear } from '../simulation.js';

function docWithItems () {
    const pushbtn = makeItem({
        kind: 'field', row: 1, col: 1, name: 'PB1', length: 10,
        usage: 'B', dataType: 'A', decimals: 0,
        keywords: [
            { name: 'PSHBTNFLD', args: [], indicators: [] },
            { name: 'PSHBTNCHC', args: ['1', "'OK'", 'CF03'], indicators: [] },
        ],
    });
    const choice = makeItem({
        kind: 'field', row: 2, col: 1, name: 'CH1', length: 10,
        usage: 'B', dataType: 'A', decimals: 0,
        keywords: [
            { name: 'SNGCHCFLD', args: [], indicators: [] },
            { name: 'CHOICE', args: ['1', "'One'"], indicators: [] },
        ],
    });
    const doc = new DspfDocument();
    doc.records = [{ name: 'T', type: 'RECORD', keywords: [], items: [pushbtn, choice] }];
    doc.activeRecordIndex = 0;
    return doc;
}

afterEach(() => simClear());

describe('TestPanel', () => {
    it('should run steps against the rendered grid and pass', () => {
        const doc = docWithItems();
        const gridView = render(<DspfGrid doc={doc} />);
        const panelView = render(
            <TestPanel doc={doc} getGrid={() => gridView.container.querySelector('.dspf-grid')} />);

        fireEvent.click(panelView.container.querySelector('.test-run'));

        const rows = [...panelView.container.querySelectorAll('.test-results li')];        expect(rows).toHaveLength(3);              // pushbtn + choice + doc-unchanged
        for (const row of rows) {
            expect(row.textContent.startsWith('PASS')).toBe(true);
        }
    });

    it('should report FAIL when the grid is missing', () => {
        const doc = docWithItems();
        const view = render(<TestPanel doc={doc} getGrid={() => null} />);
        fireEvent.click(view.container.querySelector('.test-run'));
        expect(view.container.textContent).toContain('FAIL');
    });
});
