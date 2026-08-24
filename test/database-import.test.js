import assert from 'node:assert/strict';
import test from 'node:test';

import {
    parseDatabaseDds, layoutDatabaseFields,
} from '../src/import/databaseDds.js';

function ddsLine ({ record = false, nameType = '', name = '', length = '', type = '', decimals = '', keywords = '' }) {
    const line = Array(80).fill(' ');
    line[5] = 'A';
    if (record) line[16] = 'R';
    else if (nameType) line[16] = nameType;
    write(line, 18, String(name).padEnd(10));
    write(line, 29, String(length).padStart(5));
    write(line, 34, type);
    write(line, 35, String(decimals).padStart(2));
    write(line, 44, keywords);
    return line.join('').trimEnd();
}

function write (line, offset, value) {
    [...value].forEach((character, index) => {
        if (offset + index < line.length) line[offset + index] = character;
    });
}

test('PF/LF DDS parser extracts records, database types and labels', () => {
    const source = [
        ddsLine({ record: true, name: 'CUSREC', keywords: 'TEXT(\'Customers\')' }),
        ddsLine({ name: 'CUSTNO', length: 7, type: 'P', decimals: 0,
            keywords: "TEXT('Customer number')" }),
        ddsLine({ name: 'NAME', length: 30, type: 'A',
            keywords: "COLHDG('Customer' 'Name')" }),
        ddsLine({ nameType: 'K', name: 'CUSTNO' }),
        ddsLine({ record: true, name: 'ADRREC' }),
        ddsLine({ name: 'CITY', length: 25, type: 'A' }),
    ].join('\n');

    const records = parseDatabaseDds(source);

    assert.equal(records.length, 2);
    assert.equal(records[0].name, 'CUSREC');
    assert.deepEqual(records[0].fields.map(field => ({
        name: field.name, type: field.dataType, length: field.length, label: field.label,
    })), [
        { name: 'CUSTNO', type: 'S', length: 7, label: 'Customer number' },
        { name: 'NAME', type: 'A', length: 30, label: 'Customer Name' },
    ]);
    assert.equal(records[1].fields[0].label, 'CITY');
});

test('form layout creates labels and fields with safe unique names', () => {
    const fields = [
        { name: 'CODE', length: 7, decimals: 0, dataType: 'S', label: 'Code' },
        { name: 'DESCRIPTION', length: 40, decimals: 0, dataType: 'A', label: 'Description' },
    ];
    const result = layoutDatabaseFields(fields, {
        layout: 'form', startRow: 4, labelCol: 3, fieldCol: 20,
        rows: 24, cols: 50, existingItems: [{ name: 'CODE' }],
    });

    assert.equal(result.skipped.length, 0);
    assert.equal(result.items.length, 4);
    assert.deepEqual(result.items.map(item => [item.kind, item.row, item.col]), [
        ['constant', 4, 3], ['field', 4, 20],
        ['constant', 6, 3], ['field', 6, 20],
    ]);
    assert.equal(result.items[1].name, 'CODE2');
    assert.equal(result.items[3].name, 'DESCRIPTIO');
    assert.equal(result.items[3].length, 31);
});

test('subfile layout adds an option field and reports columns that do not fit', () => {
    const fields = [
        { name: 'NUMBER', length: 8, decimals: 0, dataType: 'S', label: 'Number' },
        { name: 'VERY_WIDE', length: 30, decimals: 0, dataType: 'A', label: 'Very wide value' },
    ];
    const result = layoutDatabaseFields(fields, {
        layout: 'subfile', startRow: 7, labelCol: 2, usage: 'O',
        rows: 24, cols: 25, addOption: true,
    });

    assert.deepEqual(result.items.slice(0, 2).map(item => [item.kind, item.row, item.col]), [
        ['constant', 7, 2], ['field', 8, 2],
    ]);
    assert.equal(result.items[1].name, 'OPT');
    assert.equal(result.items[3].name, 'NUMBER');
    assert.equal(result.items[3].usage, 'O');
    assert.deepEqual(result.skipped.map(field => field.name), ['VERY_WIDE']);
});
