// V3.0A source-set manifest contract test.
// The manifest is the public boundary before semantic conversion begins.

import { describe, expect, it } from 'vitest';
import { buildSourceManifest } from './sourceManifest.js';

describe('V3.0A source-set manifest', () => {
    it('records source identity and deterministic content hash', () => {
        const manifest = buildSourceManifest([
            { path: 'Display file/WCUSTSD2.DSPF', type: 'DSPF', encoding: 'utf8', revision: 'r1', text: 'A source' },
        ]);
        expect(manifest).toMatchObject({ version: '3.0', sourceCount: 1 });
        expect(manifest.sources[0]).toMatchObject({
            path: 'Display file/WCUSTSD2.DSPF', type: 'DSPF', encoding: 'utf8', revision: 'r1',
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        });
        expect(buildSourceManifest([{ path: 'Display file/WCUSTSD2.DSPF', type: 'DSPF', encoding: 'utf8', revision: 'r1', text: 'A source' }])).toEqual(manifest);
    });
});
