import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { generateCobol } from '../src/codegen/cobol.js';
import { generateRpgle } from '../src/codegen/rpgle.js';
import { readRegions } from '../src/codegen/protectedRegions.js';
import { parseDspf } from '../src/parser/parseDspf.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = ['QDDSSRC', 'TESTS', 'SAMPLES'].flatMap(dir =>
    fs.readdirSync(path.join(root, dir))
        .filter(name => name.toLowerCase().endsWith('.dspf'))
        .map(name => path.join(root, dir, name)));

test('RPGLE and COBOL generators stay coherent across the DSPF corpus', async t => {
    for (const fixture of fixtures) {
        await t.test(path.relative(root, fixture), () => {
            const doc = parseDspf(fs.readFileSync(fixture, 'utf8'));
            // COBOL intentionally requires INDARA.  Add it to the in-memory
            // audit document so every fixture exercises the full generator.
            if (!doc.records.some(record => record.keywords.some(
                keyword => keyword.name === 'INDARA'))) {
                doc.records[0].keywords.unshift({
                    name: 'INDARA', args: [], indicators: [], scope: 'file',
                });
            }
            const options = { programName: 'AUDITPGM', dspfName: 'AUDITDSP' };
            const rpg = generateRpgle(doc, options);
            const cobol = generateCobol(doc, options);

            assertGeneratedSource(rpg, 240);
            assertGeneratedSource(cobol, 80);
            readRegions(rpg);
            readRegions(cobol);
        });
    }
});

function assertGeneratedSource (source, maxColumns) {
    assert.doesNotMatch(source, /\b(?:undefined|NaN|null)\b/);
    for (const [index, line] of source.split('\n').entries()) {
        assert.ok(line.length <= maxColumns,
            `generated line ${index + 1} has ${line.length} columns`);
    }
}
