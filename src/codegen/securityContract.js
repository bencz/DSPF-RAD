// Pure runtime session, CSRF, and deny-by-default authorization checks.
// Spring Boot remains the production authority for these rules.

export function authorizeRuntimeRequest (request = {}) {
    if (!request.session?.id) return { status: 401, reason: 'Session is required' };
    if (request.session.expiresAt != null && request.now >= request.session.expiresAt) return { status: 440, reason: 'Session expired' };
    if (request.stateChanging && request.requestCsrf !== request.csrf) return { status: 403, reason: 'CSRF token is invalid' };
    if (request.requiredRole && !(request.roles ?? []).includes(request.requiredRole)) return { status: 403, reason: 'Permission denied' };
    return { status: 200, actorId: request.actorId ?? null, sessionId: request.session.id, correlationId: request.correlationId ?? null };
}
