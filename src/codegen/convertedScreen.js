// Pure assembly of the complete converted screen view model.
// It exposes evidence for every item and never creates executable actions.

export function buildConvertedScreen (ir, recordName) {
    const record = ir.recordFormats.find(format => format.name === recordName)
        ?? ir.recordFormats[0] ?? null;
    if (!record) {
        return {
            record: null, items: [], relations: [], diagnostics: ir.diagnostics.slice(), actions: [],
            status: 'manual-review',
        };
    }
    const itemMap = new Map();
    for (const item of ir.fields) itemMap.set(item.sourceIdentity, { kind: 'field', value: item });
    for (const item of ir.constants ?? []) itemMap.set(item.sourceIdentity, { kind: 'constant', value: item });
    for (const item of ir.systemValues ?? []) itemMap.set(item.sourceIdentity, { kind: 'sysvalue', value: item });
    const layouts = (ir.layout?.items ?? []).filter(item => item.sourceRecord === record.name);
    const items = layouts.map(layout => {
        const mapped = itemMap.get(layout.sourceIdentity);
        return {
            kind: mapped?.kind ?? 'unsupported',
            source: mapped?.value ?? { sourceIdentity: layout.sourceIdentity },
            target: layout,
            status: layout.status,
            diagnostics: ir.diagnostics.filter(diagnostic => diagnostic.sourceIdentity === layout.sourceIdentity),
        };
    });
    const relations = (ir.recordRelations ?? []).slice();
    const diagnostics = ir.diagnostics.filter(diagnostic =>
        !diagnostic.sourceIdentity || items.some(item => item.target.sourceIdentity === diagnostic.sourceIdentity));
    const hasReview = items.some(item => item.status !== 'converted')
        || diagnostics.some(diagnostic => diagnostic.severity !== 'info');
    return {
        record,
        items,
        relations,
        diagnostics,
        actions: [],
        status: hasReview ? 'manual-review' : 'converted',
    };
}
