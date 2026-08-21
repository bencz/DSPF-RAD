// Contract tests for conversion approval, metadata isolation, and runtime requests.

import { describe, expect, it } from 'vitest';
import { approveConversion, createMetadataStore, validateTransaction } from './governance.js';

describe('V2.1 governance and runtime contracts', () => {
    it('enforces maker-checker approval and invalidates changed revisions', () => {
        expect(approveConversion({ status: 'generated', revision: 'r1', maker: 'alice' }, { revision: 'r1', checker: 'bob' })).toMatchObject({ status: 'approved' });
        expect(approveConversion({ status: 'generated', revision: 'r1', maker: 'alice' }, { revision: 'r1', checker: 'alice' }).status).toBe('error');
        expect(approveConversion({ status: 'approved', revision: 'r1', maker: 'alice' }, { revision: 'r2', checker: 'bob' }).status).toBe('error');
    });

    it('isolates revision metadata', () => {
        const store = createMetadataStore();
        store.put({ id: 'c1', revision: 'r1', status: 'generated' });
        expect(store.get('c1')).toMatchObject({ revision: 'r1' });
        expect(store.get('missing')).toBeNull();
    });

    it('validates Spring Boot transaction contract fields', () => {
        expect(validateTransaction({ screen: 'SIGNON', sessionId: 's1', aid: { kind: 'ENTER' }, fields: {}, headers: { 'Idempotency-Key': 'k1' } })).toMatchObject({ status: 'valid' });
        expect(validateTransaction({ screen: 'SIGNON', fields: {} }).status).toBe('invalid');
    });
});
