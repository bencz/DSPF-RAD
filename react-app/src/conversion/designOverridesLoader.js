// Optional design-overlay loader (D-15 L1). The projection file is served
// beside the app; a missing file disables the overlay silently. A present but
// broken file surfaces its error string so review UIs can explain why no
// override applied.

export async function loadDesignOverrides () {
    try {
        const response = await fetch('design-overrides.json', { cache: 'no-store' });
        if (!response.ok) {
            return { overrides: [], error: response.status === 404 ? null : `HTTP ${response.status}` };
        }
        const payload = await response.json();
        if (!Array.isArray(payload?.overrides)) {
            return { overrides: [], error: 'invalid-payload' };
        }
        return { overrides: payload.overrides, error: null };
    } catch {
        // Offline or non-JSON fallback body: the overlay stays disabled.
        return { overrides: [], error: null };
    }
}
