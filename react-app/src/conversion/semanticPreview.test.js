// V3.3A Semantic IR preview refresh contract test.

import { describe, expect, it } from 'vitest';
import { DspfDocument } from '@dspf/model/index.js';
import { buildSemanticPreview } from './semanticPreview.js';

describe('semantic preview refresh', () => {
    it('rebuilds from the current document without mutating it', () => {
        const doc = new DspfDocument();
        doc.records[0].items.push({ id: 'x', kind: 'field', name: 'USER', row: 2, col: 3, length: 10, usage: 'I', indicators: [], keywords: [] });
        const before = structuredClone(doc.toJSON());
        const first = buildSemanticPreview(doc);
        doc.updateItem('x', { col: 20 });
        const second = buildSemanticPreview(doc);
        expect(first.contract.mappings[0].source.col).toBe(3);
        expect(second.contract.mappings[0].source.col).toBe(20);
        expect(second.screen.items).not.toHaveLength(0);
        expect(doc.toJSON()).not.toEqual(before);
    });
});
