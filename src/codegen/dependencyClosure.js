// Deterministic external dependency closure classifier.
// Missing or ambiguous references remain visible and block deployment readiness.

export function buildDependencyClosure (input = {}) {
    const available = new Set(input.available ?? []);
    const ambiguous = new Set(input.ambiguous ?? []);
    const edges = (input.references ?? []).map(reference => {
        let status = 'resolved';
        if (reference.kind === 'UNKNOWN') status = 'unsupported';
        else if (ambiguous.has(reference.target)) status = 'ambiguous';
        else if (!available.has(reference.target)) status = 'missing';
        return {
            ...reference,
            sourceIdentity: reference.sourceIdentity || reference.from,
            status,
            reason: status === 'resolved' ? null : `Dependency is ${status}`,
        };
    });
    return {
        edges,
        missingCount: edges.filter(edge => edge.status === 'missing').length,
        ambiguousCount: edges.filter(edge => edge.status === 'ambiguous').length,
        unsupportedCount: edges.filter(edge => edge.status === 'unsupported').length,
        deployable: edges.every(edge => edge.status === 'resolved'),
    };
}
