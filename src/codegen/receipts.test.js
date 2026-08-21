// V3.6A conversion receipt and revision tests.

import { describe, expect, it } from 'vitest';
import { createReceiptStore, makeConversionReceipt } from './receipts.js';

describe('V3.6A conversion receipts', () => {
    it('records gate evidence and isolates revisions', () => {
        const receipt = makeConversionReceipt({ revision: 'r1', source: 'source', mapping: 'mapping', output: 'output', command: 'npm run build', result: 'passed', exitCode: 0, tests: ['vitest'], timestamp: '2026-08-21T00:00:00Z', artifacts: ['dist/'] });
        expect(receipt).toMatchObject({ revision: 'r1', sourceHash: expect.any(String), mappingHash: expect.any(String), outputHash: expect.any(String), exitCode: 0, artifacts: ['dist/'] });
        const store = createReceiptStore();
        store.put(receipt);
        expect(store.get('r1')).toEqual(receipt);
        expect(store.get('r2')).toBeNull();
    });
});
