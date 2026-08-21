// Regression tests for legacy DSPF hidden controls and REFFLD evidence.

import { describe, expect, it } from 'vitest';
import { buildFieldOutput, collectReffldEvidence } from './outputSemantics.js';

describe('legacy output semantics', () => {
    it('keeps usage H as a hidden non-editable control', () => {
        expect(buildFieldOutput({ record: 'ZZFT01', name: 'SFIELD', usage: 'H' })).toMatchObject({
            role: 'hidden-control', editable: false, visible: false, status: 'converted-with-warning',
        });
    });

    it('preserves REFFLD target and reports missing PF DD metadata', () => {
        const result = collectReffldEvidence({ record: 'ZZFT01', name: 'ZWE0NB', keywords: [
            { name: 'REFFLD', args: ['XWE0NB', 'XAN4CDEM/CUSTS'], indicators: [] },
        ] }, {});
        expect(result[0]).toMatchObject({ target: 'XAN4CDEM/CUSTS.XWE0NB', status: 'manual-review' });
        expect(result[0].reason).toContain('PF/DD');
    });
});
