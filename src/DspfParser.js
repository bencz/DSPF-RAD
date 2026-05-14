// DSPF (display file) source parser.
//
// Tolerant by design: real-world DSPF source can lack the leading 'A'
// at column 6 (some tools strip it), can mix tabs into the prefix, and
// uses keyword continuations via '+' / '-' at the end of the keyword
// area.  We accept all of those.
//
// Column layout we parse (1-indexed):
//   1-5   sequence (ignored)
//   6     form type 'A' (or blank in lenient mode)
//   7     reserved
//   8-16  three conditioning indicators, 3 chars each
//   17    name type ('R' for record, blank for field/constant)
//   18    reserved
//   19-28 name (10 chars)
//   29    reference flag ('R' for REFFLD-style)
//   30-34 length
//   35    data type (A, S, P, Y, ...)
//   36-37 decimals
//   38    usage (I, O, B, H, M, P)
//   39-41 row
//   42-44 col
//   45-80 keyword text

import { DspfDocument, makeRecord, makeItem } from './DspfModel.js';
import { normalize as kwNormalize } from './Keywords.js';

const TYPE_KEYWORDS = new Set(['SFL', 'SFLCTL', 'MNUBAR', 'PULLDOWN', 'WINDOW']);
const SYSVALUE_NAMES = new Set([
    'DATE', 'TIME', 'USER', 'SYSNAME', 'USRNAME',
    'DATEUSA', 'TIMEUSA', 'EUROPE', 'JOBNAME', 'NETID',
]);

export function parseDspf (source) {
    const merged = filterAndMergeLines(source.split(/\r?\n/));

    const doc = new DspfDocument();
    doc.records = [];
    let curRecord = null;
    let curTarget = null;            // record OR item; "most recent thing"
    const pendingDocKw = [];         // keywords seen before any record

    // Tracking for "+N" relative positions in row/col.  Per IBM DSPF:
    //   row "+N" = previous line + N
    //   col "+N" = end of previous item + N
    let lastRow = 1, lastEndCol = 1;

    for (const line of merged) {
        const p = parseSourceLine(line);

        // Resolve relative row/col against the last placed item.
        const rowSpec = parseRelativeNum(p.rowRaw);
        const colSpec = parseRelativeNum(p.colRaw);
        if (rowSpec.kind === 'absolute') p.row = rowSpec.value;
        else if (rowSpec.kind === 'relative') p.row = lastRow + rowSpec.offset;
        else p.row = null;
        if (colSpec.kind === 'absolute') p.col = colSpec.value;
        else if (colSpec.kind === 'relative') p.col = lastEndCol + colSpec.offset;
        else p.col = null;

        // --- Record line (name type 'R') ---
        if (p.nameType === 'R') {
            const kws = tokenizeKeywords(p.keywordText);
            let type = 'RECORD';
            for (const kw of kws) {
                if (TYPE_KEYWORDS.has(kw.name)) { type = kw.name; break; }
            }
            curRecord = makeRecord({ name: p.name || `R${doc.records.length + 1}`, type });
            doc.records.push(curRecord);
            curTarget = curRecord;
            if (pendingDocKw.length) {
                curRecord.keywords.unshift(...pendingDocKw.splice(0));
            }
            for (const kw of kws) {
                curRecord.keywords.push(kwNormalize({
                    name: kw.name, args: kw.args, indicators: p.indicators,
                }));
            }
            continue;
        }

        // --- Named field ---
        if (p.name) {
            if (!curRecord) {
                curRecord = makeRecord({ name: 'NONAME', type: 'RECORD' });
                doc.records.push(curRecord);
            }
            // REFFLD fields commonly omit length/type because the
            // referenced PF supplies them at compile time.  We can't
            // resolve the PF here, so we fall back to a 10-char
            // placeholder so the field has a visible footprint.
            const isRef = p.refFlag === 'R';
            const inferredLen = isRef && p.length == null;
            const item = makeItem({
                kind: 'field',
                row: p.row || 1, col: p.col || 1,
                name: p.name,
                length: p.length ?? (isRef ? 10 : 1),
                decimals: p.decimals ?? 0,
                dataType: p.dataType || 'A',
                usage: p.usage || 'B',
                indicators: p.indicators ?? [],
            });
            if (isRef)        item.refField        = true;
            if (inferredLen)  item._lengthInferred = true;   // for renderer clamp
            curRecord.items.push(item);
            curTarget = item;
            for (const kw of tokenizeKeywords(p.keywordText)) {
                item.keywords.push(kwNormalize({
                    name: kw.name, args: kw.args, indicators: p.indicators,
                }));
            }
            // Update relative-position cursor.
            if (p.row != null) lastRow    = item.row;
            if (p.col != null) lastEndCol = item.col + (item.length || 1);
            continue;
        }

        // --- Constant or sysvalue (row+col, no name) ---
        if (p.row || p.col) {
            if (!curRecord) {
                curRecord = makeRecord({ name: 'NONAME', type: 'RECORD' });
                doc.records.push(curRecord);
            }
            const kwText = p.keywordText.trim();
            if (kwText.startsWith("'")) {
                const { text, rest } = readQuotedString(kwText);
                const item = makeItem({
                    kind: 'constant',
                    row: p.row || 1, col: p.col || 1,
                    text,
                    indicators: p.indicators ?? [],
                });
                curRecord.items.push(item);
                curTarget = item;
                if (rest.trim()) {
                    for (const kw of tokenizeKeywords(rest)) {
                        item.keywords.push(kwNormalize({
                            name: kw.name, args: kw.args, indicators: p.indicators,
                        }));
                    }
                }
            } else if (kwText) {
                const kws = tokenizeKeywords(kwText);
                if (!kws.length) continue;
                const head = kws[0];
                const isSys = SYSVALUE_NAMES.has(head.name);
                const item = makeItem({
                    kind: isSys ? 'sysvalue' : 'constant',
                    row: p.row || 1, col: p.col || 1,
                    sysName: isSys ? head.name : undefined,
                    text: isSys ? '' : head.name,
                    indicators: p.indicators ?? [],
                });
                curRecord.items.push(item);
                curTarget = item;
                // First token is the sysvalue marker; keep it as a keyword
                // too so the writer can round-trip cleanly.
                item.keywords.push(kwNormalize({
                    name: head.name, args: head.args, indicators: p.indicators,
                }));
                for (let i = 1; i < kws.length; i++) {
                    item.keywords.push(kwNormalize({
                        name: kws[i].name, args: kws[i].args, indicators: p.indicators,
                    }));
                }
            }
            // Update relative-position cursor for whichever item we just
            // pushed (constant text length or sysvalue placeholder).
            const placed = curRecord.items[curRecord.items.length - 1];
            if (placed && p.row != null) {
                lastRow = placed.row;
                const w = placed.kind === 'constant'
                    ? (placed.text ?? '').length
                    : (placed.length || (placed.sysName ?? '').length || 1);
                lastEndCol = placed.col + Math.max(1, w);
            }
            continue;
        }

        // --- Continuation: keyword text on its own ---
        if (p.keywordText.trim()) {
            const target = curTarget ?? curRecord;
            const kws = tokenizeKeywords(p.keywordText);
            if (!target) {
                for (const kw of kws) {
                    pendingDocKw.push(kwNormalize({
                        name: kw.name, args: kw.args, indicators: p.indicators,
                    }));
                }
                continue;
            }
            for (const kw of kws) {
                target.keywords.push(kwNormalize({
                    name: kw.name, args: kw.args, indicators: p.indicators,
                }));
                // If a record gains a SFL/SFLCTL/etc. keyword on a
                // continuation line, promote its type retroactively.
                if (target === curRecord && TYPE_KEYWORDS.has(kw.name) && curRecord.type === 'RECORD') {
                    curRecord.type = kw.name;
                }
            }
        }
    }

    if (!doc.records.length) {
        doc.records = [makeRecord({ name: 'MAIN' })];
    }
    if (pendingDocKw.length) {
        doc.records[0].keywords.unshift(...pendingDocKw);
    }
    doc.activeRecordIndex = 0;
    return doc;
}

// ---------------------------------------------------------------- helpers

function filterAndMergeLines (rawLines) {
    // 1) Strip blank / comment / metadata lines.  Real DSPF source can
    //    have lines starting with M* (maintenance history), X* (custom
    //    tooling), A* (compiler timestamps) and blank lines - none of
    //    which carry DSPF content.  Accept col 6 = 'A' (strict) or blank
    //    (free-format some IDEs produce); reject any other letter.
    const kept = [];
    for (const raw of rawLines) {
        const padded = raw.replace(/\t/g, ' ').padEnd(80).substring(0, 80);
        const c6 = padded[5];
        if (c6 !== 'A' && c6 !== ' ') continue;             // M*, X*, ...
        if (c6 === 'A' && padded[6] === '*') continue;      // A*-metadata
        if (padded.trimStart().startsWith('*')) continue;   // pure comment
        if (padded.trim() === '') continue;
        kept.push(padded);
    }

    // 2) Merge `+` / `-` continuations on the keyword area.
    //    `+` joins with the next line's leading whitespace stripped
    //    (typical for keyword wrapping), `-` preserves the next line's
    //    cols 45+ verbatim (used inside literal string constants where
    //    internal spacing matters).
    const out = [];
    for (let i = 0; i < kept.length; ) {
        const prefix = kept[i].substring(0, 44);
        let kwArea = kept[i].substring(44).trimEnd();
        let j = i + 1;
        while (kwArea.endsWith('+') || kwArea.endsWith('-')) {
            const cont = kwArea[kwArea.length - 1];
            const raw  = (kept[j] ?? '').substring(44).trimEnd();
            const trailer = cont === '+' ? raw.trimStart() : raw;
            if (j > kept.length) break;
            kwArea = kwArea.slice(0, -1) + trailer;
            j++;
            if (trailer === '' && j > kept.length) break;
        }
        out.push(prefix + kwArea);
        i = Math.max(j, i + 1);
    }
    return out;
}

function parseSourceLine (line) {
    // Pad short lines so the fixed-column slicing never reads `undefined`,
    // but don't truncate: merged continuation lines (joined by '+') are
    // legitimately longer than 80 cols here and we want the full keyword
    // text past col 45.
    const padded = line.length < 80 ? line.padEnd(80) : line;
    const indicators = [
        parseIndChunk(padded.substring(7, 10)),
        parseIndChunk(padded.substring(10, 13)),
        parseIndChunk(padded.substring(13, 16)),
    ].filter(Boolean);

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
        indicators,
        nameType, name, refFlag,
        length:   lengthS ? parseInt(lengthS, 10)   : null,
        dataType, decimals: decimalsS ? parseInt(decimalsS, 10) : null,
        usage,
        // Numeric defaults for back-compat; main loop will overwrite with
        // a relative-aware resolution using rowRaw / colRaw.
        row: rowS ? parseInt(rowS, 10) : null,
        col: colS ? parseInt(colS, 10) : null,
        rowRaw: rowS, colRaw: colS,
        keywordText: keyword,
    };
}

/** Parse a row / column field which may be empty, an absolute number, or
 *  an IBM "+N" relative offset.  When relative, `+nn` lives in cols 1+2
 *  of the field with the offset (possibly space-padded) in cols 2-3. */
function parseRelativeNum (s) {
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

function readQuotedString (s) {
    // s starts with a single quote.  Returns { text, rest } where text has
    // embedded '' un-escaped to a single quote and rest is what follows the
    // closing quote (may contain trailing keywords like COLOR(BLU)).
    let i = 1;
    let out = '';
    while (i < s.length) {
        const c = s[i];
        if (c === "'") {
            if (s[i + 1] === "'") { out += "'"; i += 2; continue; }
            return { text: out, rest: s.substring(i + 1) };
        }
        out += c;
        i++;
    }
    return { text: out, rest: '' };  // unterminated
}

// Tokenise a keyword text into [{ name, args }, ...].  args preserves
// embedded quoted strings verbatim, with surrounding quotes kept.  Args
// are space-separated at depth 1 inside the outer parentheses.
function tokenizeKeywords (text) {
    const out = [];
    let i = 0;
    const n = text.length;
    while (i < n) {
        while (i < n && /\s/.test(text[i])) i++;
        if (i >= n) break;
        // Token boundary: not an alpha-digit means we skip.
        if (!/[A-Za-z]/.test(text[i])) { i++; continue; }
        let name = '';
        while (i < n && /[A-Za-z0-9_]/.test(text[i])) name += text[i++];
        const args = [];
        if (text[i] === '(') {
            i++;
            let depth = 1;
            let arg = '';
            let inQuote = false;
            while (i < n && depth > 0) {
                const c = text[i];
                if (inQuote) {
                    arg += c;
                    if (c === "'") {
                        if (text[i + 1] === "'") { arg += text[++i]; }
                        else inQuote = false;
                    }
                    i++;
                } else if (c === "'") {
                    arg += c; inQuote = true; i++;
                } else if (c === '(') {
                    depth++; arg += c; i++;
                } else if (c === ')') {
                    depth--;
                    if (depth === 0) { i++; break; }
                    arg += c; i++;
                } else if (/\s/.test(c) && depth === 1) {
                    if (arg) { args.push(arg); arg = ''; }
                    i++;
                } else {
                    arg += c; i++;
                }
            }
            if (arg) args.push(arg);
        }
        out.push({ name: name.toUpperCase(), args });
    }
    return out;
}
