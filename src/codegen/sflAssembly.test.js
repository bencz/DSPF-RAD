// V3.1C complete SFL and record relation tests.

import { describe, expect, it } from 'vitest';
import { assembleSflScreens } from './sflAssembly.js';

describe('V3.1C SFL assembly', () => {
    it('assembles control, template, RRN, and runtime metadata', () => {
        const result = assembleSflScreens({ records: [
            { name: 'ZZSF01', type: 'SFL', keywords: [], items: [{ name: 'DSSEL' }] },
            { name: 'ZZCT01', type: 'SFLCTL', keywords: [
                { name: 'SFLCTL', args: ['ZZSF01'], indicators: [] },
                { name: 'SFLPAG', args: ['0012'], indicators: [] },
                { name: 'SFLSIZ', args: ['0013'], indicators: [] },
            ], items: [{ name: 'SHWREC', usage: 'H' }] },
        ] });
        expect(result.screens[0]).toMatchObject({ controlRecord: 'ZZCT01', templateRecord: 'ZZSF01', pageSize: 12, totalSize: 13, status: 'contract-only' });
        expect(result.screens[0].templateItems).toEqual([{ name: 'DSSEL' }]);
        expect(result.screens[0].controlItems).toEqual([{ name: 'SHWREC', usage: 'H' }]);
    });
});
