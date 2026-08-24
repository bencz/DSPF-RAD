// Optional design-overlay loader (D-15 L1). Tries the extractor's canonical
// output path first, then a root-level file; a missing file disables the
// overlay silently. A present but broken file surfaces its error string so
// review UIs can explain why no override applied.

const CANDIDATE_PATHS = ['design-overrides/layout-overrides.json', 'design-overrides.json'];

export async function loadDesignOverrides () {
    for (const path of CANDIDATE_PATHS) {
        try {
            const response = await fetch(path, { cache: 'no-store' });
            if (response.status === 404) continue;
            if (!response.ok) return { overrides: [], error: `HTTP ${response.status}` };
            const payload = await response.json();
            if (!Array.isArray(payload?.overrides)) {
                return { overrides: [], error: 'invalid-payload' };
            }
            return { overrides: payload.overrides, error: null };
        } catch {
            // Non-JSON body or offline: try the next candidate, then disable.
        }
    }
    return { overrides: [], error: null };
}

