// Pure DSPF record-format relation resolver.
// Records are components with explicit ownership; they are not implicitly routes.

const RELATIONS = {
    SFLCTL: 'SFL_CONTROL',
    WINDOW: 'WINDOW_CHILD',
    MNUBAR: 'MENU_PULLDOWN',
    PULLDOWN: 'MENU_PULLDOWN',
};

function identity (name, type) {
    return `dspf:project:working:record:${name}:field:null:occurrence:0:role:${type.toLowerCase()}`;
}

export function resolveRecordRelations (source = {}) {
    const records = source.records ?? [];
    const identities = new Map(records.map(record => [record.name, identity(record.name, record.type)]));
    const relations = [];
    const diagnostics = [];
    for (const record of records) {
        const from = identities.get(record.name);
        for (const keyword of record.keywords ?? []) {
            const relation = RELATIONS[keyword.name];
            if (!relation) continue;
            const targetName = keyword.args?.[0] || null;
            const to = identities.get(targetName) ?? null;
            const status = to ? 'resolved' : 'manual-review';
            relations.push({ from, relation, to, owner: from, status, reason: to ? null : `Unknown target: ${targetName || 'missing'}` });
            if (!to) diagnostics.push({
                code: 'UNRESOLVED_RECORD_RELATION', severity: 'manual-review', status,
                message: `Cannot resolve ${relation} target`, reason: `Unknown target: ${targetName || 'missing'}`,
                action: 'review-record-relation', sourceIdentity: from, sourceLocation: null,
            });
        }
    }
    return { relations, diagnostics };
}
