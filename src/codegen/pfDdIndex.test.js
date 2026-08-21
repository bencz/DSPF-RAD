// PF/LF source index contract tests for REFFLD resolution.

import { describe, expect, it } from 'vitest';
import { buildPfDdIndex, resolveIndexedReffld } from './pfDdIndex.js';

describe('PF/DD source index', () => {
    it('indexes PF fields with type, length, decimals, and source', () => {
        const index = buildPfDdIndex([{ path: 'CUSTMAST.PF', text: '     A          R CUSTREC\n     A            CUSTID        10A\n     A            DOB             8S 0' }]);
        expect(index['CUSTMAST.CUSTID']).toMatchObject({ dataType: 'A', length: 10, decimals: 0, sourcePath: 'CUSTMAST.PF' });
        expect(index['CUSTMAST.DOB']).toMatchObject({ dataType: 'S', length: 8, decimals: 0 });
    });

    it('resolves matching REFFLD and reports absent external source', () => {
        const index = buildPfDdIndex([{ path: 'CUSTMAST.PF', text: '     A            CUSTID        10A' }]);
        expect(resolveIndexedReffld({ field: 'CUSTID', file: 'CUSTMAST' }, index)).toMatchObject({ status: 'converted', length: 10 });
        expect(resolveIndexedReffld({ field: 'XWE0NB', file: 'XAN4CDEM/CUSTS' }, index)).toMatchObject({ status: 'manual-review', target: 'XAN4CDEM/CUSTS.XWE0NB' });
    });

    it('indexes time fields and logical-file base keys', () => {
        const index = buildPfDdIndex([
            { path: 'ACCTMAST.PF', text: '     A            LASTTRANTM     6T 0' },
            { path: 'ACCTMASTL1.LF', text: '     A          R ACCTL1\n     A          P ACCTMAST\n     A          K CUSTID' },
        ]);
        expect(index['ACCTMAST.LASTTRANTM']).toMatchObject({ dataType: 'T', length: 6 });
        expect(index['ACCTMASTL1.__record']).toMatchObject({ baseFile: 'ACCTMAST', keys: ['CUSTID'] });
    });
});
