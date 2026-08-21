// V3.5C transaction and idempotency contract tests.

import { describe, expect, it } from 'vitest';
import { createTransactionProcessor } from './transactionContract.js';

describe('V3.5C transaction contract', () => {
    it('replays same key and rejects a changed payload', () => {
        const processor = createTransactionProcessor({ revision: 'r1' });
        const request = { key: 'k1', revision: 'r1', payload: { aid: 'ENTER', fields: { USER: 'a' } } };
        expect(processor.submit(request, () => ({ status: 200, value: 'ok' }))).toMatchObject({ status: 200, replay: false });
        expect(processor.submit(request, () => ({ status: 500 }))).toMatchObject({ status: 200, replay: true });
        expect(processor.submit({ ...request, payload: { aid: 'ENTER', fields: { USER: 'b' } } }, () => ({ status: 200 }))).toMatchObject({ status: 409 });
    });

    it('rejects stale revisions and invalid fields', () => {
        const processor = createTransactionProcessor({ revision: 'r1', validate: () => false });
        expect(processor.submit({ key: 'k2', revision: 'r0', payload: {} }, () => ({ status: 200 }))).toMatchObject({ status: 409 });
        expect(processor.submit({ key: 'k3', revision: 'r1', payload: {} }, () => ({ status: 200 }))).toMatchObject({ status: 422 });
    });
});
