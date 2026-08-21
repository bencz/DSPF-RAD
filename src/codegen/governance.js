// Pure governance and runtime-contract helpers for generated output.
// Metadata is revision-scoped; approval never authorizes changed artifacts.

export function approveConversion (conversion, decision) {
    if (conversion.status !== 'generated' && conversion.status !== 'approved') return { status: 'error', reason: 'Conversion is not approvable' };
    if (conversion.revision !== decision.revision) return { status: 'error', reason: 'Revision changed' };
    if (conversion.maker === decision.checker) return { status: 'error', reason: 'Maker-checker separation required' };
    return { ...conversion, status: 'approved', checker: decision.checker };
}

export function createMetadataStore () {
    const records = new Map();
    return {
        put (record) { records.set(record.id, { ...record }); return { ...record }; },
        get (id) { const record = records.get(id); return record ? { ...record } : null; },
    };
}

export function validateTransaction (request = {}) {
    const valid = Boolean(request.screen && request.sessionId && request.aid?.kind && request.headers?.['Idempotency-Key']);
    return valid ? { status: 'valid' } : { status: 'invalid', reason: 'screen, session, AID, and idempotency key are required' };
}
