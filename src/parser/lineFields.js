// Decode a single DSPF source line into its column-aligned fields.
//
// DSPF is 80-col fixed-format (1-indexed):
//   1-5   sequence (ignored)
//   6     form type 'A' (or blank in lenient mode)
//   7     reserved
//   8-16  three 3-char indicator slots
//   17    name type ('R' for record, blank for field/constant)
//   18    reserved
//   19-28 name (10 chars)
//   29    reference flag ('R' for REFFLD-style)
//   30-34 length
//   35    data type (A, S, P, Y, …)
//   36-37 decimals
//   38    usage (I, O, B, H, M, P)
//   39-41 row
//   42-44 col
//   45-80 keyword text

export function parseSourceLine (line) {
    // Pad short lines so the fixed-column slicing never reads `undefined`,
    // but don't truncate: merged continuation lines (joined by '+') are
    // legitimately longer than 80 cols and we want the full keyword text.
    const padded = line.length < 80 ? line.padEnd(80) : line;

    const indicators = parseConditionArea(padded.substring(7, 16));
    const conditionOp = /^[AO]$/i.test(padded[6])
        ? padded[6].toUpperCase()
        : '';

    const nameType  = padded[16]?.trim() ?? '';
    const name      = padded.substring(18, 28).trim();
    const refFlag   = padded[28]?.trim() ?? '';
    const lengthS   = padded.substring(29, 34).trim();
    const dataType  = padded[34]?.trim() ?? '';
    const decimalsS = padded.substring(35, 37).trim();
    const usage     = padded[37]?.trim() ?? '';
    const rowS      = padded.substring(38, 41).trim();
    const colS      = padded.substring(41, 44).trim();
    const keyword   = padded.substring(44).trimEnd();

    return {
        indicators, conditionOp,
        nameType, name, refFlag,
        length:   lengthS ? parseInt(lengthS, 10)   : null,
        dataType, decimals: decimalsS ? parseInt(decimalsS, 10) : null,
        usage,
        // Pre-baked numeric values for the simple absolute case; the main
        // parse loop overrides these with relative-aware resolution using
        // rowRaw / colRaw.
        row: rowS ? parseInt(rowS, 10) : null,
        col: colS ? parseInt(colS, 10) : null,
        rowRaw: rowS, colRaw: colS,
        keywordText: keyword,
    };
}

function parseConditionArea (area) {
    const trimmed = area.trim();
    // Display-size condition names (*DS3, *DS4 or a user-defined name)
    // occupy the condition area as one token rather than three slots.
    if (trimmed.startsWith('*')) return [trimmed.toUpperCase()];
    return [
        parseIndChunk(area.substring(0, 3)),
        parseIndChunk(area.substring(3, 6)),
        parseIndChunk(area.substring(6, 9)),
    ].filter(Boolean);
}

// Parse a row/col field which may be empty, an absolute number, or an
// IBM "+N" relative offset.
export function parseRelativeNum (s) {
    const t = (s ?? '').trim();
    if (!t) return { kind: 'absent' };
    if (t.startsWith('+')) {
        const rest = t.substring(1).trim();
        const n = rest === '' ? 0 : parseInt(rest, 10);
        return Number.isFinite(n)
            ? { kind: 'relative', offset: n }
            : { kind: 'absent' };
    }
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? { kind: 'absolute', value: n } : { kind: 'absent' };
}

function parseIndChunk (chunk) {
    if (!chunk || chunk.trim() === '') return null;
    const nFlag = chunk[0] === 'N' ? 'N' : '';
    const digits = chunk.substring(1).trim();
    if (!/^\d{1,2}$/.test(digits)) return null;
    return nFlag + digits.padStart(2, '0');
}
