// V3.0D source readiness gate tests.

import { describe, expect, it } from 'vitest';
import { assessSourceReadiness } from './readiness.js';

describe('V3.0D source readiness', () => {
    it('allows preview/build but blocks deployment for missing dependencies', () => {
        const readiness = assessSourceReadiness({ edges: [
            { status: 'resolved' }, { status: 'missing', target: 'XAN4CDEM/CUSTS.XWE0NB' },
        ] });
        expect(readiness).toMatchObject({ previewable: true, buildable: true, reviewRequired: true, runtimeReady: false, deployable: false });
        expect(readiness.blockers).toContain('XAN4CDEM/CUSTS.XWE0NB');
    });

    it('marks a fully resolved source set deployable', () => {
        expect(assessSourceReadiness({ edges: [{ status: 'resolved' }] })).toMatchObject({
            previewable: true, buildable: true, reviewRequired: false, runtimeReady: true, deployable: true,
        });
    });
});
