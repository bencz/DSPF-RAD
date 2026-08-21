// V3.4B generated React artifact validation tests.

import { describe, expect, it } from 'vitest';
import { generateReactApp } from './reactApp.js';
import { validateGeneratedReactArtifact } from './generatedValidation.js';

describe('V3.4B generated React validation', () => {
    it('accepts schema-complete generated artifacts', () => {
        const files = generateReactApp({ version: '3.4', displayProfile: { modelKey: '24x80' }, mappings: [{ sourceIdentity: 'x', targetComponent: 'ConvertedField', source: { record: 'R', row: 1, col: 1, length: 2 }, target: { row: 1, col: 1, actualSpan: 1 }, runtimeBindingKey: 'R.X', domId: 'x-1', status: 'converted', lossiness: [], output: { role: 'input', visible: true, editable: true }, traceability: { sourceIdentity: 'x', source: {}, target: {}, status: 'converted', lossiness: [] } }], diagnostics: [] });
        expect(validateGeneratedReactArtifact(files)).toMatchObject({ valid: true, errors: [] });
    });

    it('rejects an artifact without required route and binding evidence', () => {
        expect(validateGeneratedReactArtifact({ 'package.json': '{}', 'src/App.jsx': '' })).toMatchObject({ valid: false });
    });
});
