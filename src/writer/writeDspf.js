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
const DISPLAY_DATA_TYPES = new Set([
    'A', 'S', 'Y', 'N', 'I', 'D', 'X', 'F', 'M', 'L', 'T', 'Z',
    'W', 'E', 'J', 'O', 'G',
]);
const DISPLAY_USAGES = new Set(['I', 'O', 'B', 'H', 'P', 'M']);

export function writeDspf (doc) {
    return writeDspfWithMap(doc).text;
}

// Same output as writeDspf plus a per-record / per-item line-range map.
// The cursor↔item link in the UI uses it to jump between source lines and
// canvas items.  Lines are 1-indexed inclusive: { first: 12, last: 14 }.
export function writeDspfWithMap (doc) {
    const lines = [];
    const map   = { records: [], items: [] };

    const fileKeywords = doc.records.flatMap(record =>
        (record.keywords ?? []).filter(kw => kw.scope === 'file'));
    for (const kw of fileKeywords) {
        writeConditionPrefix(kw, lines);
        pushLine(lines, {
            keywordText: formatKeyword(kw),
            indicators: kw.indicators,
            conditionOp: kw.conditionOp,
        });
    }
    if (fileKeywords.length && doc.records.length) lines.push('');

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

    if (typeKw) writeConditionPrefix(typeKw, out);
    pushLine(out, {
        nameType:    'R',
        name:        rec.name,
        keywordText: typeKw ? formatKeyword(typeKw) : '',
        indicators:  typeKw?.indicators ?? [],
        conditionOp: typeKw?.conditionOp ?? '',
    });
    for (const kw of restKws) {
        writeConditionPrefix(kw, out);
        pushLine(out, {
            keywordText: formatKeyword(kw),
            indicators:  kw.indicators,
            conditionOp: kw.conditionOp,
        });
    }
    for (const spec of rec.helpSpecs ?? []) writeHelpSpec(spec, out);
    for (const item of rec.items) writeItem(item, out, map);
}

function writeHelpSpec (spec, out) {
    const keywords = spec.keywords ?? [];
    for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        writeConditionPrefix(kw, out);
        pushLine(out, {
            nameType: i === 0 ? 'H' : '',
            keywordText: formatKeyword(kw),
            indicators: kw.indicators,
            conditionOp: kw.conditionOp,
        });
    }
}

// Pull the keyword that names the record type (SFL, WINDOW, …) to the
// front so it lands on the R-line.  If the user set a typed record but
// didn't add the keyword explicitly, we synthesise one.
function splitTypeKeyword (rec) {
    let typeKw = null;
    const restKws = [];
    for (const kw of rec.keywords) {
        if (kw.scope === 'file') continue;
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
    writeConditionPrefix(item, out);
    pushLine(out, {
        row: item.row, col: item.col,
        keywordText: text,
        indicators:  item.indicators ?? [],
        conditionOp: item.conditionOp,
    });
    writeAlternateLocations(item, out);
    for (const kw of item.keywords ?? []) {
        writeConditionPrefix(kw, out);
        pushLine(out, {
            keywordText: formatKeyword(kw),
            indicators:  kw.indicators,
            conditionOp: kw.conditionOp,
        });
    }
}

function writeSysvalue (item, out) {
    const kws     = item.keywords ?? [];
    const namedHeadIdx = kws.findIndex(kw => kw.name === item.sysName);
    const headIdx = namedHeadIdx >= 0 ? namedHeadIdx : (kws.length ? 0 : -1);
    const head    = headIdx >= 0
        ? kws[headIdx]
        : (kws[0] ?? { name: item.sysName || 'DATE', args: [], indicators: [] });
    const rest = kws.filter((_, i) => i !== headIdx);

    writeConditionPrefix(item, out);
    pushLine(out, {
        row: item.row, col: item.col,
        keywordText: formatKeyword(head),
        indicators:  item.indicators ?? [],
        conditionOp: item.conditionOp,
    });
    writeAlternateLocations(item, out);
    for (const kw of rest) {
        writeConditionPrefix(kw, out);
        pushLine(out, {
            keywordText: formatKeyword(kw),
            indicators:  kw.indicators,
            conditionOp: kw.conditionOp,
        });
    }
}

function writeField (item, out) {
    // Hidden, program-to-system and message fields are positionless.
    const positionless = ['H', 'P', 'M'].includes(item.usage);
    // A REFFLD definition can inherit length/type from the referenced file.
    // The canvas keeps a display placeholder, but the writer must not turn
    // that placeholder into an explicit DDS override.
    const inherited = item.refField && item._lengthInferred;
    if (!inherited && !DISPLAY_DATA_TYPES.has(String(item.dataType).toUpperCase())) {
        throw new Error(`Invalid display-file data type ${item.dataType} on ${item.name}`);
    }
    if (!DISPLAY_USAGES.has(String(item.usage).toUpperCase())) {
        throw new Error(`Invalid display-file usage ${item.usage} on ${item.name}`);
    }
    writeConditionPrefix(item, out);
    pushLine(out, {
        name:       item.name,
        refFlag:    item.refField ? 'R' : '',
        length:     inherited ? null : item.length,
        dataType:   inherited ? '' : item.dataType,
        decimals:   inherited
            ? null
            : (decimalCapable(item.dataType) ? item.decimals : null),
        usage:      item.usage,
        row:        positionless ? null : item.row,
        col:        positionless ? null : item.col,
        indicators: item.indicators ?? [],
        conditionOp: item.conditionOp,
    });
    writeAlternateLocations(item, out);
    for (const kw of item.keywords ?? []) {
        writeConditionPrefix(kw, out);
        pushLine(out, {
            keywordText: formatKeyword(kw),
            indicators:  kw.indicators,
            conditionOp: kw.conditionOp,
        });
    }
}

function writeAlternateLocations (item, out) {
    for (const location of item.alternateLocations ?? []) {
        pushLine(out, {
            indicators: [location.conditionName],
            row: location.row,
            col: location.col,
        });
    }
}

function writeConditionPrefix (target, out) {
    for (const line of target.conditionLines ?? []) {
        pushLine(out, {
            conditionOp: line.conditionOp,
            indicators: line.indicators ?? [],
        });
    }
}

function decimalCapable (dataType) {
    return ['S', 'Y', 'F'].includes(String(dataType).toUpperCase());
}
