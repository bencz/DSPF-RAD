import assert from 'node:assert/strict';
import test from 'node:test';

import {
    SCREEN_TEMPLATES, createTemplateDocument,
} from '../src/templates/screenTemplates.js';
import { validateDspf } from '../src/validation/validateDspf.js';
import { writeDspf } from '../src/writer/writeDspf.js';
import { parseDspf } from '../src/parser/parseDspf.js';
import { isVisibleInSimulation } from '../src/canvas/simulation.js';
import { generateRpgle } from '../src/codegen/rpgle.js';
import { generateCobol } from '../src/codegen/cobol.js';

test('every screen template is valid and round-trippable in both display sizes', () => {
    for (const modelKey of ['24x80', '27x132']) {
        for (const template of SCREEN_TEMPLATES) {
            const doc = createTemplateDocument(template.id, {
                modelKey, sourceName: 'TMPLTEST', recordName: 'SCREEN',
            });
            assert.deepEqual(validateDspf(doc, { layout: true }), [],
                `${modelKey}/${template.id}`);
            const source = writeDspf(doc);
            assert.equal(writeDspf(parseDspf(source)), source,
                `${modelKey}/${template.id}`);
            assert.match(generateRpgle(doc, {
                programName: 'TMPLR', dspfName: 'TMPLTEST',
            }), /\*\*FREE/);
            doc.records[0].keywords.unshift({
                name: 'INDARA', args: [], indicators: [], scope: 'file',
            });
            assert.match(generateCobol(doc, {
                programName: 'TMPLC', dspfName: 'TMPLTEST',
            }), /IDENTIFICATION DIVISION/);
        }
    }
});

test('indicator simulation handles positive, negative, AND and OR conditions', () => {
    const gc = {
        document: { modelKey: '24x80' },
        simulation: { enabled: true, indicators: new Set(['03']), values: new Map() },
    };
    assert.equal(isVisibleInSimulation(gc, { indicators: ['03'] }), true);
    assert.equal(isVisibleInSimulation(gc, { indicators: ['N03'] }), false);
    assert.equal(isVisibleInSimulation(gc, { indicators: ['03', '04'] }), false);
    assert.equal(isVisibleInSimulation(gc, {
        conditionLines: [{ indicators: ['04'], conditionOp: '' }],
        conditionOp: 'O', indicators: ['03'],
    }), true);
    assert.equal(isVisibleInSimulation(gc, { indicators: ['*DS3'] }), true);
    assert.equal(isVisibleInSimulation(gc, { indicators: ['*DS4'] }), false);
});
