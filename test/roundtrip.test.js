import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseDspf } from '../src/parser/parseDspf.js';
import { writeDspf } from '../src/writer/writeDspf.js';
import { DspfDocument } from '../src/model/DspfDocument.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixturePaths () {
    return ['QDDSSRC', 'TESTS', 'SAMPLES'].flatMap(dir =>
        fs.readdirSync(path.join(root, dir))
            .filter(name => name.toLowerCase().endsWith('.dspf'))
            .sort()
            .map(name => path.join(root, dir, name)));
}

test('all DSPF fixtures reach a stable canonical round-trip', async t => {
    for (const fixture of fixturePaths()) {
        await t.test(path.relative(root, fixture), () => {
            const original = fs.readFileSync(fixture, 'utf8');
            const firstWrite = writeDspf(parseDspf(original));
            const secondWrite = writeDspf(parseDspf(firstWrite));

            assert.equal(secondWrite, firstWrite);
            for (const [index, line] of firstWrite.split('\n').entries()) {
                assert.ok(line.length <= 80,
                    `line ${index + 1} has ${line.length} columns`);
            }
        });
    }
});

test('plus continuations preserve whitespace between keyword arguments', () => {
    const doc = new DspfDocument();
    doc.activeRecord.name = 'REC';
    doc.activeRecord.type = 'WINDOW';
    doc.activeRecord.keywords = [
        { name: 'WINDOW', args: ['16', '03', '4', '70', '*NOMSGLIN'], indicators: [] },
        { name: 'WDWTITLE', args: ['(*TEXT &TITLE;)', '(*COLOR YLW)', '*LEFT', '*BOTTOM'], indicators: [] },
    ];

    const firstWrite = writeDspf(doc);
    const reparsed = parseDspf(firstWrite);
    const windowKw = reparsed.records[0].keywords.find(kw => kw.name === 'WINDOW');
    const titleKw = reparsed.records[0].keywords.find(kw => kw.name === 'WDWTITLE');

    assert.deepEqual(windowKw.args, ['16', '03', '4', '70', '*NOMSGLIN']);
    assert.deepEqual(titleKw.args,
        ['(*TEXT &TITLE;)', '(*COLOR YLW)', '*LEFT', '*BOTTOM']);
});

test('file-level keywords remain before the first record format', () => {
    const source = [
        '     A                                      DSPSIZ(27 132 *DS4)',
        '     A                                      INDARA',
        '     A          R MAIN',
        '     A                                      CA03(03)',
    ].join('\n');

    const written = writeDspf(parseDspf(source));
    const dspsizAt = written.indexOf('DSPSIZ');
    const indaraAt = written.indexOf('INDARA');
    const recordAt = written.indexOf('R MAIN');

    assert.ok(dspsizAt >= 0 && dspsizAt < recordAt);
    assert.ok(indaraAt >= 0 && indaraAt < recordAt);
    assert.ok(written.indexOf('CA03') > recordAt);
});

test('parser accepts a file-level keyword with its fixed prefix stripped', () => {
    const parsed = parseDspf([
        'DSPSIZ(*DS4)',
        '                R SCREEN',
    ].join('\n'));
    const keyword = parsed.records[0].keywords.find(kw => kw.name === 'DSPSIZ');

    assert.deepEqual(keyword.args, ['*DS4']);
    assert.equal(keyword.scope, 'file');
    assert.equal(parsed.modelKey, '27x132');
});

test('writer recovers misplaced file-scope keywords without dropping them', () => {
    const doc = new DspfDocument();
    doc.addRecord('SECOND');
    doc.records[1].keywords.push({
        name: 'INDARA', args: [], indicators: [], scope: 'file',
    });
    const written = writeDspf(doc);

    assert.ok(written.indexOf('INDARA') < written.indexOf('R MAIN'));
    assert.equal((written.match(/INDARA/g) ?? []).length, 1);
});

test('writer emits decimal positions only for decimal-capable fields', () => {
    const doc = new DspfDocument();
    doc.activeRecord.items = [
        { id: 'alpha', kind: 'field', name: 'ALPHA', length: 10,
            dataType: 'A', decimals: 0, usage: 'B', row: 1, col: 1,
            indicators: [], keywords: [] },
        { id: 'numeric', kind: 'field', name: 'NUMBER', length: 7,
            dataType: 'S', decimals: 2, usage: 'B', row: 2, col: 1,
            indicators: [], keywords: [] },
    ];
    const reparsed = parseDspf(writeDspf(doc));

    assert.equal(reparsed.activeRecord.items[0].decimals, 0);
    assert.equal(reparsed.activeRecord.items[1].decimals, 2);
    const alphaLine = writeDspf(doc).split('\n').find(line => line.includes('ALPHA'));
    assert.equal(alphaLine.substring(35, 37), '  ');
});

test('blank field usage remains output-only and REFFLD inheritance stays implicit', () => {
    const source = [
        '     A          R SCREEN',
        '     A            OUTPUT        10      2  2',
        '     A            CUSTOMER  R        O  3  2REFFLD(NAME CUSTPF)',
        '     A            MENUSEL        2Y 0P',
    ].join('\n');
    const parsed = parseDspf(source);
    const [output, referenced, programField] = parsed.activeRecord.items;

    assert.equal(output.usage, 'O');
    assert.equal(referenced._lengthInferred, true);
    assert.equal(programField.usage, 'P');

    const written = writeDspf(parsed);
    const outputLine = written.split('\n').find(line => line.includes('OUTPUT'));
    const referencedLine = written.split('\n').find(line => line.includes('CUSTOMER'));
    const programLine = written.split('\n').find(line => line.includes('MENUSEL'));
    assert.equal(outputLine[37], 'O');
    assert.equal(referencedLine.substring(29, 37), '        ');
    assert.equal(programLine.padEnd(44).substring(38, 44), '      ');
});

test('help specifications preserve their column-17 H semantics', () => {
    const source = [
        '     A          R SCREEN',
        '     A                                      HLPCLR',
        '     A          H                           HLPARA(3 2 23 10)',
        '     A                                      HLPPNLGRP(ASEQ X@BRWD)',
        '     A          H                           HLPARA(2 9 2 79)',
        '     A                                      HLPPNLGRP(SCAN X@BRWD)',
    ].join('\n');

    const parsed = parseDspf(source);
    assert.equal(parsed.activeRecord.helpSpecs.length, 2);
    assert.deepEqual(parsed.activeRecord.helpSpecs[0].keywords.map(k => k.name),
        ['HLPARA', 'HLPPNLGRP']);

    const written = writeDspf(parsed);
    const helpLines = written.split('\n').filter(line => line[16] === 'H');
    assert.equal(helpLines.length, 2);
    assert.equal(writeDspf(parseDspf(written)), written);
});

test('writer rejects indicator overflow instead of discarding conditions', () => {
    const doc = new DspfDocument();
    doc.activeRecord.keywords = [{
        name: 'OVERLAY', args: [], indicators: ['01', '02', '03', '04'],
    }];
    assert.throws(() => writeDspf(doc), /at most three indicator/i);
});

test('writer rejects database-only field types in display source', () => {
    const doc = new DspfDocument();
    doc.activeRecord.items = [{
        id: 'packed', kind: 'field', name: 'PACKED', length: 7,
        dataType: 'P', decimals: 2, usage: 'B', row: 1, col: 1,
        indicators: [], keywords: [],
    }];
    assert.throws(() => writeDspf(doc), /invalid display-file data type/i);
});

test('writer rejects values that would shift fixed DDS columns', () => {
    const doc = new DspfDocument();
    doc.activeRecord.items = [{
        id: 'wide', kind: 'field', name: 'TOOWIDE', length: 100000,
        dataType: 'A', decimals: 0, usage: 'O', row: 1, col: 1,
        indicators: [], keywords: [],
    }];
    assert.throws(() => writeDspf(doc), /invalid DDS field length/i);
});

test('compound AND/OR conditions retain every DDS condition line', () => {
    const source = [
        '     A          R SCREEN',
        '     A  32',
        '     AON32N98N99',
        '     AAN78                                  DSPATR(PC)',
    ].join('\n');
    const parsed = parseDspf(source);
    const keyword = parsed.activeRecord.keywords.find(kw => kw.name === 'DSPATR');

    assert.deepEqual(keyword.conditionLines, [
        { conditionOp: '', indicators: ['32'] },
        { conditionOp: 'O', indicators: ['N32', 'N98', 'N99'] },
    ]);
    assert.equal(keyword.conditionOp, 'A');
    assert.deepEqual(keyword.indicators, ['N78']);

    const written = writeDspf(parsed);
    assert.match(written, /A  32\n     AON32N98N99\n     AAN78\s+DSPATR\(PC\)/);
    assert.equal(writeDspf(parseDspf(written)), written);
});

test('display-size condition names survive the fixed condition area', () => {
    const source = [
        '     A                                      DSPSIZ(*DS3 *DS4)',
        '     A          R SCREEN',
        '     A *DS4                            25 90\'Wide display\'',
    ].join('\n');
    const parsed = parseDspf(source);
    assert.deepEqual(parsed.activeRecord.items[0].indicators, ['*DS4']);
    assert.match(writeDspf(parsed), /A \*DS4\s+25 90'Wide display'/);
});

test('secondary display-size locations survive round-trip', () => {
    const source = [
        '     A                                      DSPSIZ(*DS3 *DS4)',
        '     A          R SCREEN',
        "     A *DS3                            24 70'Status'",
        '     A *DS4                            27120',
    ].join('\n');
    const parsed = parseDspf(source);

    assert.deepEqual(parsed.activeRecord.items[0].alternateLocations, [{
        conditionName: '*DS4', row: 27, col: 120,
    }]);
    const written = writeDspf(parsed);
    assert.match(written, /A \*DS4\s+27120/);
    assert.equal(writeDspf(parseDspf(written)), written);
});

test('positioned keyword fields never become quoted constants', () => {
    const source = [
        '     A          R SCREEN',
        '     A                                  1 62TIME',
        '     A                                      OVRATR',
        '     A                                  1 72OVRATR',
        '     A                                      DATE',
        '     A                                      EDTCDE(Y)',
    ].join('\n');
    const written = writeDspf(parseDspf(source));

    assert.doesNotMatch(written, /'OVRATR'/);
    assert.match(written, /1 72DATE/);
    assert.match(written, /OVRATR/);
    assert.equal(writeDspf(parseDspf(written)), written);
});
