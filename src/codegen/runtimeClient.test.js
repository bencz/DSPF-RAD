// V3.5D generated React to Spring runtime client tests.

import { describe, expect, it, vi } from 'vitest';
import { createRuntimeClient } from './runtimeClient.js';

describe('V3.5D runtime client', () => {
    it('sends session, CSRF, idempotency, correlation, and transaction data', async () => {
        const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });
        const client = createRuntimeClient({ baseUrl: 'http://localhost:8081', csrfToken: 'csrf', fetcher });
        const result = await client.submit({ sessionId: 's1', screen: 'WCUSTSD2', aid: { kind: 'ENTER' }, fields: { USER: 'x' }, cursor: {}, subfiles: {} }, 'idem-1', 'corr-1');
        expect(result).toEqual({ status: 'ok' });
        expect(fetcher).toHaveBeenCalledWith('http://localhost:8081/api/transaction', expect.objectContaining({ credentials: 'include', headers: expect.objectContaining({ 'X-CSRF-TOKEN': 'csrf', 'Idempotency-Key': 'idem-1', 'X-Correlation-Id': 'corr-1' }) }));
    });

    it('returns server errors without local fallback', async () => {
        const client = createRuntimeClient({ fetcher: vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'stale' }) }) });
        await expect(client.submit({} , 'k', 'c')).rejects.toMatchObject({ status: 409 });
    });
});
