// Pure PF/DD reference resolver for REFFLD metadata.
// Missing or ambiguous source data is explicit manual review, never guessed.

export function resolvePfDdReferences (input = {}) {
    const sources = input.sources ?? {};
    const references = (input.references ?? []).map(reference => {
        const source = sources[reference.target];
        if (!source) {
            return { ...reference, status: 'manual-review', reason: 'PF/DD source is unavailable' };
        }
        return {
            ...reference,
            dataType: source.dataType,
            length: source.length,
            decimals: source.decimals ?? 0,
            validation: source.validation ?? null,
            sourceLocation: source.sourceLocation ?? null,
            status: 'converted',
            reason: null,
        };
    });
    const diagnostics = references.filter(reference => reference.status !== 'converted').map(reference => ({
        code: 'SOURCE_REFFLD_MISSING',
        severity: 'manual-review',
        status: 'manual-review',
        message: 'The referenced PF or DDS source is not available.',
        reason: reference.reason,
        action: 'provide-referenced-source',
        sourceIdentity: reference.sourceIdentity || null,
        sourceLocation: reference.sourceLocation ?? null,
    }));
    return { references, diagnostics };
}
