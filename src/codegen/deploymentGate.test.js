// V3.6B approval and deployment gate tests.

import { describe, expect, it } from 'vitest';
import { assessDeployment } from './deploymentGate.js';

describe('V3.6B deployment gates', () => {
    it('allows an approved revision without blockers', () => {
        expect(assessDeployment({ status: 'approved', maker: 'alice', checker: 'bob', revision: 'r1', approvedRevision: 'r1', blockers: [] })).toMatchObject({ deployable: true, status: 'deployable' });
    });
    it('blocks review, self-approval, and stale revisions', () => {
        expect(assessDeployment({ status: 'approved', maker: 'alice', checker: 'bob', revision: 'r1', approvedRevision: 'r1', blockers: ['REFFLD'] }).deployable).toBe(false);
        expect(assessDeployment({ status: 'approved', maker: 'alice', checker: 'alice', revision: 'r1', approvedRevision: 'r1', blockers: [] }).deployable).toBe(false);
        expect(assessDeployment({ status: 'approved', maker: 'alice', checker: 'bob', revision: 'r2', approvedRevision: 'r1', blockers: [] }).deployable).toBe(false);
    });
});
