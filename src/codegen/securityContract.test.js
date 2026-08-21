// V3.5B session and security contract tests.

import { describe, expect, it } from 'vitest';
import { authorizeRuntimeRequest } from './securityContract.js';

describe('V3.5B session security', () => {
    const base = { session: { id: 's1', expiresAt: 200 }, now: 100, csrf: 'token', requestCsrf: 'token', roles: ['USER'], requiredRole: 'USER', stateChanging: true };
    it('authorizes a valid state-changing request', () => expect(authorizeRuntimeRequest(base).status).toBe(200));
    it('returns 401 for missing session', () => expect(authorizeRuntimeRequest({ ...base, session: null }).status).toBe(401));
    it('returns 440 for expired session', () => expect(authorizeRuntimeRequest({ ...base, now: 300 }).status).toBe(440));
    it('returns 403 for invalid CSRF or role', () => {
        expect(authorizeRuntimeRequest({ ...base, requestCsrf: 'bad' }).status).toBe(403);
        expect(authorizeRuntimeRequest({ ...base, roles: [] }).status).toBe(403);
    });
});
