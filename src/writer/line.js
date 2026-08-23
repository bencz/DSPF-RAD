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
        let breakIdx = cont === '+' ? remaining.lastIndexOf(' ', room - 1) : room;
        const brokeAtSeparator = cont === '+' && breakIdx >= 1;
        if (breakIdx < 1) breakIdx = room;

        const head = cont === '+'
            ? remaining.substring(0, breakIdx).replace(/\s+$/, '')
            : remaining.substring(0, breakIdx);
        // DDS '+' joins the continuation directly to the previous text.
        // When we wrap at whitespace, retain one separator before '+' so
        // token boundaries survive parse → write → parse.  A hard split of
        // one long token intentionally has no separator.
        const chunk = head + (brokeAtSeparator ? ' +' : cont);

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
    conditionOp = '',
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
    const lenStr = fixedNumber(length,   5, 1, 'field length');
    const decStr = fixedNumber(decimals, 2, 0, 'decimal positions');
    const rowStr = fixedNumber(row,      3, 1, 'row');
    const colStr = fixedNumber(col,      3, 1, 'column');

    let line = '';
    line += '     ';                                            // 1-5   seq
    line += 'A';                                                // 6     type
    line += /^[AO]$/.test(conditionOp) ? conditionOp : ' ';     // 7     AND/OR
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

function fixedNumber (value, width, minimum, label) {
    if (value == null || value === '') return '';
    const number = Number(value);
    const maximum = (10 ** width) - 1;
    if (!Number.isInteger(number) || number < minimum || number > maximum) {
        throw new Error(`Invalid DDS ${label}: ${value}`);
    }
    return String(number);
}

function formatIndicators (indicators) {
    if ((indicators?.length ?? 0) > 3) {
        throw new Error(
            'A DDS source line supports at most three indicator conditions');
    }
    if (indicators.length === 1 && String(indicators[0]).startsWith('*')) {
        const name = String(indicators[0]).toUpperCase();
        if (!/^\*[A-Z0-9_$#@]{1,7}$/.test(name)) {
            throw new Error(`Invalid DDS display-size condition name: ${name}`);
        }
        return name.padEnd(9);
    }
    const slots = [indicators[0] ?? '', indicators[1] ?? '', indicators[2] ?? ''];
    return slots.map(tok => {
        if (!tok) return '   ';
        const raw = String(tok).toUpperCase();
        const match = /^(N?)(\d{1,2})$/.exec(raw);
        const value = match ? parseInt(match[2], 10) : NaN;
        if (!match || value < 1 || value > 99) {
            throw new Error(`Invalid DDS indicator condition: ${tok}`);
        }
        const isN = match[1] === 'N';
        const num = String(value).padStart(2, '0');
        return (isN ? 'N' : ' ') + num;
    }).join('');
}

export function formatKeyword (kw) {
    if (!kw || !kw.name) return '';
    if (!kw.args || kw.args.length === 0) return kw.name;
    return `${kw.name}(${kw.args.join(' ')})`;
}
