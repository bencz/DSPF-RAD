// DSPF source writer.  Emits 80-col fixed-format consistent with what the
// parser reads back.
//
// Conventions:
//   - The record type-defining keyword (SFL, SFLCTL, MNUBAR, PULLDOWN,
//     WINDOW) sits on the same line as the R name when present.
//   - All other keywords go on continuation lines below their owner.
//   - Constants emit their text on the row/col line; trailing keywords
//     (COLOR, DSPATR) follow on continuation lines.
//   - Sysvalues emit the bare keyword name on the row/col line.
//   - Keyword text > 36 chars wraps with '+' continuations.

import { pushLine, formatKeyword } from './line.js';
import { pushRecordHeader }        from './header.js';

const TYPE_KEYWORDS = new Set(['SFL', 'SFLCTL', 'MNUBAR', 'PULLDOWN', 'WINDOW']);

export function writeDspf (doc) {
    return writeDspfWithMap(doc).text;
}

// Same output as writeDspf plus a per-record / per-item line-range map.
// The cursor↔item link in the UI uses it to jump between source lines and
// canvas items.  Lines are 1-indexed inclusive: { first: 12, last: 14 }.
export function writeDspfWithMap (doc) {
    const lines = [];
    const map   = { records: [], items: [] };

    for (let i = 0; i < doc.records.length; i++) {
        if (i > 0) lines.push('');
        const first = lines.length + 1;
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

function writeRecord (rec, out, map) {
    const { typeKw, restKws } = splitTypeKeyword(rec);

    pushLine(out, {
        nameType:    'R',
        name:        rec.name,
        keywordText: typeKw ? formatKeyword(typeKw) : '',
        indicators:  typeKw?.indicators ?? [],
    });
    for (const kw of restKws) {
        pushLine(out, {
            keywordText: formatKeyword(kw),
            indicators:  kw.indicators,
        });
    }
    for (const item of rec.items) writeItem(item, out, map);
}

// Pull the keyword that names the record type (SFL, WINDOW, …) to the
// front so it lands on the R-line.  If the user set a typed record but
// didn't add the keyword explicitly, we synthesise one.
function splitTypeKeyword (rec) {
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
    return { typeKw, restKws };
}

function writeItem (item, out, map) {
    const first = out.length + 1;

    if (item.kind === 'constant')      writeConstant(item, out);
    else if (item.kind === 'sysvalue') writeSysvalue(item, out);
    else                                writeField(item, out);

    if (map && out.length >= first) {
        map.items.push({ id: item.id, first, last: out.length });
    }
}

function writeConstant (item, out) {
    const text = `'${(item.text ?? '').replace(/'/g, "''")}'`;
    pushLine(out, {
        row: item.row, col: item.col,
        keywordText: text,
        indicators:  item.indicators ?? [],
    });
    for (const kw of item.keywords ?? []) {
        pushLine(out, {
            keywordText: formatKeyword(kw),
            indicators:  kw.indicators,
        });
    }
}

function writeSysvalue (item, out) {
    const kws     = item.keywords ?? [];
    const headIdx = kws.findIndex(kw => kw.name === item.sysName);
    const head    = headIdx >= 0
        ? kws[headIdx]
        : { name: item.sysName || 'DATE', args: [], indicators: [] };
    const rest = kws.filter((_, i) => i !== headIdx);

    pushLine(out, {
        row: item.row, col: item.col,
        keywordText: formatKeyword(head),
        indicators:  item.indicators ?? [],
    });
    for (const kw of rest) {
        pushLine(out, {
            keywordText: formatKeyword(kw),
            indicators:  kw.indicators,
        });
    }
}

function writeField (item, out) {
    // Hidden fields (usage 'H') are positionless at runtime; elide row/col
    // on emit so we round-trip with the typical DSPF convention.
    const hidden = item.usage === 'H';
    pushLine(out, {
        name:       item.name,
        refFlag:    item.refField ? 'R' : '',
        length:     item.length,
        dataType:   item.dataType,
        decimals:   item.decimals,
        usage:      item.usage,
        row:        hidden ? null : item.row,
        col:        hidden ? null : item.col,
        indicators: item.indicators ?? [],
    });
    for (const kw of item.keywords ?? []) {
        pushLine(out, {
            keywordText: formatKeyword(kw),
            indicators:  kw.indicators,
        });
    }
}
