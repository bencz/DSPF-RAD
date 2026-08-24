// Pure containment auditor for Gate C5 (contract 02 §13, design doc v4a §4).
// Given one fixture's pipeline outputs (ir + contract), it reconciles the
// source inventory against mappings and diagnostics and reports every escape:
//   E1  inventory object absent from both mappings and diagnostics
//   E2  mapping status outside the five-value conversion vocabulary
//   E3  status=converted without a concrete target representation
// The runner adds E4 (determinism) and E5 (throws) at the corpus level.
// Pure and deterministic: same inputs produce byte-identical results.

import { assessObjectCompleteness } from './completeness.js';
import { describeConversionProfile } from './conversionProfile.js';

const VOCABULARY = new Set(describeConversionProfile().statusVocabulary);

function countBy (list, keyFn) {
    const result = {};
    for (const entry of list) {
        const key = keyFn(entry);
        result[key] = (result[key] ?? 0) + 1;
    }
    return result;
}

export function auditFixture ({ name, ir, contract }) {
    const escapes = [];
    const objects = [
        ...(ir.fields ?? []).map(value => ({ kindBucket: 'fields', ...value })),
        ...(ir.constants ?? []).map(value => ({ kindBucket: 'constants', ...value })),
        ...(ir.systemValues ?? []).map(value => ({ kindBucket: 'systemValues', ...value })),
    ];

    // E1 — every inventory identity must be mapped or explicitly diagnosed.
    const completeness = assessObjectCompleteness({ objects }, contract);
    for (const identity of completeness.dropped) {
        escapes.push({ rule: 'E1', severity: 'error', identity, reason: 'inventory object has neither mapping nor diagnostic' });
    }

    // E2/E3 + per-bucket status histogram over the emitted mappings.
    const mappingsByStatus = [];
    for (const mapping of contract.mappings ?? []) {
        if (!VOCABULARY.has(mapping.status)) {
            escapes.push({ rule: 'E2', severity: 'error', identity: mapping.sourceIdentity, reason: `illegal status "${mapping.status}"` });
        }
        if (mapping.status === 'converted' && !mapping.target) {
            escapes.push({ rule: 'E3', severity: 'error', identity: mapping.sourceIdentity, reason: 'converted without a concrete target representation' });
        }
        const bucket = objects.find(object => object.sourceIdentity === mapping.sourceIdentity)?.kindBucket ?? 'other';
        mappingsByStatus.push({ bucket, status: mapping.status });
    }

    return {
        name,
        objectCount: objects.length,
        mappingCount: (contract.mappings ?? []).length,
        diagnosticCount: (contract.diagnostics ?? []).length,
        recordCount: (ir.recordFormats ?? []).length,
        histogram: countBy(mappingsByStatus, entry => `${entry.bucket}:${entry.status}`),
        references: countBy(ir.references ?? [], reference => reference.status),
        escapes,
    };
}
