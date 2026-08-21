// Deterministic PF/LF field metadata index for REFFLD resolution.
// Unknown external libraries remain explicit manual review.

const FIELD = /A\s+(\w+)\s+(\d+)([A-Z])(?:\s+(\d+))?/;
const RECORD = /A\s+R\s+(\w+)/;
const BASE = /A\s+P\s+(\w+)/;
const KEY = /A\s+K\s+(\w+)/;

export function buildPfDdIndex (sources = []) {
    const index = {};
    for (const source of sources) {
        const file = source.path?.split(/[\\/]/).pop()?.replace(/\.(PF|LF)$/i, '').toUpperCase();
        if (!file) continue;
        const metadata = { baseFile: null, keys: [], sourcePath: source.path };
        for (const line of String(source.text || '').split(/\r?\n/)) {
            const record = line.match(RECORD);
            if (record) metadata.record = record[1];
            const base = line.match(BASE);
            if (base) metadata.baseFile = base[1].toUpperCase();
            const key = line.match(KEY);
            if (key) metadata.keys.push(key[1].toUpperCase());
            const match = line.match(FIELD);
            if (!match) continue;
            const [, name, length, dataType, decimals] = match;
            index[`${file}.${name.toUpperCase()}`] = {
                dataType, length: Number(length), decimals: Number(decimals || 0), sourcePath: source.path,
            };
        }
        if (file.endsWith('L1') || metadata.baseFile) index[`${file}.__record`] = metadata;
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
