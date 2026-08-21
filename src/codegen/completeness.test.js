// V3.2B source-object completeness tests.

import { describe, expect, it } from 'vitest';
import { assessObjectCompleteness } from './completeness.js';

describe('V3.2B zero-drop gate', () => {
    it('passes when every source object has mapping or diagnostic status', () => {
        const result = assessObjectCompleteness({ objects: [
            { sourceIdentity: 'a' }, { sourceIdentity: 'b' },
        ] }, { mappings: [{ sourceIdentity: 'a' }], diagnostics: [{ sourceIdentity: 'b', status: 'manual-review' }] });
        expect(result).toMatchObject({ droppedObjectCount: 0, valid: true });
    });

    it('blocks a dropped source object', () => {
        const result = assessObjectCompleteness({ objects: [{ sourceIdentity: 'a' }, { sourceIdentity: 'b' }] }, { mappings: [{ sourceIdentity: 'a' }], diagnostics: [] });
        expect(result).toMatchObject({ droppedObjectCount: 1, valid: false, dropped: ['b'] });
    });
});
