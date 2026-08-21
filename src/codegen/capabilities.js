// Pure capability classification for DSPF semantic conversion.
// Unsupported or unresolved semantics receive status and never become actions.

const ACTIONS = new Set([
    'CHOICE', 'CHCCTL', 'CA', 'CF', 'ENTER', 'MNUBARCHC', 'PULLDOWN', 'PSHBTNCHC',
]);

export function classifyKeyword (keyword, sourceIdentity) {
    const name = String(keyword?.name || '').toUpperCase();
    if (ACTIONS.has(name)) {
        return {
            sourceIdentity,
            keyword: name,
            status: 'manual-review',
            reason: 'Action requires runtime target and permission resolution',
        };
    }
    if (name === 'REFFLD') {
        return {
            sourceIdentity,
            keyword: name,
            status: 'manual-review',
            reason: 'Referenced PF or DDS source is not resolved yet',
        };
    }
    if (name === 'SFL' || name === 'SFLCTL' || name.startsWith('SFL')) {
        return {
            sourceIdentity,
            keyword: name,
            status: 'converted-with-warning',
            reason: 'SFL runtime state requires a runtime contract',
        };
    }
    return { sourceIdentity, keyword: name, status: 'converted' };
}

export function classifyCapabilities (source, identities = []) {
    const capabilities = [];
    const diagnostics = [];
    const identityByRecord = new Map(
        identities.filter(identity => identity.role === 'record')
            .map(identity => [identity.record, identity.sourceIdentity]),
    );
    for (const record of source.records ?? []) {
        const recordIdentity = identityByRecord.get(record.name);
        for (const keyword of record.keywords ?? []) {
            const capability = classifyKeyword(keyword, recordIdentity);
            capabilities.push(capability);
            if (capability.status !== 'converted') diagnostics.push({
                code: `CAPABILITY_${capability.status.replaceAll('-', '_').toUpperCase()}`,
                severity: capability.status === 'converted-with-warning' ? 'warning' : capability.status,
                status: capability.status,
                message: capability.reason,
                reason: capability.reason,
                action: 'review-capability',
                sourceIdentity: recordIdentity,
                sourceLocation: null,
            });
        }
        for (const [index, item] of (record.items ?? []).entries()) {
            const itemIdentity = identities.find(identity => identity.record === record.name
                && identity.occurrence === index + 1 && identity.role === item.kind)?.sourceIdentity;
            for (const keyword of item.keywords ?? []) {
                const capability = classifyKeyword(keyword, itemIdentity);
                capabilities.push(capability);
                if (capability.status !== 'converted') diagnostics.push({
                    code: `CAPABILITY_${capability.status.replaceAll('-', '_').toUpperCase()}`,
                    severity: capability.status === 'converted-with-warning' ? 'warning' : capability.status,
                    status: capability.status,
                    message: capability.reason,
                    reason: capability.reason,
                    action: 'review-capability',
                    sourceIdentity: itemIdentity,
                    sourceLocation: null,
                });
            }
        }
    }
    return { capabilities, diagnostics };
}
