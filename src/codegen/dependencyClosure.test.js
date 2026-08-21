// V3.0C external dependency closure tests.

import { describe, expect, it } from 'vitest';
import { buildDependencyClosure } from './dependencyClosure.js';

describe('V3.0C dependency closure', () => {
    it('classifies resolved, missing, ambiguous, and unsupported edges', () => {
        const result = buildDependencyClosure({
            available: ['CUSTMAST.CUSTID'],
            references: [
                { from: 'SCREEN.USER', target: 'CUSTMAST.CUSTID', kind: 'REFFLD' },
                { from: 'SCREEN.ACCOUNT', target: 'XAN4CDEM/CUSTS.XWE0NB', kind: 'REFFLD' },
                { from: 'SCREEN.CODE', target: 'CUSTMAST.CODE', kind: 'REFFLD' },
                { from: 'SCREEN.ACTION', target: 'DO_WORK', kind: 'UNKNOWN' },
            ],
            ambiguous: ['CUSTMAST.CODE'],
        });
        expect(result.edges.map(edge => edge.status)).toEqual(['resolved', 'missing', 'ambiguous', 'unsupported']);
        expect(result.edges[1]).toMatchObject({ target: 'XAN4CDEM/CUSTS.XWE0NB', status: 'missing' });
        expect(result.edges[1].sourceIdentity).toBe('SCREEN.ACCOUNT');
    });
});
