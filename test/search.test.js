import assert from 'node:assert/strict';
import test from 'node:test';

import { DspfDocument } from '../src/model/DspfDocument.js';
import { searchDocument } from '../src/model/search.js';

function searchableDoc () {
    const doc = new DspfDocument();
    doc.activeRecord.name = 'CUSTOMERS';
    doc.addItem({
        kind: 'field', name: 'CUSTNO', row: 3, col: 20,
        keywords: [{ name: 'TEXT', args: ["'Customer number'"], indicators: [] }],
    });
    doc.addItem({ kind: 'constant', text: 'Customer maintenance', row: 1, col: 2 });
    doc.addRecord('ORDERS');
    doc.addItem({ kind: 'field', name: 'ORDERNO', row: 4, col: 20 });
    return doc;
}

test('design search finds records, fields, labels, constants and keywords', () => {
    const doc = searchableDoc();

    assert.equal(searchDocument(doc, 'ORDERS')[0].kind, 'record');
    assert.equal(searchDocument(doc, 'CUSTNO')[0].itemId,
        doc.records[0].items[0].id);
    assert.equal(searchDocument(doc, 'customer number')[0].label, 'CUSTNO');
    assert.equal(searchDocument(doc, 'maintenance')[0].kind, 'constant');
    assert.equal(searchDocument(doc, 'TEXT')[0].label, 'CUSTNO');
});

test('design search requires every query token and honors its result limit', () => {
    const doc = searchableDoc();

    assert.deepEqual(searchDocument(doc, 'customer missing'), []);
    assert.equal(searchDocument(doc, 'customer', { limit: 1 }).length, 1);
    assert.deepEqual(searchDocument(doc, '   '), []);
});
