import assert from 'node:assert/strict';
import test from 'node:test';

import { DspfDocument } from '../src/model/DspfDocument.js';
import { uniqueRecordName } from '../src/model/factories.js';
import { parseIndicatorTokens } from '../src/model/keywords.js';
import { parseDspf } from '../src/parser/parseDspf.js';
import { writeDspf } from '../src/writer/writeDspf.js';

test('record-name deduplication terminates at the ten-character limit', () => {
    const records = [
        { name: 'ABCDEFGHIJ' },
        { name: 'ABCDEFGHI2' },
        { name: 'ABCDEFGHI3' },
    ];
    assert.equal(uniqueRecordName(records, 'ABCDEFGHIJ'), 'ABCDEFGHI4');
});

test('record names preserve IBM i national-name characters', () => {
    assert.equal(uniqueRecordName([], '@@CT01'), '@@CT01');
    assert.equal(uniqueRecordName([{ name: '@@CT01' }], '@@CT01'), '@@CT012');
});

test('record duplication deep-clones items without copying file-level keywords', () => {
    const doc = new DspfDocument();
    doc.activeRecord.keywords.push({
        name: 'INDARA', args: [], indicators: [], scope: 'file',
    });
    const original = doc.addItem({
        kind: 'field', name: 'CUSTOMER', row: 4, col: 10,
        keywords: [{ name: 'TEXT', args: ["'Customer'"], indicators: [] }],
    });

    const [duplicate] = doc.duplicateRecord(0);

    assert.equal(duplicate.name, 'MAIN2');
    assert.notEqual(duplicate.items[0].id, original.id);
    assert.deepEqual(duplicate.items[0].keywords, original.keywords);
    assert.notEqual(duplicate.items[0].keywords, original.keywords);
    assert.equal(duplicate.keywords.some(keyword => keyword.scope === 'file'), false);
    duplicate.items[0].keywords[0].args[0] = "'Changed'";
    assert.equal(original.keywords[0].args[0], "'Customer'");
});

test('duplicating either half of a subfile clones and relinks the complete pair', () => {
    const doc = new DspfDocument();
    const { sfl, sflctl } = doc.addSubfile('ORDERS');
    sfl.items.push({
        id: 'row-field', kind: 'field', name: 'ORDERNO', row: 8, col: 2,
        length: 8, decimals: 0, dataType: 'S', usage: 'O',
        indicators: [], conditionLines: [], alternateLocations: [], keywords: [],
    });

    const created = doc.duplicateRecord(doc.records.indexOf(sflctl));
    const [newSfl, newCtl] = created;

    assert.equal(created.length, 2);
    assert.equal(newSfl.type, 'SFL');
    assert.equal(newCtl.type, 'SFLCTL');
    assert.notEqual(newSfl.name, sfl.name);
    assert.equal(newCtl.keywords.find(keyword => keyword.name === 'SFLCTL').args[0],
        newSfl.name);
    assert.notEqual(newSfl.items[0].id, sfl.items[0].id);
    assert.equal(doc.activeRecord, newCtl);
});

test('record reordering keeps file keywords on the first format and is undoable', () => {
    const doc = new DspfDocument();
    doc.activeRecord.keywords.push({
        name: 'INDARA', args: [], indicators: [], scope: 'file',
    });
    doc.addRecord('SECOND');
    doc.resetHistory();

    assert.equal(doc.moveRecord(1, -1), true);
    assert.deepEqual(doc.records.map(record => record.name), ['SECOND', 'MAIN']);
    assert.equal(doc.records[0].keywords.some(keyword => keyword.name === 'INDARA'), true);
    assert.equal(doc.records[1].keywords.some(keyword => keyword.scope === 'file'), false);
    assert.equal(doc.activeRecord.name, 'SECOND');

    assert.equal(doc.undo(), true);
    assert.deepEqual(doc.records.map(record => record.name), ['MAIN', 'SECOND']);
    assert.equal(doc.records[0].keywords.some(keyword => keyword.name === 'INDARA'), true);
});

test('record reordering treats a linked SFL/SFLCTL pair as one ordered unit', () => {
    const doc = new DspfDocument();
    const { sflctl } = doc.addSubfile('LINES');

    assert.equal(doc.canMoveRecord(doc.activeRecordIndex, 1), false);
    assert.equal(doc.moveRecord(doc.activeRecordIndex, -1), true);
    assert.deepEqual(doc.records.map(record => record.name), ['LINES', 'LINESC', 'MAIN']);
    assert.equal(doc.activeRecord, sflctl);
    assert.equal(doc.records[1].keywords.find(keyword => keyword.name === 'SFLCTL').args[0],
        doc.records[0].name);
});

test('JSON import repairs duplicate IDs and advances future IDs', () => {
    const doc = DspfDocument.fromJSON({
        records: [{
            name: 'REC',
            items: [
                { id: 'it_zz', kind: 'constant', text: 'A' },
                { id: 'it_zz', kind: 'constant', text: 'B' },
            ],
        }],
    });
    const ids = doc.activeRecord.items.map(item => item.id);
    const added = doc.addItem({ kind: 'constant', text: 'C' });

    assert.equal(new Set(ids).size, 2);
    assert.ok(!ids.includes(added.id));
});

test('adopt validates source state and preserves workspace preferences', () => {
    const doc = new DspfDocument();
    doc.setShowOverlay(true);
    doc.setHideConditioned(true);
    doc.adopt({ modelKey: 'invalid', records: [], activeRecordIndex: -9 });

    assert.equal(doc.modelKey, '24x80');
    assert.equal(doc.activeRecordIndex, 0);
    assert.equal(doc.records.length, 1);
    assert.equal(doc.showOverlay, true);
    assert.equal(doc.hideConditioned, true);
});

test('workspace preferences survive JSON round-trip', () => {
    const doc = new DspfDocument();
    doc.sourceName = 'ORDERDSP';
    doc.setShowOverlay(true);
    doc.setHideConditioned(true);
    const restored = DspfDocument.fromJSON(doc.toJSON());

    assert.equal(restored.showOverlay, true);
    assert.equal(restored.hideConditioned, true);
    assert.equal(restored.sourceName, 'ORDERDSP');
});

test('RAD key actions persist, survive source adoption and follow record renames', () => {
    const doc = new DspfDocument();
    doc.addRecord('DETAIL');
    doc.setAidActions([
        { pos: 4, behavior: 'navigate', target: 'DETAIL' },
        { pos: 12, behavior: 'exit' },
        { pos: 0, behavior: 'exit' },
    ]);

    const restored = DspfDocument.fromJSON(doc.toJSON());
    assert.deepEqual(restored.aidActions, [
        { pos: 4, behavior: 'navigate', target: 'DETAIL' },
        { pos: 12, behavior: 'exit' },
    ]);

    restored.adopt(parseDspf('     A          R MAIN'));
    assert.equal(restored.aidActions.length, 2);
    restored.addRecord('DETAIL');
    restored.renameRecord(1, 'EDITREC');
    assert.equal(restored.aidActions[0].target, 'EDITREC');
    restored.deleteRecord(1);
    assert.deepEqual(restored.aidActions, [{ pos: 12, behavior: 'exit' }]);
});

test('indicator input is canonical and rejects invalid slots', () => {
    assert.deepEqual(
        parseIndicatorTokens('3, +4 -5 N06 00 100 NOPE'),
        ['03', '04', 'N05', 'N06'],
    );
});

test('help specifications survive JSON round-trip', () => {
    const doc = new DspfDocument();
    doc.activeRecord.helpSpecs = [{
        keywords: [{ name: 'HLPARA', args: ['1', '1', '5', '20'], indicators: ['N03'] }],
    }];
    const restored = DspfDocument.fromJSON(doc.toJSON());

    assert.deepEqual(restored.activeRecord.helpSpecs, doc.activeRecord.helpSpecs);
});

test('parser infers the display geometry from DSPSIZ', () => {
    const numeric = parseDspf(
        '     A                                      DSPSIZ(27 132 *DS4)\n' +
        '     A          R REC');
    const symbolic = parseDspf(
        '                                            DSPSIZ(*DS4)\n' +
        '                R REC');
    const dual = parseDspf(
        '                                            DSPSIZ(*DS3 *DS4)\n' +
        '                R REC');

    assert.equal(numeric.modelKey, '27x132');
    assert.equal(symbolic.modelKey, '27x132');
    assert.equal(dual.modelKey, '24x80');
});

test('changing display geometry updates the emitted DSPSIZ keyword', () => {
    const doc = new DspfDocument();
    doc.setModel('27x132');
    const dspsiz = doc.records[0].keywords.find(keyword => keyword.name === 'DSPSIZ');

    assert.deepEqual(dspsiz.args, ['27', '132', '*DS4']);
    assert.equal(dspsiz.scope, 'file');
    assert.equal(parseDspf(writeDspf(doc)).modelKey, '27x132');
});

test('changing record type removes the old type-defining keyword', () => {
    const doc = parseDspf([
        '     A          R POPUP                     WINDOW(2 2 10 40)',
        '     A                                      OVERLAY',
    ].join('\n'));
    doc.setRecordType(0, 'RECORD');

    assert.equal(doc.activeRecord.type, 'RECORD');
    assert.ok(!doc.activeRecord.keywords.some(keyword => keyword.name === 'WINDOW'));
});

test('record rename updates subfile and menu references', () => {
    const doc = parseDspf([
        '     A          R ROW                       SFL',
        '     A          R ROWCTL                    SFLCTL(ROW)',
        '     A                                      SFLSIZ(10)',
        '     A                                      SFLPAG(9)',
        '     A          R MENU                      MNUBAR',
        '     A            MENUSEL        2Y 0B  1  1',
        "     A                                      MNUBARCHC(1 PULL1 'File')",
        '     A          R PULL1                     PULLDOWN',
    ].join('\n'));
    doc.renameRecord(0, 'NEWROW');
    doc.renameRecord(3, 'NEWPULL');

    assert.equal(doc.records[1].keywords.find(k => k.name === 'SFLCTL').args[0], 'NEWROW');
    assert.equal(doc.records[2].items[0].keywords.find(k => k.name === 'MNUBARCHC').args[1],
        'NEWPULL');
});

test('deleting the first record retains file-level keywords', () => {
    const doc = parseDspf([
        '     A                                      DSPSIZ(27 132 *DS4)',
        '     A                                      INDARA',
        '     A          R FIRST',
        '     A          R SECOND',
    ].join('\n'));
    doc.deleteRecord(0);

    assert.equal(doc.records[0].name, 'SECOND');
    assert.deepEqual(doc.records[0].keywords
        .filter(keyword => keyword.scope === 'file')
        .map(keyword => keyword.name), ['DSPSIZ', 'INDARA']);
});

test('document history supports undo, redo and clean state', () => {
    const doc = new DspfDocument();
    doc.resetHistory({ markClean: true });
    const item = doc.addItem({ kind: 'constant', row: 2, col: 3, text: 'Hello' });

    assert.equal(doc.isDirty, true);
    assert.equal(doc.canUndo, true);
    assert.equal(doc.undo(), true);
    assert.equal(doc.findItem(item.id), null);
    assert.equal(doc.isDirty, false);
    assert.equal(doc.redo(), true);
    assert.equal(doc.findItem(item.id).text, 'Hello');

    doc.markClean();
    assert.equal(doc.isDirty, false);
});

test('a transaction becomes one history operation', () => {
    const doc = new DspfDocument();
    const first = doc.addItem({ kind: 'constant', row: 1, col: 1, text: 'A' });
    const second = doc.addItem({ kind: 'constant', row: 2, col: 1, text: 'B' });
    doc.resetHistory({ markClean: true });

    doc.transaction('Move items', () => {
        doc.updateItems([
            { id: first.id, patch: { col: 5 } },
            { id: second.id, patch: { col: 5 } },
        ]);
    });
    assert.equal(doc.activeRecord.items[0].col, 5);
    assert.equal(doc.activeRecord.items[1].col, 5);
    assert.equal(doc.undo(), true);
    assert.equal(doc.activeRecord.items[0].col, 1);
    assert.equal(doc.activeRecord.items[1].col, 1);
    assert.equal(doc.canUndo, false);
});

test('workspace preferences and renderer caches do not dirty the DSPF', () => {
    const doc = new DspfDocument();
    const item = doc.addItem({ kind: 'field', name: 'VALUE', length: 10 });
    doc.resetHistory({ markClean: true });

    item._effectiveLength = 7;
    doc.setShowOverlay(true);
    doc.setHideConditioned(true);

    assert.equal(doc.isDirty, false);
    assert.equal(doc.canUndo, false);
});
