// V3.2A Mapping Contract validation tests.

import { describe, expect, it } from 'vitest';
import { validateMappingContract } from './mappingValidation.js';

describe('V3.2A Mapping Contract validation', () => {
    it('accepts complete source-to-target mapping evidence', () => {
        const result = validateMappingContract({ version: '3.2', mappings: [{
            sourceIdentity: 'source:field:USER', targetComponent: 'ConvertedField',
            source: { record: 'MAIN', row: 1, col: 1, length: 10 },
            target: { row: 1, col: 1, actualSpan: 2 }, runtimeBindingKey: 'MAIN.USER',
            domId: 'dspf-MAIN-USER-1', status: 'converted', lossiness: [],
            traceability: { sourceIdentity: 'source:field:USER', source: {}, target: {}, status: 'converted', lossiness: [] },
        }] });
        expect(result).toMatchObject({ valid: true, errors: [] });
    });

    it('rejects mappings without traceability or target identity', () => {
        const result = validateMappingContract({ version: '3.2', mappings: [{ sourceIdentity: 'x' }] });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(expect.arrayContaining(['missing targetComponent', 'missing traceability']));
    });
});
