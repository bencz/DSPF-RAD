// Lightweight contract validator for generated Mapping Contract evidence.
// It reports missing observable fields without coupling conversion to a schema package.

const REQUIRED = ['sourceIdentity', 'targetComponent', 'source', 'target', 'runtimeBindingKey', 'domId', 'status', 'lossiness', 'traceability'];

export function validateMappingContract (contract = {}) {
    const errors = [];
    if (!contract.version) errors.push('missing version');
    for (const mapping of contract.mappings ?? []) {
        for (const field of REQUIRED) {
            if (mapping[field] == null) errors.push(`missing ${field}`);
        }
        if (mapping.traceability && !mapping.traceability.sourceIdentity) errors.push('missing traceability.sourceIdentity');
    }
    return { valid: errors.length === 0, errors };
}
