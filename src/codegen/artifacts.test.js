// Four-artifact contract tests: every conversion emits manifest, binding map,
// traceability, and report — deterministic and shape-stable.

import { describe, expect, it } from 'vitest';
import { DspfDocument } from '../model/DspfDocument.js';
import { buildCompleteSemanticIR } from './semanticAssembly.js';
import { buildMappingContract } from './mappingContract.js';
import { generateReactApp } from './reactApp.js';
import { generateSpringBootApp } from './springBoot.js';

function contractFor () {
    const doc = new DspfDocument();
    doc.records[0].items.push({
        id: 'locate-1', kind: 'field', name: 'LOCATE', row: 4, col: 15, length: 11,
        usage: 'B', dataType: 'A', decimals: 0, indicators: [], keywords: [],
    });
    return buildMappingContract(buildCompleteSemanticIR(doc));
}

const FOUR = ['conversion-manifest.json', 'binding-map.json', 'traceability.json', 'conversion-report.json'];

describe('generated artifact completeness', () => {
    it('react output emits the four evidence artifacts', () => {
        const files = generateReactApp(contractFor());
        for (const path of FOUR) expect(files[path], path).toBeTruthy();
    });

    it('spring output emits the four evidence artifacts with seed-demo mode', () => {
        const files = generateSpringBootApp(contractFor());
        for (const path of FOUR) expect(files[path], path).toBeTruthy();
        const manifest = JSON.parse(files['conversion-manifest.json']);
        expect(manifest.mode).toBe('seed-demo');
    });

    it('manifest lists every sibling file exactly once with sorted paths and true byte sizes', () => {
        const files = generateReactApp(contractFor());
        const manifest = JSON.parse(files['conversion-manifest.json']);
        const paths = manifest.files.map(entry => entry.path);
        expect(paths).toEqual([...paths].sort());
        expect(new Set(paths).size).toBe(paths.length);
        expect(paths).toContain('src/App.jsx');
        for (const entry of manifest.files) {
            if (entry.path === 'conversion-manifest.json') continue;
            expect(new TextEncoder().encode(files[entry.path]).length, entry.path).toBe(entry.bytes);
        }
    });

    it('binding map covers every mapping identity with runtime key and DOM id', () => {
        const contract = contractFor();
        const bindingMap = JSON.parse(generateReactApp(contract)['binding-map.json']);
        expect(Object.keys(bindingMap).sort()).toEqual(
            contract.mappings.map(mapping => mapping.sourceIdentity).sort(),
        );
        for (const [identity, entry] of Object.entries(bindingMap)) {
            expect(entry.runtimeBindingKey, identity).toBeTruthy();
            expect(entry.domId, identity).toBeTruthy();
        }
    });

    it('is deterministic across repeated generation', () => {
        const contract = contractFor();
        expect(JSON.stringify(generateReactApp(contract))).toBe(JSON.stringify(generateReactApp(contract)));
        expect(JSON.stringify(generateSpringBootApp(contract))).toBe(JSON.stringify(generateSpringBootApp(contract)));
    });
});
