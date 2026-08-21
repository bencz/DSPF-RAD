// Deterministic PF/LF field metadata index for REFFLD resolution.
// Unknown external libraries remain explicit manual review.

const FIELD = /A\s+(\w+)\s+(\d+)([ASP])(?:\s+(\d+))?/;

export function buildPfDdIndex (sources = []) {
    const index = {};
    for (const source of sources) {
        const file = source.path?.split(/[\\/]/).pop()?.replace(/\.(PF|LF)$/i, '').toUpperCase();
        if (!file) continue;
        for (const line of String(source.text || '').split(/\r?\n/)) {
            const match = line.match(FIELD);
            if (!match) continue;
            const [, name, length, dataType, decimals] = match;
            index[`${file}.${name.toUpperCase()}`] = {
                dataType, length: Number(length), decimals: Number(decimals || 0), sourcePath: source.path,
            };
        }
    }
    return index;
}

export function resolveIndexedReffld (reference, index = {}) {
    const target = `${reference.file || ''}.${reference.field || ''}`;
    const metadata = index[target.toUpperCase()];
    return metadata
        ? { ...metadata, target, status: 'converted', reason: null }
        : { target, status: 'manual-review', reason: 'PF/DD source metadata is unavailable' };
}
