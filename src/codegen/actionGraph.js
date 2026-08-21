// Pure DSPF OPTION/FUNCTION action graph.
// Actions remain non-executable until runtime target and permission review.

const ACTION_NAMES = new Set([
    'CHOICE', 'CHCCTL', 'PSHBTNCHC', 'CA', 'CF', 'ENTER', 'MNUBARCHC', 'PULLDOWN',
]);

export function buildActionGraph (source = {}) {
    const actions = [];
    const diagnostics = [];
    for (const record of source.records ?? []) {
        for (const [index, keyword] of (record.keywords ?? []).entries()) {
            const name = String(keyword.name || '').toUpperCase();
            if (!ACTION_NAMES.has(name) && !/^CA\d\d$|^CF\d\d$/.test(name)) continue;
            const aid = /^CA\d\d$|^CF\d\d$/.test(name) ? name : keyword.args?.[0] || name;
            const sourceIdentity = `dspf:${record.name}:keyword:${name}:occurrence:${index + 1}`;
            const action = {
                sourceIdentity, aid, record: record.name, rowScope: null, pageScope: null,
                permission: null, destructive: false, confirmation: false, idempotencyKey: null,
                status: 'manual-review', executable: false,
                reason: 'Runtime target and permission are not resolved',
            };
            actions.push(action);
            diagnostics.push({
                code: 'ACTION_REQUIRES_REVIEW', severity: 'manual-review', status: 'manual-review',
                message: `Action ${name} requires runtime review`, reason: action.reason,
                action: 'review-action', sourceIdentity, sourceLocation: null,
            });
        }
    }
    return { actions, diagnostics };
}
