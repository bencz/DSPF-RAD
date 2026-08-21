// V2.1-0B visual adapter tests.
// The adapter must return a new visual model and leave DspfDocument unchanged.

import { describe, expect, it } from 'vitest';

import { DspfDocument } from '@dspf/model/index.js';
import { buildVisualModel } from '../visualModel.js';

function makeDocument () {
    const doc = new DspfDocument();
    doc.records = [];
    const record = doc.addRecord('SIGNON');
    doc.addItem({ kind: 'constant', text: 'User', row: 1, col: 2 });
    doc.addItem({
        kind: 'field',
        name: 'USER',
        row: 2,
        col: 3,
        length: 40,
        usage: 'B',
        dataType: 'A',
    });
    doc.addItem({
        kind: 'sysvalue',
        sysName: 'DATE',
        row: 3,
        col: 3,
    });
    doc.setActiveRecord(doc.records.indexOf(record));
    return doc;
}

describe('buildVisualModel', () => {
    it('maps supported items without mutating the document', () => {
        const doc = makeDocument();
        const before = structuredClone(doc.toJSON());
        const model = buildVisualModel(doc);

        expect(model.modelKey).toBe('24x80');
        expect(model.records[0].items).toHaveLength(3);
        expect(model.records[0].items[1]).toMatchObject({
            kind: 'field',
            name: 'USER',
            row: 2,
            col: 3,
            targetCol: 1,
            length: 40,
            span: 6,
        });
        expect(doc.toJSON()).toEqual(before);
    });

    it('reports inferred reference fields for manual review', () => {
        const doc = makeDocument();
        doc.records[0].items[1].refField = true;
        doc.records[0].items[1]._lengthInferred = true;

        const model = buildVisualModel(doc);

        expect(model.warnings).toEqual([
            expect.objectContaining({
                severity: 'manual-review',
                sourceId: doc.records[0].items[1].id,
            }),
        ]);
        expect(doc.records[0].items[1].refField).toBe(true);
    });

    it('does not treat hidden H controls as manual-review warnings', () => {
        const doc = makeDocument();
        doc.records[0].items.push({ kind: 'field', name: 'SFIELD', row: 1, col: 1, length: 10, usage: 'H' });
        const model = buildVisualModel(doc);
        expect(model.warnings.some(warning => warning.message.includes('SFIELD'))).toBe(false);
    });
});
