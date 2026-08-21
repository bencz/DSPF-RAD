// Generated React client boundary for the Spring Boot runtime.
// Server errors remain visible; the client never silently falls back to local mode.

export function createRuntimeClient ({ baseUrl = '', csrfToken = '', fetcher = fetch } = {}) {
    return {
        async submit (payload, idempotencyKey, correlationId) {
            const response = await fetcher(`${baseUrl}/api/transaction`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Idempotency-Key': idempotencyKey,
                    'X-Correlation-Id': correlationId,
                },
                body: JSON.stringify(payload),
            });
            const body = await response.json();
            if (!response.ok) {
                const error = new Error(body.error || body.message || `Runtime request failed: ${response.status}`);
                error.status = response.status;
                error.body = body;
                throw error;
            }
            return body;
        },
    };
}
