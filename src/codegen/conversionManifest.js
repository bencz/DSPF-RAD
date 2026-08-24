// Shared conversion-manifest builder for generated artifacts.
// Every generator emits conversion-manifest.json so a run records which files
// it produced (siblings only — the manifest cannot list its own bytes),
// which semantic rules were in effect, and any design-override evidence.
// Output is deterministic: paths are sorted, no timestamps, no random values.

import { describeConversionProfile } from './conversionProfile.js';

function byteLength (text) {
    return new TextEncoder().encode(text).length;
}

export function buildConversionManifest ({ generator, contractVersion, files, extra = {} }) {
    return {
        schemaVersion: 'conversion-manifest/1',
        generator,
        contractVersion,
        effectiveProfile: describeConversionProfile(),
        fileCount: Object.keys(files).length,
        files: Object.keys(files).sort().map(path => ({
            path,
            bytes: byteLength(String(files[path])),
        })),
        ...extra,
    };
}
