import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeProtectedRegions, readRegions } from '../src/codegen/protectedRegions.js';
import { generateRpgle } from '../src/codegen/rpgle.js';
import { DspfDocument } from '../src/model/DspfDocument.js';

test('regeneration preserves handwritten bodies and refreshes generated code', () => {
    const previous = [
        '// old generated line',
        '// [DSPF-RAD-REGION begin=startup]',
        '  customCall();',
        '// [DSPF-RAD-REGION end=startup]',
        '// old tail',
        '',
    ].join('\n');
    const next = [
        '// new generated line',
        '// [DSPF-RAD-REGION begin=startup]',
        '// default body',
        '// [DSPF-RAD-REGION end=startup]',
        '// new tail',
        '',
    ].join('\n');
    const merged = mergeProtectedRegions(previous, next);

    assert.match(merged, /new generated line/);
    assert.match(merged, /customCall\(\);/);
    assert.doesNotMatch(merged, /default body|old generated line|old tail/);
});

test('generator previousSource option applies the protected-region contract', () => {
    const doc = new DspfDocument();
    const first = generateRpgle(doc, { programName: 'TESTPGM', dspfName: 'TESTDSP' });
    const edited = first.replace(
        '// Run-once initialisation (open files, fetch parameters, ...).',
        '  customStartup();');
    const regenerated = generateRpgle(doc, {
        programName: 'TESTPGM', dspfName: 'TESTDSP', previousSource: edited,
    });

    assert.match(regenerated, /customStartup\(\);/);
});

test('malformed or duplicate protected regions are rejected', () => {
    assert.throws(() => readRegions([
        '// [DSPF-RAD-REGION begin=x]',
        '// [DSPF-RAD-REGION end=y]',
    ].join('\n')), /mismatched/i);
    assert.throws(() => readRegions([
        '// [DSPF-RAD-REGION begin=x]',
        '// [DSPF-RAD-REGION end=x]',
        '// [DSPF-RAD-REGION begin=x]',
        '// [DSPF-RAD-REGION end=x]',
    ].join('\n')), /duplicate/i);
});
