// Metadata authority resolver for PF/DD references.
// Resolution order is explicit so missing IBM i sources are never guessed.

function key (request) {
    return `${request.library}/${request.file}.${request.field}`.toUpperCase();
}

export function resolveMetadataAuthority (request, metadata = {}) {
    const requested = key(request);
    const compiled = metadata.compiled?.[requested];
    if (compiled) return { source: 'compiled-dds', status: 'resolved', metadata: { ...compiled }, releaseEffect: 'none' };
    const source = metadata.source?.[requested];
    if (source) return { source: 'pf-source', status: 'resolved', metadata: { ...source }, releaseEffect: 'none' };
    const alias = metadata.aliases?.[requested];
    if (alias && metadata.source?.[alias.toUpperCase()]) return { source: 'approved-alias', status: 'resolved', metadata: { ...metadata.source[alias.toUpperCase()] }, resolvedFrom: alias, releaseEffect: 'none' };
    return { source: null, status: 'missing-source', metadata: null, releaseEffect: 'block-runtime-and-deployment', reason: 'Compiled DDS and exact PF/DD source are unavailable' };
}
