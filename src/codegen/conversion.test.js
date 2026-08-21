// Completeness tests for the V2.1 conversion-core contracts.
// These tests protect observable mapping, status, identity, and immutability invariants.

import { describe, expect, it } from 'vitest';
import { DspfDocument } from '../model/DspfDocument.js';
import {
    buildConvertedScreen,
    buildMappingContract,
    generateReactApp,
    resolvePfDdReferences,
    resolveRecordRelations,
    createGeneratedServer,
    normalizeIndicators,
    buildSflRuntime,
    buildDspfSemanticIR,
    buildRuntimeBindings,
    mapSemanticLayout,
    resolveDisplayProfile,
    buildActionGraph,
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

    it('resolves record relations and marks unknown targets for review', () => {
        const result = resolveRecordRelations({ records: [
            { name: 'CTL', type: 'SFLCTL', keywords: [{ name: 'SFLCTL', args: ['ROWS'] }] },
            { name: 'ROWS', type: 'SFL', keywords: [] },
            { name: 'BAD', type: 'WINDOW', keywords: [{ name: 'WINDOW', args: ['MISSING'] }] },
        ] });
        expect(result.relations).toEqual(expect.arrayContaining([
            expect.objectContaining({ relation: 'SFL_CONTROL', status: 'resolved' }),
            expect.objectContaining({ relation: 'WINDOW_CHILD', status: 'manual-review' }),
        ]));
        expect(result.diagnostics[0].status).toBe('manual-review');
    });

    it('builds an explicit SFL runtime contract from control keywords', () => {
        const result = buildSflRuntime({
            controlRecord: { name: 'CTL', type: 'SFLCTL', keywords: [
                { name: 'SFLCTL', args: ['ROWS'], indicators: [] },
                { name: 'SFLSIZ', args: ['0015'], indicators: [] },
                { name: 'SFLPAG', args: ['0014'], indicators: [] },
                { name: 'SFLDSP', args: [], indicators: ['31'] },
                { name: 'SFLDSPCTL', args: [], indicators: ['32'] },
                { name: 'SFLCLR', args: [], indicators: ['30'] },
                { name: 'SFLEND', args: ['*MORE'], indicators: ['80'] },
            ], items: [] },
            templateRecord: { name: 'ROWS', type: 'SFL', keywords: [], items: [] },
        });
        expect(result).toMatchObject({ controlRecord: 'CTL', templateRecord: 'ROWS', pageSize: 14, totalSize: 15, status: 'contract-only' });
        expect(result.displayIndicator).toBe('31');
        expect(result.rows).toEqual([]);
    });

    it('normalizes indicator polarity and scope without merging meanings', () => {
        const result = normalizeIndicators({
            recordIndicators: ['03'],
            keywordIndicators: ['N12'],
            itemIndicators: ['45'],
            indara: true,
        });
        expect(result.indara).toBe(true);
        expect(result.record[0]).toMatchObject({ number: 3, polarity: 'positive', scope: 'record' });
        expect(result.keyword[0]).toMatchObject({ number: 12, polarity: 'negative', scope: 'keyword' });
        expect(result.item[0]).toMatchObject({ number: 45, polarity: 'positive', scope: 'item' });
    });

    it('builds safe action graph and reviews unknown targets', () => {
        const result = buildActionGraph({ records: [{ name: 'MAIN', type: 'RECORD', keywords: [
            { name: 'CA03', args: [], indicators: [] },
            { name: 'ENTER', args: [], indicators: [] },
            { name: 'PSHBTNCHC', args: ['1', 'Save'], indicators: [] },
        ], items: [] }] });
        expect(result.actions).toHaveLength(3);
        expect(result.actions[0]).toMatchObject({ aid: 'CA03', status: 'manual-review', executable: false });
        expect(result.actions[1]).toMatchObject({ aid: 'ENTER', status: 'manual-review', executable: false });
        expect(result.diagnostics).toHaveLength(3);
    });

    it('generates deterministic complete source-to-target mappings', () => {
        const doc = documentWith();
        const ir = buildDspfSemanticIR(doc);
        const contract = buildMappingContract(ir);
        expect(contract.version).toBe('2.1.0');
        expect(contract.mappings[0]).toMatchObject({
            sourceIdentity: expect.any(String),
            targetComponent: 'ConvertedField',
            runtimeBindingKey: expect.any(String),
            domId: expect.any(String),
            status: 'converted',
            lossiness: expect.any(Array),
        });
        expect(contract.mappings[0].traceability.sourceIdentity).toBe(contract.mappings[0].sourceIdentity);
        expect(buildMappingContract(ir)).toEqual(contract);
    });

    it('generates a standalone React app file set', () => {
        const files = generateReactApp({ version: '2.1.0', displayProfile: { modelKey: '24x80' }, mappings: [], diagnostics: [] });
        expect(Object.keys(files)).toEqual(expect.arrayContaining([
            'package.json', 'index.html', 'src/main.jsx', 'src/App.jsx',
            'src/theme.js', 'src/routeManifest.js', 'conversion-report.json',
        ]));
        expect(files['package.json']).toContain('react');
        expect(files['src/App.jsx']).toContain('Mapping Contract');
        expect(files['src/App.jsx']).not.toContain('dspf-rad/src');
        expect(JSON.parse(files['conversion-report.json'])).toMatchObject({ version: '2.1.0' });
    });
});


    it('serves generated output with explicit local mode and API errors', async () => {
        const files = generateReactApp({ version: '2.1.0', displayProfile: { modelKey: '24x80' }, mappings: [], diagnostics: [] });
        const server = createGeneratedServer(files, { mode: 'local', apiBaseUrl: '/api' });
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        const html = await fetch(`http://127.0.0.1:${port}/index.html`);
        const missing = await fetch(`http://127.0.0.1:${port}/missing`);
        await new Promise(resolve => server.close(resolve));
        expect(server.mode).toBe('local');
        expect(server.apiBaseUrl).toBe('/api');
        expect(html.status).toBe(200);
        expect(missing.status).toBe(404);
    });