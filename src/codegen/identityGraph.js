// Read-only qualified identity and reference graph builder.
// Source identity, runtime binding, DOM id, and business name stay separate.

function safePart (value) {
    return String(value || 'anonymous').replace(/[^A-Za-z0-9_-]/g, '_');
}

function makeIdentity (record, field, occurrence, role) {
    const recordName = safePart(record);
    const fieldName = safePart(field);
    const sourceIdentity = `dspf:project:working:record:${recordName}:field:${fieldName}:occurrence:${occurrence}:role:${role}`;
    return {
        sourceIdentity,
        runtimeBindingKey: `${recordName}.${fieldName}.${occurrence}`,
        domId: `dspf-${recordName}-${fieldName}-${occurrence}`,
        businessName: field || null,
        project: 'dspf',
        revision: 'working',
        record,
        field: field || null,
        occurrence,
        role,
    };
}

export function buildIdentityGraph (source) {
    const identities = [];
    const byRecord = new Map();
    const byName = new Map();

    for (const record of source.records ?? []) {
        const recordIdentity = makeIdentity(record.name, null, 0, 'record');
        identities.push(recordIdentity);
        byRecord.set(record.name, recordIdentity);
        for (const [index, item] of (record.items ?? []).entries()) {
            const name = item.name || (item.kind === 'constant' ? item.text : item.kind);
            const identity = makeIdentity(record.name, name, index + 1, item.kind);
            identities.push(identity);
            const key = `${record.name}:${name || ''}`;
            const matches = byName.get(key) ?? [];
            matches.push(identity);
            byName.set(key, matches);
        }
    }

    const references = [];
    const diagnostics = [];
    const relationKeywords = new Set([
        'SFLCTL', 'WINDOW', 'REFFLD', 'CHCCTL', 'MNUBARCHC', 'PULLDOWN',
    ]);
    for (const record of source.records ?? []) {
        const from = byRecord.get(record.name)?.sourceIdentity;
        for (const keyword of record.keywords ?? []) {
            if (!relationKeywords.has(keyword.name)) continue;
            const targetName = keyword.args?.[0] || null;
            const relation = keyword.name === 'SFLCTL' ? 'SFL_CONTROL'
                : keyword.name === 'WINDOW' ? 'WINDOW_CHILD'
                    : keyword.name === 'REFFLD' ? 'REFFLD'
                        : keyword.name === 'CHCCTL' ? 'CHCCTL'
                            : 'MENU_PULLDOWN';
            const target = byRecord.get(targetName) ?? null;
            references.push({
                from,
                relation,
                to: target?.sourceIdentity ?? null,
                owner: from,
                status: target ? 'resolved' : 'manual-review',
                reason: target ? null : `Unknown target: ${targetName || 'missing'}`,
            });
            if (!target) diagnostics.push({
                code: 'UNRESOLVED_REFERENCE',
                severity: 'manual-review',
                message: `Cannot resolve ${keyword.name} target`,
                sourceIdentity: from,
                action: 'review-reference',
            });
        }
    }

    for (const record of source.records ?? []) {
        const recordIdentity = byRecord.get(record.name)?.sourceIdentity;
        for (const [index, item] of (record.items ?? []).entries()) {
            const itemName = item.name || item.kind;
            const itemIdentity = makeIdentity(record.name, itemName, index + 1, item.kind);
            for (const keyword of item.keywords ?? []) {
                if (!['REFFLD', 'CHCCTL'].includes(keyword.name)) continue;
                references.push({
                    from: itemIdentity.sourceIdentity,
                    relation: keyword.name,
                    to: null,
                    owner: recordIdentity,
                    status: 'manual-review',
                    reason: 'Item-level target resolution is deferred to V2.1-1H/1L',
                });
            }
        }
    }

    for (const [key, matches] of byName) {
        if (matches.length < 2) continue;
        diagnostics.push({
            code: 'IDENTITY_COLLISION',
            severity: 'manual-review',
            message: `Multiple occurrences share ${key}; occurrence-qualified identity required`,
            sourceIdentity: matches[0].sourceIdentity,
            action: 'review-identity',
        });
    }
    return { identities, references, diagnostics };
}
