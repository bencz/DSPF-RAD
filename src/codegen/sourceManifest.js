// Deterministic source-set manifest for V3 conversion projects.
// The manifest records input evidence before any semantic interpretation.

import { createHash } from 'node:crypto';

const TYPES = new Set(['DSPF', 'PF', 'LF', 'RPGLE', 'SQLRPGLE', 'CL']);

export function buildSourceManifest (sourceFiles = []) {
    const sources = sourceFiles.map((source) => {
        const text = String(source.text ?? '');
        const type = String(source.type || '').toUpperCase();
        if (!source.path || !TYPES.has(type)) throw new Error(`Invalid source member: ${source.path || 'missing path'}`);
        return {
            path: source.path,
            type,
            encoding: source.encoding || 'unknown',
            revision: source.revision || 'unversioned',
            sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
            owner: source.owner || null,
        };
    }).sort((a, b) => a.path.localeCompare(b.path));
    return { version: '3.0', sourceCount: sources.length, sources };
}
