// Pure design-overlay application for the Mapping Contract (D-15).
// Overrides are extracted from OpenPencil documents and may change only
// target-side values: grid column, span, and target component. Application
// never mutates its inputs, and every override that matches no source object
// becomes a visible diagnostic so nothing disappears silently.

import { itemSourceIdentity } from './sourceIdentities.js';

export { itemSourceIdentity };

// Browser-safe stable hash (FNV-1a) for the receipt's overridesHash. Same
// algorithm family as semanticIR source hashing; no node:crypto dependency
// because generators also run inside the browser shell.
export function hashOverrides (overrides) {
    const text = JSON.stringify(overrides ?? []);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeOverrideInput (payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.overrides)) return payload.overrides;
    return null;
}

function cloneMapping (mapping) {
    return {
        ...mapping,
        source: { ...mapping.source },
        target: mapping.target ? { ...mapping.target } : null,
        output: { ...mapping.output },
        traceability: {
            ...mapping.traceability,
            source: { ...mapping.traceability.source },
            target: mapping.traceability.target ? { ...mapping.traceability.target } : null,
        },
    };
}

function describeChanges (override) {
    const parts = [];
    if (Number.isFinite(override.target?.targetCol)) parts.push(`col=${override.target.targetCol}`);
    if (Number.isFinite(override.target?.targetRow)) parts.push(`row=${override.target.targetRow}`);
    if (Number.isFinite(override.target?.span)) parts.push(`span=${override.target.span}`);
    if (typeof override.target?.component === 'string') parts.push(`component=${override.target.component}`);
    return parts.join(', ') || 'no-op';
}

export function applyDesignOverrides (contract, overrides) {
    const mappings = new Map(contract.mappings.map(mapping => [mapping.sourceIdentity, cloneMapping(mapping)]));
    const diagnostics = [];
    let appliedCount = 0;

    for (const override of overrides ?? []) {
        const mapping = mappings.get(override.sourceIdentity);
        if (!mapping) {
            diagnostics.push({
                code: 'OVERRIDE_NO_MATCHING_SOURCE',
                severity: 'warning',
                message: `No source object matches the design override ${override.sourceIdentity}`,
                sourceIdentity: override.sourceIdentity,
            });
            continue;
        }
        // A mapping may have no layout target yet (e.g. unresolved display
        // profile): geometry overrides are skipped, component still applies.
        const changeParts = [];
        if (mapping.target && Number.isFinite(override.target?.targetCol)) {
            mapping.target.col = override.target.targetCol;
            mapping.traceability.target.col = override.target.targetCol;
            changeParts.push(`col=${override.target.targetCol}`);
        }
        if (mapping.target && Number.isFinite(override.target?.targetRow)) {
            mapping.target.row = override.target.targetRow;
            mapping.traceability.target.row = override.target.targetRow;
            changeParts.push(`row=${override.target.targetRow}`);
        }
        if (mapping.target && Number.isFinite(override.target?.span)) {
            mapping.target.plannedSpan = override.target.span;
            mapping.target.actualSpan = override.target.span;
            mapping.traceability.target.span = override.target.span;
            changeParts.push(`span=${override.target.span}`);
        }
        if (typeof override.target?.component === 'string' && override.target.component.length > 0) {
            mapping.targetComponent = override.target.component;
            mapping.traceability.target.component = override.target.component;
            changeParts.push(`component=${override.target.component}`);
        }
        appliedCount += 1;
        diagnostics.push({
            code: 'DESIGN_OVERRIDE_APPLIED',
            severity: 'info',
            message: `Design override applied (${changeParts.join(', ') || 'no-op'})`,
            sourceIdentity: override.sourceIdentity,
        });
    }

    return {
        contract: {
            ...contract,
            mappings: [...mappings.values()],
            diagnostics: [...contract.diagnostics, ...diagnostics],
        },
        appliedCount,
        diagnostics,
    };
}
