// Deterministic transaction and idempotency contract boundary.
// The production Spring service must provide atomic storage around this policy.

export function createTransactionProcessor ({ revision, validate = () => true } = {}) {
    const responses = new Map();
    return {
        submit (request = {}, execute) {
            if (request.revision !== revision) return { status: 409, reason: 'Revision is not current' };
            if (!request.key) return { status: 400, reason: 'Idempotency key is required' };
            if (!validate(request.payload)) return { status: 422, reason: 'Field validation failed' };
            const fingerprint = JSON.stringify(request.payload ?? null);
            const previous = responses.get(request.key);
            if (previous) return previous.fingerprint === fingerprint
                ? { ...previous.response, replay: true }
                : { status: 409, reason: 'Idempotency payload conflict' };
            const response = execute(request.payload);
            responses.set(request.key, { fingerprint, response });
            return { ...response, replay: false };
        },
    };
}
