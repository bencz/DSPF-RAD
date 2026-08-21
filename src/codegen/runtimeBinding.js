// Generic external runtime-to-DSPF binding boundary.
// Runtime source is evidence for display behavior, not business workflow.

const ROLES = new Set([
    'display-value', 'hidden-control', 'indicator', 'message', 'workflow-hint', 'unknown',
]);
const OPERATIONS = new Set(['DCL-F', 'DCL-S', 'DCL-DS', 'ASSIGNMENT', 'EXFMT', 'WRITE', 'MESSAGE']);

export function buildRuntimeBindings (source = {}) {
    const bindings = [];
    const diagnostics = [];
    for (const input of source.bindings ?? []) {
        const runtimeSource = input.runtimeSource || source.runtimeSource || '';
        const known = Boolean(input.sourceIdentity && runtimeSource);
        const operation = input.operation == null || OPERATIONS.has(input.operation)
            ? input.operation ?? null : null;
        const role = ROLES.has(input.role) ? input.role : 'unknown';
        const status = known && role !== 'unknown' && (input.operation == null || operation)
            ? 'converted' : 'manual-review';
        const reason = status === 'converted' ? null : 'Runtime binding is incomplete or unknown';
        const binding = {
            sourceIdentity: input.sourceIdentity || '',
            runtimeSource,
            sourceLocation: input.sourceLocation ?? null,
            displayFile: input.displayFile ?? source.displayFile ?? null,
            record: input.record ?? null,
            field: input.field ?? null,
            role,
            value: input.value,
            workflowHint: input.workflowHint ?? null,
            operation,
            status,
            reason,
        };
        bindings.push(binding);
        if (status !== 'converted') diagnostics.push({
            code: 'UNKNOWN_RUNTIME_SYNTAX',
            severity: 'manual-review',
            status,
            message: reason,
            reason,
            action: 'review-runtime-binding',
            sourceIdentity: binding.sourceIdentity || null,
            sourceLocation: binding.sourceLocation,
        });
    }
    return { bindings, diagnostics };
}
