// Source-set readiness gate for conversion lifecycle.
// Missing or ambiguous dependencies block runtime and deployment readiness.

export function assessSourceReadiness (closure = {}) {
    const edges = closure.edges ?? [];
    const blockers = edges.filter(edge => edge.status !== 'resolved')
        .map(edge => edge.target || edge.sourceIdentity || 'unknown-dependency');
    const reviewRequired = blockers.length > 0;
    return {
        previewable: true,
        buildable: true,
        reviewRequired,
        runtimeReady: !reviewRequired,
        deployable: !reviewRequired,
        blockers,
    };
}
