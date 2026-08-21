// V3.1D field role and indicator semantics tests.

import { describe, expect, it } from 'vitest';
import { normalizeFieldSemantics } from './fieldRoles.js';

describe('V3.1D field roles', () => {
    it.each([
        ['H', 'hidden-control', false, false],
        ['P', 'protected', false, true],
        ['I', 'input', true, true],
        ['O', 'output', false, true],
        ['B', 'input-output', true, true],
    ])('normalizes usage %s', (usage, role, editable, visible) => {
        expect(normalizeFieldSemantics({ usage })).toMatchObject({ usage, role, editable, visible });
    });

    it('keeps indicator scope and polarity in field semantics', () => {
        expect(normalizeFieldSemantics({ usage: 'H', indicators: ['N12'] }).indicators[0]).toMatchObject({
            number: 12, polarity: 'negative', scope: 'item',
        });
    });
});
