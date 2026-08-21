// V3.0E metadata authority resolution tests.

import { describe, expect, it } from 'vitest';
import { resolveMetadataAuthority } from './metadataAuthority.js';

describe('V3.0E metadata authority', () => {
    const request = { library: 'XAN4CDEM', file: 'CUSTS', field: 'XWE0NB' };
    it('prefers matching compiled DDS metadata', () => {
        expect(resolveMetadataAuthority(request, { compiled: { 'XAN4CDEM/CUSTS.XWE0NB': { length: 15 } } })).toMatchObject({ source: 'compiled-dds', status: 'resolved', metadata: { length: 15 } });
    });
    it('uses exact source before an approved alias', () => {
        expect(resolveMetadataAuthority({ ...request, library: 'CUSTLIB', file: 'CUSTMAST', field: 'CUSTID' }, { source: { 'CUSTLIB/CUSTMAST.CUSTID': { length: 10 } }, aliases: { 'XAN4CDEM/CUSTS.XWE0NB': 'CUSTLIB/CUSTMAST.CUSTID' } })).toMatchObject({ source: 'pf-source', status: 'resolved' });
    });
    it('returns missing-source instead of guessing', () => {
        expect(resolveMetadataAuthority(request, {})).toMatchObject({ source: null, status: 'missing-source', releaseEffect: 'block-runtime-and-deployment' });
    });
});
