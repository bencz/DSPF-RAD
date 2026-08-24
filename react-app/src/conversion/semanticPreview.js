// React-side read-only conversion adapter for the V3 preview boundary.
// Every refresh rebuilds derived data from the current DspfDocument.
// Design overrides (D-15) flow through the same buildMappingContract path
// the generators use, so the preview and the export can never diverge.

import { buildCompleteSemanticIR } from '@dspf/codegen/semanticAssembly.js';
import { buildMappingContract } from '@dspf/codegen/mappingContract.js';
import { buildConvertedScreen } from '@dspf/codegen/convertedScreen.js';
import { itemSourceIdentity } from '@dspf/codegen/designOverrides.js';

const OVERRIDE_CODES = new Set(['DESIGN_OVERRIDE_APPLIED', 'OVERRIDE_NO_MATCHING_SOURCE']);

function itemNameFor (item) {
    if (item.kind === 'constant') return item.text || 'constant';
    if (item.kind === 'sysvalue') return item.name || 'system-value';
    return item.name || 'anonymous';
}

export function buildSemanticPreview (doc, options = {}) {
    const ir = buildCompleteSemanticIR(doc);
    const overrides = Array.isArray(options.overrides) ? options.overrides : [];
    const contract = buildMappingContract(ir, { overrides });
    const screen = buildConvertedScreen(ir, doc.activeRecord?.name);
    const overrideDiagnostics = overrides.length > 0
        ? contract.diagnostics.filter((diagnostic) => OVERRIDE_CODES.has(diagnostic.code))
        : [];
    const overridesByItemId = new Map();
    if (overrides.length > 0) {
        const byIdentity = new Map(overrides.map(override => [override.sourceIdentity, override]));
        for (const record of doc.records) {
            for (const [index, item] of record.items.entries()) {
                const identity = itemSourceIdentity(record.name, item.kind, itemNameFor(item), index + 1);
                const override = byIdentity.get(identity);
                if (override) overridesByItemId.set(item.id, override);
            }
        }
    }
    return { ir, contract, screen, overridesByItemId, overrideDiagnostics };
}

