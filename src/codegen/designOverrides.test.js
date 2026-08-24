// Design-overlay application tests for the Mapping Contract (D-15).
// Overrides may change target-side values only, must never mutate their
// inputs, and every unmatched override becomes a visible diagnostic.

import { describe, expect, it } from 'vitest';
import { DspfDocument } from '../model/DspfDocument.js';
import { buildCompleteSemanticIR } from './semanticAssembly.js';
import { buildMappingContract } from './mappingContract.js';
import { applyDesignOverrides, itemSourceIdentity } from './designOverrides.js';

function docWithField () {
    const doc = new DspfDocument();
    doc.records[0].items.push({
        id: 'locate-1', kind: 'field', name: 'LOCATE', row: 4, col: 15, length: 11,
        usage: 'B', dataType: 'A', decimals: 0, indicators: [], keywords: [],
    });
    return doc;
}

function contractFor (doc) {
    return buildMappingContract(buildCompleteSemanticIR(doc));
}

describe('applyDesignOverrides', () => {
    it('applies col, span, and component to the matching mapping without mutating inputs', () => {
        const doc = docWithField();
        const base = contractFor(doc);
        const before = JSON.stringify(base);
        const identity = itemSourceIdentity('MAIN', 'field', 'LOCATE', 1);

        const result = applyDesignOverrides(base, [
            { sourceIdentity: identity, target: { targetCol: 7, span: 4, component: 'TextField' } },
        ]);

        expect(result.appliedCount).toBe(1);
        const mapping = result.contract.mappings.find(entry => entry.sourceIdentity === identity);
        expect(mapping.target.col).toBe(7);
        expect(mapping.target.plannedSpan).toBe(4);
        expect(mapping.target.actualSpan).toBe(4);
        expect(mapping.targetComponent).toBe('TextField');
        expect(mapping.traceability.target.component).toBe('TextField');
        expect(mapping.traceability.target.span).toBe(4);
        expect(JSON.stringify(base)).toBe(before);
        expect(result.contract.diagnostics.some(
            diagnostic => diagnostic.code === 'DESIGN_OVERRIDE_APPLIED' && diagnostic.severity === 'info',
        )).toBe(true);
        expect(result.contract.diagnostics.some(diagnostic => diagnostic.code === 'OVERRIDE_NO_MATCHING_SOURCE')).toBe(false);
    });

    it('reports unmatched overrides as warning diagnostics', () => {
        const base = contractFor(docWithField());
        const result = applyDesignOverrides(base, [
            { sourceIdentity: 'dspf:MAIN:field:NOPE:occurrence:99', target: { span: 2 } },
        ]);
        expect(result.appliedCount).toBe(0);
        const warning = result.contract.diagnostics.find(diagnostic => diagnostic.code === 'OVERRIDE_NO_MATCHING_SOURCE');
        expect(warning?.severity).toBe('warning');
        expect(warning?.sourceIdentity).toContain('NOPE');
    });

    it('keeps untouched target fields when the override is partial', () => {
        const doc = docWithField();
        const base = contractFor(doc);
        const identity = itemSourceIdentity('MAIN', 'field', 'LOCATE', 1);
        const originalCol = base.mappings.find(entry => entry.sourceIdentity === identity).target.col;

        const result = applyDesignOverrides(base, [
            { sourceIdentity: identity, target: { span: 6 } },
        ]);
        const mapping = result.contract.mappings.find(entry => entry.sourceIdentity === identity);
        expect(mapping.target.col).toBe(originalCol);
        expect(mapping.target.actualSpan).toBe(6);
        expect(mapping.targetComponent).toBe('ConvertedField');
    });

    it('is deterministic when applied twice to the same contract', () => {
        const base = contractFor(docWithField());
        const overrides = [{ sourceIdentity: itemSourceIdentity('MAIN', 'field', 'LOCATE', 1), target: { targetCol: 3, span: 5 } }];
        const first = applyDesignOverrides(base, overrides);
        const second = applyDesignOverrides(first.contract, []);
        const third = applyDesignOverrides({ ...base }, overrides.map(o => ({ ...o })));
        expect(JSON.stringify(third.contract)).toBe(JSON.stringify(applyDesignOverrides(base, overrides).contract));
        expect(second.contract.diagnostics.length).toBeGreaterThanOrEqual(base.diagnostics.length);
    });
});

describe('itemSourceIdentity', () => {
    it('matches the Semantic IR identity format exactly', () => {
        const ir = buildCompleteSemanticIR(docWithField());
        expect(ir.fields[0].sourceIdentity).toBe(itemSourceIdentity('MAIN', 'field', 'LOCATE', 1));
    });
});
