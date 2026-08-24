import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { generateCobol } from '../src/codegen/cobol.js';
import { generateRpgle } from '../src/codegen/rpgle.js';
import {
    conditionGroupsOf, indicatorConditionsOf, pickMainRecord, pickSubfilePairs,
} from '../src/codegen/analysis.js';
import { parseDspf } from '../src/parser/parseDspf.js';
import { DspfDocument } from '../src/model/DspfDocument.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleSource = fs.readFileSync(
    path.join(root, 'SAMPLES', 'CODEGEN_FULL.DSPF'), 'utf8');

function sampleDoc () {
    return parseDspf(sampleSource);
}

function fixtureDoc (name, { indara = true } = {}) {
    const doc = parseDspf(fs.readFileSync(path.join(root, 'QDDSSRC', name), 'utf8'));
    if (indara && !doc.records.some(record => record.keywords.some(
        keyword => keyword.name === 'INDARA' && keyword.scope === 'file'))) {
        doc.records[0].keywords.unshift({
            name: 'INDARA', args: [], indicators: [], scope: 'file',
        });
    }
    return doc;
}

function regionKeys (source, marker) {
    return [...source.matchAll(new RegExp(
        `DSPF-RAD-REGION ${marker}=([^\\]]+)`, 'g'))].map(match => match[1]);
}

function assertRegionContract (source) {
    const begins = regionKeys(source, 'begin');
    const ends = regionKeys(source, 'end');
    assert.deepEqual(ends, begins);
    assert.equal(new Set(begins).size, begins.length);
}

test('RPGLE uses a 99-position INDDS and honors indicator polarity', () => {
    const source = generateRpgle(sampleDoc(), {
        programName: 'CGDEMO', dspfName: 'CGDEMO',
    });

    assert.match(source,
        /Dcl-F CGDEMO Workstn SFile\(ORDSFL:WkSflRrn\) IndDS\(WkInd\) UsrOpn;/);
    assert.match(source, /Dcl-S WkSflRrn Packed\(5:0\) Inz\(0\);/);
    assert.match(source, /Dcl-Ds WkInd Qualified Len\(99\);/);
    assert.match(source, /WkInd\.In30 = \*Off;\s+\/\/ SFLCLR/);
    assert.match(source, /WkInd\.In30 = \*On;\s+\/\/ reset/);
    assert.match(source, /WkInd\.In31 = \*On;\s+\/\/ SFLDSP/);
    assert.match(source, /When WkInd\.In03;[\s\S]*?done = \*On;/);
    assert.match(source, /When CHKC1 = 1;/);
    assert.doesNotMatch(source, /When CHECKS = 1;/);
    assert.match(source, /Write PULL1;/);
    assertRegionContract(source);
});

test('RPGLE falls back to the RPG indicator array without INDARA', () => {
    const doc = sampleDoc();
    doc.records[0].keywords = doc.records[0].keywords.filter(
        keyword => keyword.name !== 'INDARA');
    const source = generateRpgle(doc, {
        programName: 'CGDEMO', dspfName: 'CGDEMO',
    });

    assert.match(source, /Dcl-F CGDEMO Workstn SFile\(ORDSFL:WkSflRrn\) UsrOpn;/);
    assert.doesNotMatch(source, /IndDS|Dcl-Ds WkInd/);
    assert.match(source, /\*In30 = \*Off;\s+\/\/ SFLCLR/);
    assert.match(source, /When \*In03;/);
});

test('COBOL uses the IBM separate-indicator-area forms', () => {
    const source = generateCobol(sampleDoc(), {
        programName: 'CGDEMO', dspfName: 'CGDEMO',
    });

    assert.match(source, /ASSIGN TO WORKSTATION-CGDEMO-SI/);
    assert.match(source, /ACCESS MODE IS DYNAMIC/);
    assert.match(source, /RELATIVE KEY IS WS-SFL-RRN/);
    assert.match(source, /COPY DDS-ALL-FORMATS OF CGDEMO\./);
    assert.match(source, /INDIC-TABLE OCCURS 99 PIC 1 INDICATOR 1\./);
    assert.match(source, /MOVE B"0" TO INDIC-TABLE \(30\)/);
    assert.match(source, /MOVE B"1" TO INDIC-TABLE \(30\)/);
    assert.match(source, /WHEN INDIC-TABLE \(03\) = B"1"[\s\S]*?MOVE "Y" TO DONE-FLG/);
    assert.match(source, /WHEN CHKC1 = 1/);
    assert.doesNotMatch(source, /FILLER\s+PIC X\(99\)|__DSPF/);
    assert.match(source, /WRITE CGDEMO-REC FORMAT IS "PULL1"/);
    assert.match(source, /WRITE SUBFILE CGDEMO-REC FORMAT IS "ORDSFL"/);
    assertRegionContract(source);
});

test('COBOL refuses to pretend positional indicators are safe without INDARA', () => {
    const doc = sampleDoc();
    doc.records[0].keywords = doc.records[0].keywords.filter(
        keyword => keyword.name !== 'INDARA');

    assert.throws(
        () => generateCobol(doc, { programName: 'CGDEMO', dspfName: 'CGDEMO' }),
        /requires the DSPF INDARA keyword/,
    );
});

test('configured AID flow generates persistent record routing in RPGLE and COBOL', () => {
    const doc = new DspfDocument();
    doc.activeRecord.keywords = [
        { name: 'INDARA', args: [], indicators: [], scope: 'file' },
        { name: 'CA03', args: ['03', "'Exit'"], indicators: [] },
        { name: 'CA04', args: ['04', "'Details'"], indicators: [] },
    ];
    doc.addRecord('DETAIL');
    doc.setAidActions([
        { pos: 3, behavior: 'navigate', target: 'DETAIL' },
        { pos: 4, behavior: 'exit' },
    ]);

    const rpg = generateRpgle(doc, { programName: 'FLOWR', dspfName: 'FLOWD' });
    assert.match(rpg, /Dcl-S WkScreen Char\(10\) Inz\('MAIN'\);/);
    assert.match(rpg, /When WkScreen = 'MAIN';[\s\S]*?Exfmt MAIN;/);
    assert.match(rpg, /When WkScreen = 'DETAIL';[\s\S]*?Exfmt DETAIL;/);
    assert.match(rpg, /When WkInd\.In03;[\s\S]*?WkScreen = 'DETAIL';/);
    assert.match(rpg, /When WkInd\.In04;[\s\S]*?done = \*On;/);

    const cobol = generateCobol(doc, { programName: 'FLOWC', dspfName: 'FLOWD' });
    assert.match(cobol, /05  WS-SCREEN\s+PIC X\(10\)\s+VALUE "MAIN"\./);
    assert.match(cobol, /WHEN "DETAIL"[\s\S]*?FORMAT IS "DETAIL"/);
    assert.match(cobol,
        /WHEN INDIC-TABLE \(03\) = B"1"[\s\S]*?MOVE "DETAIL" TO WS-SCREEN/);
    assert.match(cobol,
        /WHEN INDIC-TABLE \(04\) = B"1"[\s\S]*?MOVE "Y" TO DONE-FLG/);
});

test('code generation analysis understands complete AND/OR conditions', () => {
    const keyword = {
        name: 'SFLDSP',
        conditionLines: [
            { conditionOp: '', indicators: ['N25'] },
            { conditionOp: 'A', indicators: ['N80'] },
        ],
        conditionOp: 'A',
        indicators: ['81'],
    };
    const target = { keywords: [keyword] };

    assert.deepEqual(conditionGroupsOf(keyword), [[
        { pos: 25, on: false },
        { pos: 80, on: false },
        { pos: 81, on: true },
    ]]);
    assert.deepEqual(indicatorConditionsOf(target, 'SFLDSP'),
        conditionGroupsOf(keyword)[0]);

    keyword.conditionLines[1].conditionOp = 'O';
    assert.deepEqual(conditionGroupsOf(keyword), [
        [{ pos: 25, on: false }],
        [{ pos: 80, on: false }, { pos: 81, on: true }],
    ]);
});

test('main-record selection prefers a linked subfile control', () => {
    const doc = parseDspf([
        '     A          R SPLASH',
        '     A          R ROW                       SFL',
        '     A          R ROWCTL                    SFLCTL(ROW)',
        '     A                                      SFLSIZ(10)',
        '     A                                      SFLPAG(9)',
    ].join('\n'));
    assert.equal(pickMainRecord(doc).name, 'ROWCTL');

    doc.records = doc.records.filter(record => record.type === 'SFL');
    assert.equal(pickMainRecord(doc), null);
});

test('message subfiles are not selected as data loaders or main screens', () => {
    const doc = parseDspf([
        '     A          R MSGSFL                    SFL',
        '     A                                      SFLMSGRCD(24)',
        '     A          R MSGCTL                    SFLCTL(MSGSFL)',
        '     A                                      SFLSIZ(2)',
        '     A                                      SFLPAG(1)',
        '     A          R SCREEN',
    ].join('\n'));
    const source = generateRpgle(doc, {
        programName: 'TESTPGM', dspfName: 'TESTDSP',
    });

    assert.equal(pickMainRecord(doc).name, 'SCREEN');
    assert.doesNotMatch(source, /SFile\(MSGSFL:/);
    assert.match(source, /Exfmt SCREEN;/);
});

test('RPGLE generates an independent SFILE, RRN, route and regions for every data subfile', () => {
    const doc = fixtureDoc('CB906RD.DSPF');
    assert.equal(pickSubfilePairs(doc).length, 3);

    const source = generateRpgle(doc, {
        programName: 'MULTIPGM', dspfName: 'MULTIDSP',
    });

    assert.match(source, /SFile\(SFL100:WkSflRrn\)/);
    assert.match(source, /SFile\(SFL101:WkSflRrn02\)/);
    assert.match(source, /SFile\(SFL102:WkSflRrn03\)/);
    assert.match(source, /Dcl-S WkScreen Char\(10\) Inz\('SCT100'\);/);
    for (const [sfl, ctl, rrn, suffix] of [
        ['SFL100', 'SCT100', 'WkSflRrn', ''],
        ['SFL101', 'SCT101', 'WkSflRrn02', ''],
        ['SFL102', 'SCT102', 'WkSflRrn03', ''],
    ]) {
        assert.match(source, new RegExp(`When WkScreen = '${ctl}';[\\s\\S]*?Exfmt ${ctl};`));
        assert.match(source, new RegExp(`${rrn} \\+= 1;`));
        assert.match(source, new RegExp(`begin=load-${sfl.toLowerCase()}${suffix}`));
        assert.match(source, new RegExp(`begin=changed-${sfl.toLowerCase()}${suffix}`));
    }
    assertRegionContract(source);
});

test('COBOL routes and loads every data subfile through one transaction-file relative key', () => {
    const source = generateCobol(fixtureDoc('CB906RD.DSPF'), {
        programName: 'MULTIPGM', dspfName: 'MULTIDSP',
    });

    assert.equal((source.match(/RELATIVE KEY IS WS-SFL-RRN/g) ?? []).length, 1);
    assert.match(source, /05  WS-SCREEN\s+PIC X\(10\)\s+VALUE "SCT100"\./);
    for (const [sfl, ctl, paragraph] of [
        ['SFL100', 'SCT100', 'SUBFILE'],
        ['SFL101', 'SCT101', '02'],
        ['SFL102', 'SCT102', '03'],
    ]) {
        const loadName = paragraph === 'SUBFILE' ? 'LOAD-SUBFILE' : `LOAD-SUBFILE-${paragraph}`;
        assert.match(source, new RegExp(`WHEN "${ctl}"[\\s\\S]*?PERFORM ${loadName}`));
        assert.match(source, new RegExp(`${loadName}\\.`));
        assert.match(source, new RegExp(`WRITE SUBFILE MULTIDSP-REC FORMAT IS "${sfl}"`));
        assert.match(source, new RegExp(`begin=changed-${sfl.toLowerCase()}`));
    }
    assertRegionContract(source);
});

test('multiple-subfile generation excludes message subfiles and honors SFLDLT clearing', () => {
    const doc = fixtureDoc('OE002DF.DSPF');
    const pairs = pickSubfilePairs(doc);
    assert.deepEqual(pairs.map(pair => pair.sfl.name), ['OESFL', '@@SF01']);

    const rpg = generateRpgle(doc, {
        programName: 'MULTIPGM', dspfName: 'MULTIDSP',
    });
    const cobol = generateCobol(doc, {
        programName: 'MULTIPGM', dspfName: 'MULTIDSP',
    });

    assert.match(rpg, /SFile\(OESFL:WkSflRrn\)/);
    assert.match(rpg, /SFile\(@@SF01:WkSflRrn02\)/);
    assert.doesNotMatch(rpg, /SFile\(@@MS01:/);
    assert.match(rpg, /WkInd\.In30 = \*On;\s+\/\/ SFLDLT/);
    assert.match(rpg, /WkInd\.In30 = \*Off;\s+\/\/ reset/);
    assert.doesNotMatch(cobol, /LOAD-[^\n]*@@MS01|WRITE SUBFILE [^\n]*@@MS01/);
    assert.match(cobol, /MOVE B"1" TO INDIC-TABLE \(30\)[\s\S]*?FORMAT IS "OESFLC"/);
});

test('adding subfile pairs preserves handwritten code from the former first-pair generator', () => {
    const single = fixtureDoc('CB906RD.DSPF');
    single.records = single.records.filter(record =>
        !['SFL', 'SFLCTL'].includes(record.type) ||
        ['SFL100', 'SCT100'].includes(record.name));
    const full = fixtureDoc('CB906RD.DSPF');
    const options = { programName: 'MULTIPGM', dspfName: 'MULTIDSP' };

    const oldRpg = generateRpgle(single, options).replace(
        '// Fill SFL100 subfile records here.  Suggested skeleton:',
        '    WkSflRrn = 7;');
    const newRpg = generateRpgle(full, { ...options, previousSource: oldRpg });
    assert.match(newRpg, /WkSflRrn = 7;/);
    assert.match(newRpg, /SFile\(SFL102:WkSflRrn03\)/);

    const oldCobol = generateCobol(single, options).replace(
        '*> Clear the SFL100 subfile, load it record-by-record,',
        '*> Preserved custom first-pair loader.');
    const newCobol = generateCobol(full, { ...options, previousSource: oldCobol });
    assert.match(newCobol, /Preserved custom first-pair loader/);
    assert.match(newCobol, /LOAD-SUBFILE-03\./);
});
