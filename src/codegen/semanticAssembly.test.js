// V3.1A complete Semantic IR assembly tests.

import { describe, expect, it } from 'vitest';
import { DspfDocument } from '../model/DspfDocument.js';
import { buildCompleteSemanticIR } from './semanticAssembly.js';

describe('V3.1A Semantic IR assembly', () => {
    it('attaches indicators, AIDs, SFL, and source object status', () => {
        const doc = new DspfDocument();
        doc.records[0].name = 'ZZCT01';
        doc.records[0].type = 'SFLCTL';
        doc.records[0].keywords = [
            { name: 'SFLCTL', args: ['ZZSF01'], indicators: [] },
            { name: 'SFLDSP', args: [], indicators: ['31'] },
            { name: 'CA03', args: [], indicators: [] },
        ];
        doc.records[0].items.push({ id: 'x', kind: 'field', name: 'SHWREC', row: 1, col: 1, length: 4, usage: 'H', indicators: ['N12'], keywords: [] });
        const ir = buildCompleteSemanticIR(doc);
        expect(ir.aids).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'CA03' })]));
        expect(ir.indicators).toEqual(expect.arrayContaining([expect.objectContaining({ number: 31, scope: 'keyword' })]));
        expect(ir.subfiles).toEqual(expect.arrayContaining([expect.objectContaining({ controlRecord: 'ZZCT01', templateRecord: 'ZZSF01' })]));
        expect(ir.droppedObjectCount).toBe(0);
    });
});
