// Pure versioned source-to-target Mapping Contract builder.
// Every generated target remains traceable to Semantic IR evidence.
import { buildFieldOutput, collectReffldEvidence } from './outputSemantics.js';
import { applyDesignOverrides, hashOverrides, normalizeOverrideInput } from './designOverrides.js';

function componentFor (item) {
    if (item.kind === 'field' && item.value?.usage === 'H') return 'HiddenControl';
    if (item.kind === 'field') return 'ConvertedField';
    if (item.kind === 'constant') return 'ConvertedLabel';
    if (item.kind === 'sysvalue') return 'ConvertedSystemValue';
    return 'UnsupportedItem';
}

export function buildMappingContract (ir, options = {}) {
    const contract = buildBaseContract(ir);
    const overrides = normalizeOverrideInput(options.overrides) ?? [];
    if (overrides.length === 0) return contract;
    const result = applyDesignOverrides(contract, overrides);
    // Attach the override evidence so downstream receipts/manifests can carry
    // the hash chain without re-deriving which overrides were applied.
    return {
        ...result.contract,
        overridesHash: `fnv1a:${hashOverrides(overrides)}`,
        overridesApplied: result.appliedCount,
    };
}

function buildBaseContract (ir) {
    const identities = new Map((ir.identities ?? []).map(identity => [identity.sourceIdentity, identity]));
    const sourceItems = [
        ...(ir.fields ?? []).map(value => ({ kind: 'field', value })),
        ...(ir.constants ?? []).map(value => ({ kind: 'constant', value })),
        ...(ir.systemValues ?? []).map(value => ({ kind: 'sysvalue', value })),
    ];
    const layout = new Map((ir.layout?.items ?? []).map(value => [value.sourceIdentity, value]));
    const layoutValues = [...layout.values()];
    const mappings = sourceItems.map(({ kind, value }) => {
        const target = layout.get(value.sourceIdentity)
            ?? layoutValues.find(candidate => candidate.sourceRecord === value.record
                && candidate.sourceRow === value.row && candidate.sourceCol === value.col);
        const identity = identities.get(value.sourceIdentity)
            ?? [...identities.values()].find(candidate => candidate.record === value.record
                && (candidate.field === value.name || candidate.businessName === value.name
                    || candidate.businessName === value.text));
        const fallbackIdentity = identity ?? {
            runtimeBindingKey: `source.${value.sourceIdentity.replace(/[^A-Za-z0-9]+/g, '_')}`,
            domId: `dspf-${value.sourceIdentity.replace(/[^A-Za-z0-9]+/g, '-')}`,
        };
        const status = target?.status ?? value.status ?? 'manual-review';
        const output = kind === 'field'
            ? buildFieldOutput(value)
            : { role: kind, editable: false, visible: true, status };
        return {
            sourceIdentity: value.sourceIdentity,
            targetComponent: componentFor({ kind, value }),
            source: { record: value.record, row: value.row, col: value.col, length: value.length },
            target: target ? { row: target.targetRow, col: target.targetCol, plannedSpan: target.plannedSpan, actualSpan: target.actualSpan } : null,
            runtimeBindingKey: fallbackIdentity.runtimeBindingKey,
            domId: fallbackIdentity.domId,
            status,
            lossiness: target?.lossiness ?? ['missing-layout'],
            output,
            references: kind === 'field' ? collectReffldEvidence(value, {}) : [],
            traceability: {
                sourceIdentity: value.sourceIdentity,
                source: { record: value.record, row: value.row, col: value.col, length: value.length },
                target: target ? { component: componentFor({ kind, value }), domId: fallbackIdentity.domId, row: target.targetRow, col: target.targetCol, span: target.actualSpan } : null,
                status,
                lossiness: target?.lossiness ?? ['missing-layout'],
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
