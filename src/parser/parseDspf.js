// DSPF (display file) source parser.
//
// Tolerant by design: real-world DSPF can lack the leading 'A' at col 6
// (some tools strip it), mix tabs into the prefix, and uses keyword
// continuations via '+' / '-' at the end of the keyword area.  All
// accepted — the lenient layer lives in ./lineFilter.js.

import { DspfDocument, makeRecord, makeItem } from '../model/index.js';
import { normalize as kwNormalize } from '../model/keywords.js';
import { filterAndMergeLines } from './lineFilter.js';
import { parseSourceLine, parseRelativeNum } from './lineFields.js';
import { tokenizeKeywords, readQuotedString } from './tokenizer.js';

const TYPE_KEYWORDS = new Set(['SFL', 'SFLCTL', 'MNUBAR', 'PULLDOWN', 'WINDOW']);

const SYSVALUE_NAMES = new Set([
    'DATE', 'TIME', 'USER', 'SYSNAME', 'USRNAME',
    'DATEUSA', 'TIMEUSA', 'EUROPE', 'JOBNAME', 'NETID',
]);

export function parseDspf (source) {
    const merged = filterAndMergeLines(source.split(/\r?\n/));

    const doc = new DspfDocument();
    doc.records = [];

    const state = {
        curRecord:     null,
        curTarget:     null,       // record OR item; "most recent thing"
        pendingDocKw:  [],         // keywords seen before any record
        // For "+N" relative row/col resolution:
        //   row "+N" = previous line + N
        //   col "+N" = end of previous item + N
        lastRow:    1,
        lastEndCol: 1,
    };

    for (const line of merged) {
        const p = parseSourceLine(line);
        resolveRowColIn(p, state);

        if (p.nameType === 'R')        handleRecordLine(p, state, doc);
        else if (p.name)               handleNamedField(p, state, doc);
        else if (p.row || p.col)       handlePositionedItem(p, state, doc);
        else if (p.keywordText.trim()) handleContinuation(p, state);
    }

    if (!doc.records.length) {
        doc.records = [makeRecord({ name: 'MAIN' })];
    }
    if (state.pendingDocKw.length) {
        doc.records[0].keywords.unshift(...state.pendingDocKw);
    }
    doc.activeRecordIndex = 0;
    return doc;
}

// ---- per-line handlers ----------------------------------------------------

function resolveRowColIn (p, state) {
    const rowSpec = parseRelativeNum(p.rowRaw);
    const colSpec = parseRelativeNum(p.colRaw);
    if      (rowSpec.kind === 'absolute') p.row = rowSpec.value;
    else if (rowSpec.kind === 'relative') p.row = state.lastRow + rowSpec.offset;
    else                                   p.row = null;
    if      (colSpec.kind === 'absolute') p.col = colSpec.value;
    else if (colSpec.kind === 'relative') p.col = state.lastEndCol + colSpec.offset;
    else                                   p.col = null;
}

function handleRecordLine (p, state, doc) {
    const kws = tokenizeKeywords(p.keywordText);
    let type = 'RECORD';
    for (const kw of kws) {
        if (TYPE_KEYWORDS.has(kw.name)) { type = kw.name; break; }
    }
    const rec = makeRecord({
        name: p.name || `R${doc.records.length + 1}`,
        type,
    });
    doc.records.push(rec);
    state.curRecord = rec;
    state.curTarget = rec;

    if (state.pendingDocKw.length) {
        rec.keywords.unshift(...state.pendingDocKw.splice(0));
    }
    for (const kw of kws) {
        rec.keywords.push(kwNormalize({
            name: kw.name, args: kw.args, indicators: p.indicators,
        }));
    }
}

function handleNamedField (p, state, doc) {
    ensureCurrentRecord(state, doc);

    // REFFLD fields commonly omit length/type — the referenced PF supplies
    // them at compile time.  We can't resolve the PF here, so we pin a
    // 10-char placeholder and flag the item so the renderer can clamp
    // it against the next sibling.
    const isRef       = p.refFlag === 'R';
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
    if (isRef)       item.refField        = true;
    if (inferredLen) item._lengthInferred = true;       // renderer clamp

    state.curRecord.items.push(item);
    state.curTarget = item;

    for (const kw of tokenizeKeywords(p.keywordText)) {
        item.keywords.push(kwNormalize({
            name: kw.name, args: kw.args, indicators: p.indicators,
        }));
    }

    if (p.row != null) state.lastRow    = item.row;
    if (p.col != null) state.lastEndCol = item.col + (item.length || 1);
}

function handlePositionedItem (p, state, doc) {
    ensureCurrentRecord(state, doc);
    const kwText = p.keywordText.trim();

    if (kwText.startsWith("'")) {
        pushConstant(p, state, kwText);
    } else if (kwText) {
        pushConstantOrSysvalue(p, state, kwText);
    }

    const placed = state.curRecord.items[state.curRecord.items.length - 1];
    if (placed && p.row != null) {
        state.lastRow = placed.row;
        const w = placed.kind === 'constant'
            ? (placed.text ?? '').length
            : (placed.length || (placed.sysName ?? '').length || 1);
        state.lastEndCol = placed.col + Math.max(1, w);
    }
}

function pushConstant (p, state, kwText) {
    const { text, rest } = readQuotedString(kwText);
    const item = makeItem({
        kind: 'constant',
        row: p.row || 1, col: p.col || 1,
        text,
        indicators: p.indicators ?? [],
    });
    state.curRecord.items.push(item);
    state.curTarget = item;
    if (rest.trim()) {
        for (const kw of tokenizeKeywords(rest)) {
            item.keywords.push(kwNormalize({
                name: kw.name, args: kw.args, indicators: p.indicators,
            }));
        }
    }
}

function pushConstantOrSysvalue (p, state, kwText) {
    const kws = tokenizeKeywords(kwText);
    if (!kws.length) return;
    const head  = kws[0];
    const isSys = SYSVALUE_NAMES.has(head.name);

    const item = makeItem({
        kind: isSys ? 'sysvalue' : 'constant',
        row: p.row || 1, col: p.col || 1,
        sysName: isSys ? head.name : undefined,
        text: isSys ? '' : head.name,
        indicators: p.indicators ?? [],
    });
    state.curRecord.items.push(item);
    state.curTarget = item;

    // The first token doubles as the sysvalue marker AND a keyword — keep
    // it as a keyword so the writer can round-trip cleanly.
    item.keywords.push(kwNormalize({
        name: head.name, args: head.args, indicators: p.indicators,
    }));
    for (let i = 1; i < kws.length; i++) {
        item.keywords.push(kwNormalize({
            name: kws[i].name, args: kws[i].args, indicators: p.indicators,
        }));
    }
}

function handleContinuation (p, state) {
    const target = state.curTarget ?? state.curRecord;
    const kws = tokenizeKeywords(p.keywordText);

    if (!target) {
        // Document-level keywords seen before the first record header —
        // stash and prepend to records[0] once we have one.
        for (const kw of kws) {
            state.pendingDocKw.push(kwNormalize({
                name: kw.name, args: kw.args, indicators: p.indicators,
            }));
        }
        return;
    }

    for (const kw of kws) {
        target.keywords.push(kwNormalize({
            name: kw.name, args: kw.args, indicators: p.indicators,
        }));
        // A record that gains an SFL/SFLCTL/etc. keyword on a continuation
        // line gets its type promoted retroactively.
        if (target === state.curRecord
            && TYPE_KEYWORDS.has(kw.name)
            && state.curRecord.type === 'RECORD') {
            state.curRecord.type = kw.name;
        }
    }
}

// Fallback for malformed input where a field/constant appears before the
// first R-line.  Wraps the orphans in a synthetic 'NONAME' record.
function ensureCurrentRecord (state, doc) {
    if (state.curRecord) return;
    state.curRecord = makeRecord({ name: 'NONAME', type: 'RECORD' });
    doc.records.push(state.curRecord);
}
