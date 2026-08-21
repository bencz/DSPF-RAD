// Pure final deployment gate for conversion revisions.
// Manual review, stale approvals, and SoD violations block deployment.

export function assessDeployment (input = {}) {
    const blockers = [...(input.blockers ?? [])];
    if (input.status !== 'approved') blockers.push('revision-not-approved');
    if (input.maker && input.maker === input.checker) blockers.push('maker-checker-violation');
    if (input.revision !== input.approvedRevision) blockers.push('stale-approval');
    return {
        deployable: blockers.length === 0,
        status: blockers.length === 0 ? 'deployable' : 'blocked',
        blockers,
    };
}
