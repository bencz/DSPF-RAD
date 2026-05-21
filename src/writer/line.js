// Builds a single 80-col DSPF source line from its semantic fields, and
// wraps over-long keyword text with '+' / '-' continuations.

const MAX_KW_WIDTH = 36;            // cols 45..80 inclusive

// Emit a line, splitting the keyword text across continuations when it
// won't fit in cols 45..80.  Per-field metadata (row/col/name/etc.) only
// appears on the FIRST emitted line; subsequent lines carry just the
// continuation chunk in the keyword area.
export function pushLine (out, params) {
    const kw = params.keywordText || '';
    if (kw.length <= MAX_KW_WIDTH) {
        out.push(buildLine(params));
        return;
    }

    // `-` continuations preserve leading whitespace on the next line, which
    // matters inside a single-quoted literal that needs to span lines.
    // `+` is the default keyword-wrap; it collapses whitespace.
    const lastToken     = kw.split(/\s+/).pop() ?? '';
    const isLiteralWrap = kw.startsWith("'") || /'[^']*$/.test(lastToken);
    const cont          = isLiteralWrap ? '-' : '+';

    let remaining = kw;
    let first     = true;
    while (remaining.length > MAX_KW_WIDTH) {
        const room = MAX_KW_WIDTH - 1;
        // For `+` we prefer breaking on whitespace (between keyword args).
        // For `-` we want a hard split at the column so internal spaces
        // inside the literal are preserved.
        let breakIdx = cont === '+' ? remaining.lastIndexOf(' ', room) : room;
        if (breakIdx < 1) breakIdx = room;

        const head = cont === '+'
            ? remaining.substring(0, breakIdx).replace(/\s+$/, '')
            : remaining.substring(0, breakIdx);
        const chunk = head + cont;

        out.push(first
            ? buildLine({ ...params, keywordText: chunk })
            : buildLine({ keywordText: chunk }));
        first = false;

        remaining = cont === '+'
            ? remaining.substring(breakIdx).replace(/^\s+/, '')
            : remaining.substring(breakIdx);
    }
    out.push(first
        ? buildLine({ ...params, keywordText: remaining })
        : buildLine({ keywordText: remaining }));
}

function buildLine ({
    indicators = [],
    nameType = '',
    name = '',
    refFlag = '',
    length = null,
    dataType = '',
    decimals = null,
    usage = '',
    row = null,
    col = null,
    keywordText = '',
}) {
    const lenStr = (length   != null && length   !== '') ? String(length)   : '';
    const decStr = (decimals != null && decimals !== '') ? String(decimals) : '';
    const rowStr = (row      != null && row      !== '') ? String(row)      : '';
    const colStr = (col      != null && col      !== '') ? String(col)      : '';

    let line = '';
    line += '     ';                                            // 1-5   seq
    line += 'A';                                                // 6     type
    line += ' ';                                                // 7     reserved
    line += formatIndicators(indicators);                       // 8-16  inds
    line += (nameType || ' ').slice(0, 1);                      // 17    nameType
    line += ' ';                                                // 18    reserved
    line += (name || '').padEnd(10).substring(0, 10);           // 19-28 name
    line += (refFlag || ' ').slice(0, 1);                       // 29    refFlag
    line += lenStr.padStart(5);                                 // 30-34 length
    line += (dataType || ' ').slice(0, 1);                      // 35    data type
    line += decStr.padStart(2);                                 // 36-37 decimals
    line += (usage || ' ').slice(0, 1);                         // 38    usage
    line += rowStr.padStart(3);                                 // 39-41 row
    line += colStr.padStart(3);                                 // 42-44 col
    line += keywordText;                                        // 45+   keyword

    return line.replace(/\s+$/, '');
}

function formatIndicators (indicators) {
    const slots = [indicators[0] ?? '', indicators[1] ?? '', indicators[2] ?? ''];
    return slots.map(tok => {
        if (!tok) return '   ';
        const isN = tok.startsWith('N');
        const num = (isN ? tok.substring(1) : tok).padStart(2, '0').slice(-2);
        return (isN ? 'N' : ' ') + num;
    }).join('');
}

export function formatKeyword (kw) {
    if (!kw || !kw.name) return '';
    if (!kw.args || kw.args.length === 0) return kw.name;
    return `${kw.name}(${kw.args.join(' ')})`;
}
