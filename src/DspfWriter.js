// DSPF (display file) source writer.  Emits 80-column fixed-format
// source consistent with what the parser expects to read back.
//
// Conventions:
//   - The record type-defining keyword (SFL, SFLCTL, MNUBAR, PULLDOWN,
//     WINDOW) is emitted on the same line as the R name when present.
//   - All other keywords go on continuation lines below their owner.
//   - Constants emit their text on the row/col line; trailing keywords
//     (COLOR, DSPATR) follow on continuation lines.
//   - Sysvalues (DATE / TIME / USER / SYSNAME / ...) emit the bare
//     keyword name in the function area on the row/col line.
//   - Keyword text longer than 36 chars (the function area is cols 45-80)
//     is split with '+' continuations so no source line exceeds 80 cols.

const TYPE_KEYWORDS = new Set(['SFL', 'SFLCTL', 'MNUBAR', 'PULLDOWN', 'WINDOW']);
const MAX_KW_WIDTH  = 36;          // cols 45..80 inclusive

export function writeDspf (doc) {
    return writeDspfWithMap(doc).text;
}

/** Same output as writeDspf but also returns a per-record / per-item line
 *  range map so the UI can jump between source lines and canvas items.
 *  Line numbers are 1-indexed inclusive: an item that occupies lines 12-14
 *  shows up as { first: 12, last: 14 }. */
export function writeDspfWithMap (doc) {
    const lines = [];
    const map = { records: [], items: [] };
    for (let i = 0; i < doc.records.length; i++) {
        if (i > 0) lines.push('');
        const first = lines.length + 1;     // first comment line of this record
        pushRecordHeader(doc.records[i], lines);
        writeRecord(doc.records[i], lines, map);
        if (lines.length >= first) {
            map.records.push({
                idx: i,
                name: doc.records[i].name,
                first,
                last: lines.length,
            });
        }
    }
    return { text: lines.join('\n') + '\n', map };
}

/** Emit a 3-line `A*` box-comment block announcing the record's name and
 *  type, like SEU/SDA-era separator headers but a touch cleaner.  Layout
 *  (1-indexed columns):
 *    1-5  : sequence (spaces)
 *    6    : 'A'
 *    7-80 : 74 '*' chars for the borders, OR
 *           '*' + ' ' + 70-char text + ' ' + '*' for the middle row
 *  The parser drops `A*` lines so these survive only as design-time
 *  chrome; the writer regenerates them fresh on every save. */
function pushRecordHeader (rec, out) {
    // 80-column layout (1-indexed):
    //   1-5  : sequence (spaces)
    //   6    : 'A'                              (form-type)
    //   7    : '*'                              (comment marker + left border)
    //   8    : ' '                              (gap)
    //   9-78 : title text, padded to 70 chars
    //   79   : ' '                              (gap)
    //   80   : '*'                              (right border)
    const border = '     A' + '*'.repeat(74);                       // 80 chars
    const title  = `${rec.name}  ·  ${rec.type}`.padEnd(70);
    const middle = '     A* ' + title + ' *';                       // 80 chars
    out.push(border);
    out.push(middle);
    out.push(border);
}

function writeRecord (rec, out, map) {
    let typeKw = null;
    const restKws = [];
    for (const kw of rec.keywords) {
        if (!typeKw && kw.name === rec.type && TYPE_KEYWORDS.has(rec.type)) {
            typeKw = kw;
        } else {
            restKws.push(kw);
        }
    }
    if (!typeKw && TYPE_KEYWORDS.has(rec.type)) {
        typeKw = { name: rec.type, args: [], indicators: [] };
    }

    pushLine(out, {
        nameType: 'R',
        name: rec.name,
        keywordText: typeKw ? formatKeyword(typeKw) : '',
        indicators: typeKw?.indicators ?? [],
    });
    for (const kw of restKws) {
        pushLine(out, {
            keywordText: formatKeyword(kw),
            indicators: kw.indicators,
        });
    }
    for (const item of rec.items) writeItem(item, out, map);
}

function writeItem (item, out, map) {
    const first = out.length + 1;
    if (item.kind === 'constant') {
        const text = `'${(item.text ?? '').replace(/'/g, "''")}'`;
        pushLine(out, {
            row: item.row, col: item.col,
            keywordText: text,
            indicators: item.indicators ?? [],
        });
        for (const kw of item.keywords ?? []) {
            pushLine(out, {
                keywordText: formatKeyword(kw),
                indicators: kw.indicators,
            });
        }
    } else if (item.kind === 'sysvalue') {
        const headIdx = (item.keywords ?? []).findIndex(kw => kw.name === item.sysName);
        const head = headIdx >= 0 ? item.keywords[headIdx]
                                  : { name: item.sysName || 'DATE', args: [], indicators: [] };
        const rest = (item.keywords ?? []).filter((_, i) => i !== headIdx);
        pushLine(out, {
            row: item.row, col: item.col,
            keywordText: formatKeyword(head),
            indicators: item.indicators ?? [],
        });
        for (const kw of rest) {
            pushLine(out, {
                keywordText: formatKeyword(kw),
                indicators: kw.indicators,
            });
        }
    } else {
        // Field.  Hidden fields (usage 'H') are positionless at runtime, so
        // we elide row/col on emit to round-trip with the typical DSPF
        // convention.
        const hidden = item.usage === 'H';
        pushLine(out, {
            name: item.name,
            refFlag: item.refField ? 'R' : '',
            length: item.length,
            dataType: item.dataType,
            decimals: item.decimals,
            usage: item.usage,
            row: hidden ? null : item.row,
            col: hidden ? null : item.col,
            indicators: item.indicators ?? [],
        });
        for (const kw of item.keywords ?? []) {
            pushLine(out, {
                keywordText: formatKeyword(kw),
                indicators: kw.indicators,
            });
        }
    }
    if (map && out.length >= first) {
        map.items.push({ id: item.id, first, last: out.length });
    }
}

/** Emit a line, wrapping the keyword text with '+' continuations when it
 *  exceeds the 36-char keyword area (cols 45-80).  Subsequent lines drop
 *  the per-field metadata - only the keyword area + leading 'A' marker. */
function pushLine (out, params) {
    const kw = params.keywordText || '';
    if (kw.length <= MAX_KW_WIDTH) {
        out.push(buildLine(params));
        return;
    }
    // Pick the continuation marker.  `-` preserves the next line's leading
    // whitespace, which matters when the wrapped text is the inside of a
    // single quoted literal (long constants).  `+` collapses whitespace
    // and is the default for keyword wrapping.
    const isLiteralWrap = kw.startsWith("'") || /'[^']*$/.test(kw.split(/\s+/).pop() ?? '');
    const cont = isLiteralWrap ? '-' : '+';

    let remaining = kw;
    let first = true;
    while (remaining.length > MAX_KW_WIDTH) {
        const room = MAX_KW_WIDTH - 1;
        // For `+` we prefer breaking on a space (keyword args).  For `-`
        // we want a hard split exactly at the column so internal spaces
        // are preserved.
        let breakIdx = cont === '+' ? remaining.lastIndexOf(' ', room) : room;
        if (breakIdx < 1) breakIdx = room;
        const head = cont === '+'
            ? remaining.substring(0, breakIdx).replace(/\s+$/, '')
            : remaining.substring(0, breakIdx);
        const chunk = head + cont;
        if (first) {
            out.push(buildLine({ ...params, keywordText: chunk }));
            first = false;
        } else {
            out.push(buildLine({ keywordText: chunk }));
        }
        remaining = cont === '+'
            ? remaining.substring(breakIdx).replace(/^\s+/, '')
            : remaining.substring(breakIdx);
    }
    if (first) out.push(buildLine({ ...params, keywordText: remaining }));
    else       out.push(buildLine({ keywordText: remaining }));
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
    line += '     ';                                            // 1-5  seq
    line += 'A';                                                // 6    type
    line += ' ';                                                // 7    reserved
    line += formatIndicators(indicators);                       // 8-16 inds
    line += (nameType || ' ').slice(0, 1);                      // 17   nameType
    line += ' ';                                                // 18   reserved
    line += (name || '').padEnd(10).substring(0, 10);           // 19-28 name
    line += (refFlag || ' ').slice(0, 1);                       // 29   refFlag
    line += lenStr.padStart(5);                                 // 30-34 length
    line += (dataType || ' ').slice(0, 1);                      // 35   data type
    line += decStr.padStart(2);                                 // 36-37 decimals
    line += (usage || ' ').slice(0, 1);                         // 38   usage
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

function formatKeyword (kw) {
    if (!kw || !kw.name) return '';
    if (!kw.args || kw.args.length === 0) return kw.name;
    return `${kw.name}(${kw.args.join(' ')})`;
}
