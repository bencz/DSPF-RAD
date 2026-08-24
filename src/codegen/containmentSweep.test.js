// Containment auditor tests for Gate C5: clean fixtures pass, and every
// injected rule escape (E1–E3) is caught with the right rule tag.

import { describe, expect, it } from 'vitest';
import { DspfDocument } from '../model/DspfDocument.js';
import { buildCompleteSemanticIR } from './semanticAssembly.js';
import { buildMappingContract } from './mappingContract.js';
import { auditFixture } from './containmentSweep.js';

function pipeline (doc) {
    const ir = buildCompleteSemanticIR(doc);
    return { ir, contract: buildMappingContract(ir) };
}

function fixtureFrom (doc, contractOverride) {
    const { ir, contract } = pipeline(doc);
    return { name: 'TEST', ir, contract: contractOverride ?? contract };
}

describe('auditFixture containment rules', () => {
    it('reports zero escapes for a clean conversion', () => {
        const doc = new DspfDocument();
        doc.records[0].items.push({
            id: 'f1', kind: 'field', name: 'LOCATE', row: 4, col: 15, length: 11,
            usage: 'B', dataType: 'A', decimals: 0, indicators: [], keywords: [],
        });
        const audit = auditFixture(fixtureFrom(doc));
        expect(audit.escapes).toEqual([]);
        expect(audit.objectCount).toBe(1);
        expect(audit.histogram).toEqual({ 'fields:converted': 1 });
    });

    it('catches E1 when a mapping is silently dropped', () => {
        const doc = new DspfDocument();
        doc.records[0].items.push({
            id: 'f1', kind: 'field', name: 'LOCATE', row: 4, col: 15, length: 11,
            usage: 'B', dataType: 'A', decimals: 0, indicators: [], keywords: [],
        });
        const { ir, contract } = pipeline(doc);
        const tampered = { ...contract, mappings: contract.mappings.slice(1), diagnostics: [] };
        const audit = auditFixture({ name: 'TEST', ir, contract: tampered });
        expect(audit.escapes.some(escape => escape.rule === 'E1')).toBe(true);
    });

    it('catches E2 when a status leaves the vocabulary', () => {
        const doc = new DspfDocument();
        doc.records[0].items.push({
            id: 'f1', kind: 'field', name: 'LOCATE', row: 4, col: 15, length: 11,
            usage: 'B', dataType: 'A', decimals: 0, indicators: [], keywords: [],
        });
        const { ir, contract } = pipeline(doc);
        const mappings = contract.mappings.map(mapping => ({ ...mapping, status: 'banana' }));
        const audit = auditFixture(fixtureFrom(doc, { ...contract, mappings }));
        expect(audit.escapes.filter(escape => escape.rule === 'E2').length).toBe(1);
    });

    it('catches E3 when converted has no concrete target', () => {
        const doc = new DspfDocument();
        doc.records[0].items.push({
            id: 'f1', kind: 'field', name: 'LOCATE', row: 4, col: 15, length: 11,
            usage: 'B', dataType: 'A', decimals: 0, indicators: [], keywords: [],
        });
        const { ir, contract } = pipeline(doc);
        const mappings = contract.mappings.map(mapping => ({ ...mapping, target: null }));
        const audit = auditFixture(fixtureFrom(doc, { ...contract, mappings }));
        expect(audit.escapes.some(escape => escape.rule === 'E3')).toBe(true);
    });

    it('summarizes reference resolution counts deterministically', () => {
        const doc = new DspfDocument();
        doc.records[0].keywords.push({ name: 'SFLCTL', args: ['NOPE'], indicators: [] });
        const audit1 = auditFixture(fixtureFrom(doc));
        const audit2 = auditFixture(fixtureFrom(doc));
        expect(JSON.stringify(audit1)).toBe(JSON.stringify(audit2));
        expect(audit1.references['manual-review']).toBeGreaterThanOrEqual(1);
    });
});
