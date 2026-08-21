// Completeness tests for the V2.1 conversion-core contracts.
// These tests protect observable mapping, status, identity, and immutability invariants.

import { describe, expect, it } from 'vitest';
import { DspfDocument } from '../model/DspfDocument.js';
import {
    buildConvertedScreen,
    resolvePfDdReferences,
    buildDspfSemanticIR,
    buildRuntimeBindings,
    mapSemanticLayout,
    resolveDisplayProfile,
} from './index.js';

function field (name = 'USER', overrides = {}) {
    return {
        id: `${name}-id`, kind: 'field', name, row: 2, col: 3, length: 10,
        decimals: 0, dataType: 'A', usage: 'B', indicators: [], keywords: [], ...overrides,
    };
}

function documentWith (modelKey = '24x80') {
    const doc = new DspfDocument();
    doc.modelKey = modelKey;
    doc.records[0].items.push(field());
    return doc;
}

describe('V2.1 conversion completeness', () => {
    it('emits every required Semantic IR group without mutating the document', () => {
        const doc = documentWith();
        const before = JSON.stringify(doc.toJSON());
        const ir = buildDspfSemanticIR(doc);
        const groups = [
            'schemaVersion', 'sourceRevision', 'displayProfile', 'recordFormats',
            'recordRelations', 'fields', 'constants', 'references', 'indicators',
            'aids', 'windows', 'subfiles', 'menus', 'messages', 'capabilities', 'diagnostics',
        ];
        expect(groups.every(group => group in ir)).toBe(true);
        expect(ir.fields[0].sourceIdentity).toContain('USER');
        expect(JSON.stringify(doc.toJSON())).toBe(before);
    });

    it.each([
        ['24x80', 24, 80], ['27x132', 27, 132],
    ])('resolves %s profile explicitly', (modelKey, rows, cols) => {
        expect(resolveDisplayProfile({ modelKey, records: [] })).toMatchObject({
            modelKey, rows, cols, status: 'resolved',
        });
    });

    it('does not assume 80 columns for an unknown profile', () => {
        expect(resolveDisplayProfile({ modelKey: 'unknown', records: [] })).toMatchObject({
            modelKey: 'unknown', rows: null, cols: null, status: 'manual-review',
        });
    });

    it('keeps duplicate field identities and DOM ids distinct', () => {
        const doc = documentWith();
        doc.addRecord('SECOND');
        doc.records[1].items.push(field());
        const ir = buildDspfSemanticIR(doc);
        expect(ir.fields[0].sourceIdentity).not.toBe(ir.fields[1].sourceIdentity);
        expect(ir.identities[1].domId).not.toBe(ir.identities[3].domId);
        expect(ir.identities[1].runtimeBindingKey).not.toBe(ir.identities[3].runtimeBindingKey);
    });

    it('maps geometry and reports lossy crop', () => {
        const result = mapSemanticLayout({ records: [{ name: 'MAIN', items: [field('EDGE', { col: 80, length: 10 })] }] }, {
            modelKey: '24x80', rows: 24, cols: 80, status: 'resolved',
        });
        expect(result.items[0]).toMatchObject({ sourceCol: 80, targetCol: 12, actualSpan: 1, status: 'manual-review' });
        expect(result.items[0].lossiness).toContain('crop');
        expect(result.diagnostics[0].status).toBe('manual-review');
    });

    it('classifies unknown runtime bindings for review', () => {
        const result = buildRuntimeBindings({ runtimeSource: 'program.RPGLE', bindings: [{ role: 'unknown' }] });
        expect(result.bindings[0].status).toBe('manual-review');
        expect(result.diagnostics[0]).toMatchObject({ status: 'manual-review', sourceIdentity: null });
    });

    it('builds a complete classified screen without executable unresolved actions', () => {
        const doc = documentWith();
        doc.records[0].items.push({ id: 'label', kind: 'constant', text: 'Welcome', row: 1, col: 1, keywords: [], indicators: [] });
        const before = JSON.stringify(doc.toJSON());
        const screen = buildConvertedScreen(buildDspfSemanticIR(doc), doc.records[0].name);
        expect(screen.record.name).toBe('MAIN');
        expect(screen.items.map(item => item.kind)).toEqual(['field', 'constant']);
        expect(screen.items[0].source.row).toBe(2);
        expect(screen.items[0].target.actualSpan).toBeGreaterThan(0);
        expect(screen.actions).toEqual([]);
        expect(JSON.stringify(doc.toJSON())).toBe(before);
    });

    it('resolves PF/DD references and reports missing sources', () => {
        const result = resolvePfDdReferences({
            references: [
                { sourceIdentity: 'dspf:MAIN:field:USER:occurrence:1', target: 'CUSTOMER.USER' },
                { sourceIdentity: 'dspf:MAIN:field:CODE:occurrence:2', target: 'MISSING.CODE' },
            ],
            sources: {
                'CUSTOMER.USER': { dataType: 'A', length: 12, decimals: 0, validation: 'none' },
            },
        });
        expect(result.references[0]).toMatchObject({ status: 'converted', dataType: 'A', length: 12 });
        expect(result.references[1]).toMatchObject({ status: 'manual-review', target: 'MISSING.CODE' });
        expect(result.diagnostics[0].sourceIdentity).toContain('CODE');
    });
});
