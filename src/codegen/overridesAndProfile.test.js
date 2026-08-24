// L4-0C semantic profile evidence + L4-0A generator override wiring tests.
// The manifest must self-declare the semantic rules in effect, and overrides
// must flow through buildMappingContract into the generated output.

import { describe, expect, it } from 'vitest';
import { DspfDocument } from '../model/DspfDocument.js';
import { buildCompleteSemanticIR } from './semanticAssembly.js';
import { buildMappingContract } from './mappingContract.js';
import { generateReactApp } from './reactApp.js';
import { generateSpringBootApp } from './springBoot.js';
import { describeConversionProfile } from './conversionProfile.js';
import { hashOverrides, itemSourceIdentity } from './designOverrides.js';

function docWithField () {
    const doc = new DspfDocument();
    doc.records[0].items.push({
        id: 'locate-1', kind: 'field', name: 'LOCATE', row: 4, col: 15, length: 11,
        usage: 'B', dataType: 'A', decimals: 0, indicators: [], keywords: [],
    });
    return doc;
}

describe('describeConversionProfile (L4-0C)', () => {
    it('is deterministic and cites contract sources for every rule group', () => {
        expect(JSON.stringify(describeConversionProfile()))
            .toBe(JSON.stringify(describeConversionProfile()));
        const profile = describeConversionProfile();
        for (const group of ['layoutPolicy', 'statusVocabulary', 'componentRules', 'authorityOrder']) {
            expect(profile[group], group).toBeTruthy();
        }
        expect(Object.keys(profile.sources).length).toBeGreaterThanOrEqual(3);
    });

    it('embeds effectiveProfile into both generators manifests', () => {
        const contract = buildMappingContract(buildCompleteSemanticIR(docWithField()));
        for (const files of [generateReactApp(contract), generateSpringBootApp(contract)]) {
            const manifest = JSON.parse(files['conversion-manifest.json']);
            expect(manifest.effectiveProfile.statusVocabulary).toContain('manual-review');
            expect(manifest.effectiveProfile.layoutPolicy.targetColumns).toBe(12);
        }
    });
});

describe('buildMappingContract with overrides (L4-0A)', () => {
    const identity = itemSourceIdentity('MAIN', 'field', 'LOCATE', 1);
    const overrides = [{ sourceIdentity: identity, target: { targetCol: 7, span: 4, component: 'TextField' } }];

    it('applies overrides through the contract entry point with tagged hash evidence', () => {
        const ir = buildCompleteSemanticIR(docWithField());
        const contract = buildMappingContract(ir, { overrides });
        const mapping = contract.mappings.find(entry => entry.sourceIdentity === identity);
        expect(mapping.target.col).toBe(7);
        expect(mapping.target.actualSpan).toBe(4);
        expect(mapping.targetComponent).toBe('TextField');
        expect(contract.overridesHash).toMatch(/^fnv1a:[0-9a-f]{8}$/);
        expect(contract.overridesApplied).toBe(1);
    });

    it('accepts a wrapped overrides payload like the extractor file shape', () => {
        const ir = buildCompleteSemanticIR(docWithField());
        const mapping = buildMappingContract(ir, { overrides: { schemaVersion: 'design-overrides/1', overrides } })
            .mappings.find(entry => entry.sourceIdentity === identity);
        expect(mapping.targetComponent).toBe('TextField');
    });

    it('carries override evidence into both generated manifests', () => {
        const ir = buildCompleteSemanticIR(docWithField());
        for (const files of [generateReactApp(buildMappingContract(ir, { overrides })), generateSpringBootApp(buildMappingContract(ir, { overrides }))]) {
            const manifest = JSON.parse(files['conversion-manifest.json']);
            expect(manifest.overridesHash).toMatch(/^fnv1a:[0-9a-f]{8}$/);
            expect(manifest.overridesApplied).toBe(1);
        }
        const plainManifest = JSON.parse(generateReactApp(buildMappingContract(buildCompleteSemanticIR(docWithField())))['conversion-manifest.json']);
        expect(plainManifest.overridesHash).toBeUndefined();
    });

    it('keeps absent-override output identical to the legacy baseline', () => {
        const ir = buildCompleteSemanticIR(docWithField());
        expect(JSON.stringify(buildMappingContract(ir)))
            .toBe(JSON.stringify(buildMappingContract(ir, {})));
        expect(JSON.stringify(buildMappingContract(ir)))
            .toBe(JSON.stringify(buildMappingContract(ir, { overrides: [] })));
    });

    it('carries the override into the generated React output', () => {
        const ir = buildCompleteSemanticIR(docWithField());
        const files = generateReactApp(buildMappingContract(ir, { overrides }));
        expect(files['src/App.jsx']).toContain('TextField');
        const bindingMap = JSON.parse(files['binding-map.json']);
        expect(bindingMap[identity]).toBeTruthy();
    });
});

describe('hashOverrides', () => {
    it('is stable across calls and sensitive to payload changes', () => {
        const a = [{ sourceIdentity: 'x', target: { span: 2 } }];
        expect(hashOverrides(a)).toBe(hashOverrides([{ sourceIdentity: 'x', target: { span: 2 } }]));
        expect(hashOverrides(a)).not.toBe(hashOverrides([{ sourceIdentity: 'x', target: { span: 3 } }]));
        expect(hashOverrides([])).toBe(hashOverrides(undefined));
    });
});
