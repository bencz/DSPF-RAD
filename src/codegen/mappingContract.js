// Pure versioned source-to-target Mapping Contract builder.
// Every generated target remains traceable to Semantic IR evidence.
import { buildFieldOutput, collectReffldEvidence } from './outputSemantics.js';

function componentFor (item) {
    if (item.kind === 'field' && item.value?.usage === 'H') return 'HiddenControl';
    if (item.kind === 'field') return 'ConvertedField';
    if (item.kind === 'constant') return 'ConvertedLabel';
    if (item.kind === 'sysvalue') return 'ConvertedSystemValue';
    return 'UnsupportedItem';
}

export function buildMappingContract (ir) {
    const identities = new Map((ir.identities ?? []).map(identity => [identity.sourceIdentity, identity]));
    const sourceItems = [
        ...(ir.fields ?? []).map(value => ({ kind: 'field', value })),
        ...(ir.constants ?? []).map(value => ({ kind: 'constant', value })),
        ...(ir.systemValues ?? []).map(value => ({ kind: 'sysvalue', value })),
    ];
    const layout = new Map((ir.layout?.items ?? []).map(value => [value.sourceIdentity, value]));
    const mappings = sourceItems.map(({ kind, value }) => {
        const target = layout.get(value.sourceIdentity);
        const identity = identities.get(value.sourceIdentity)
            ?? [...identities.values()].find(candidate =>
                candidate.record === value.record && candidate.field === value.name);
        const status = target?.status ?? value.status ?? 'manual-review';
        const output = kind === 'field'
            ? buildFieldOutput(value)
            : { role: kind, editable: false, visible: true, status };
        return {
            sourceIdentity: value.sourceIdentity,
            targetComponent: componentFor({ kind, value }),
            source: { record: value.record, row: value.row, col: value.col, length: value.length },
            target: target ? {
                row: target.targetRow,
                col: target.targetCol,
                plannedSpan: target.plannedSpan,
                actualSpan: target.actualSpan,
            } : null,
            runtimeBindingKey: identity?.runtimeBindingKey ?? null,
            domId: identity?.domId ?? null,
            status,
            lossiness: target?.lossiness ?? ['missing-layout'],
            output,
            references: kind === 'field' ? collectReffldEvidence(value, {}) : [],
            traceability: {
                sourceIdentity: value.sourceIdentity,
                sourceRevision: ir.sourceRevision.sourceHash,
            },
        };
    });
    return {
        version: '2.1.0',
        sourceRevision: ir.sourceRevision,
        displayProfile: ir.displayProfile,
        mappings,
        diagnostics: ir.diagnostics.slice(),
    };
}
