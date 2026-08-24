import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseDspf } from '../src/parser/parseDspf.js';
import { validateDspf } from '../src/validation/validateDspf.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the complete DSPF corpus has no semantic validation errors', async t => {
    for (const dir of ['QDDSSRC', 'TESTS', 'SAMPLES']) {
        for (const name of fs.readdirSync(path.join(root, dir))
            .filter(file => file.toLowerCase().endsWith('.dspf')).sort()) {
            await t.test(`${dir}/${name}`, () => {
                const doc = parseDspf(fs.readFileSync(path.join(root, dir, name), 'utf8'));
                const errors = validateDspf(doc)
                    .filter(diagnostic => diagnostic.severity === 'error');
                assert.deepEqual(errors, []);
            });
        }
    }
});

test('the full code-generation sample satisfies implemented DDS invariants', () => {
    const doc = parseDspf(fs.readFileSync(
        path.join(root, 'SAMPLES', 'CODEGEN_FULL.DSPF'), 'utf8'));
    const errors = validateDspf(doc, { language: 'cobol' })
        .filter(diagnostic => diagnostic.severity === 'error');
    assert.deepEqual(errors, []);
});

test('multiple linked data subfiles are fully supported without diagnostics', () => {
    for (const name of ['CB906RD.DSPF', 'OE002DF.DSPF']) {
        const doc = parseDspf(fs.readFileSync(
            path.join(root, 'QDDSSRC', name), 'utf8'));
        assert.deepEqual(validateDspf(doc), []);
    }
});

test('validation rejects multiple-choice fields without valid CHCCTL fields', () => {
    const doc = parseDspf(fs.readFileSync(
        path.join(root, 'SAMPLES', 'CODEGEN_FULL.DSPF'), 'utf8'));
    const checks = doc.records.find(record => record.name === 'ORDSFLC')
        .items.find(item => item.name === 'CHECKS');
    checks.keywords = checks.keywords.filter(keyword => keyword.name !== 'CHCCTL');

    const codes = validateDspf(doc).map(diagnostic => diagnostic.code);
    assert.ok(codes.includes('INVALID_MLTCHC_CONTROL'));
});

test('validation reports COBOL generation without INDARA', () => {
    const doc = parseDspf(fs.readFileSync(
        path.join(root, 'SAMPLES', 'CODEGEN_FULL.DSPF'), 'utf8'));
    doc.records[0].keywords = doc.records[0].keywords.filter(
        keyword => keyword.name !== 'INDARA');

    const codes = validateDspf(doc, { language: 'cobol' })
        .map(diagnostic => diagnostic.code);
    assert.ok(codes.includes('COBOL_REQUIRES_INDARA'));
});

test('validation rejects a component-only file with no displayable format', () => {
    const doc = parseDspf([
        '     A          R ONLYSFL                   SFL',
        '     A            VALUE         10A  O  1  1',
    ].join('\n'));
    const codes = validateDspf(doc).map(diagnostic => diagnostic.code);
    assert.ok(codes.includes('NO_MAIN_RECORD'));
});

test('validation distinguishes display types from database packed fields', () => {
    const doc = parseDspf([
        '     A          R SCREEN',
        '     A            VALUE          7S 2B  1  1',
    ].join('\n'));
    doc.activeRecord.items[0].dataType = 'P';

    const codes = validateDspf(doc).map(diagnostic => diagnostic.code);
    assert.ok(codes.includes('INVALID_DATA_TYPE'));
});

test('validation enforces MNUBARDSP return-field attributes', () => {
    const doc = parseDspf(fs.readFileSync(
        path.join(root, 'SAMPLES', 'CODEGEN_FULL.DSPF'), 'utf8'));
    const choice = doc.records.find(record => record.name === 'ORDSFLC')
        .items.find(item => item.name === 'MNUCHC');
    choice.dataType = 'A';

    const codes = validateDspf(doc).map(diagnostic => diagnostic.code);
    assert.ok(codes.includes('INVALID_MNUBARDSP_CHOICE_FIELD'));
});

test('optional layout diagnostics report overflow and overlap', () => {
    const doc = parseDspf([
        '     A          R SCREEN',
        "     A                                  1 75'TOO WIDE'",
        "     A                                  2  2'FIRST'",
        "     A                                  2  4'SECOND'",
    ].join('\n'));
    const codes = validateDspf(doc, { layout: true })
        .map(diagnostic => diagnostic.code);

    assert.ok(codes.includes('ITEM_OVERFLOW'));
    assert.ok(codes.includes('ITEM_OVERLAP'));
    assert.deepEqual(validateDspf(doc), []);
});
