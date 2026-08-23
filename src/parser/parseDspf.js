// DSPF (display file) source parser.
//
// Tolerant by design: real-world DSPF can lack the leading 'A' at col 6
// (some tools strip it), mix tabs into the prefix, and uses keyword
// continuations via '+' / '-' at the end of the keyword area.  All
// accepted - the lenient layer lives in ./lineFilter.js.

import { DspfDocument, makeRecord, makeItem } from '../model/index.js';
import { normalize as kwNormalize } from '../model/keywords.js';
import { filterAndMergeLines } from './lineFilter.js';
import { parseSourceLine, parseRelativeNum } from './lineFields.js';
import { tokenizeKeywords, readQuotedString } from './tokenizer.js';

const TYPE_KEYWORDS = new Set(['SFL', 'SFLCTL', 'MNUBAR', 'PULLDOWN', 'WINDOW']);

const SYSVALUE_NAMES = new Set([
    'DATE', 'TIME', 'USER', 'SYSNAME', 'USRNAME',
    'DATEUSA', 'TIMEUSA', 'EUROPE', 'JOBNAME', 'NETID',
    'MSGCON',
]);

export function parseDspf (source) {
    const merged = filterAndMergeLines(source.split(/\r?\n/));

    const doc = new DspfDocument();
    doc.records = [];

    const state = {
        curRecord:     null,
        curTarget:     null,       // record, help spec, or item
        pendingDocKw:  [],         // keywords seen before any record
        pendingConditionLines: [], // A/O condition lines preceding a target
        // For "+N" relative row/col resolution:
        //   row "+N" = previous line + N
        //   col "+N" = end of previous item + N
        lastRow:    1,
        lastEndCol: 1,
    };

    for (const line of merged) {
        const p = parseSourceLine(line);
        resolveRowColIn(p, state);

        if (isConditionOnly(p)) {
            state.pendingConditionLines.push({
                conditionOp: p.conditionOp,
                indicators: p.indicators.slice(),
            });
            continue;
        }

        if (p.nameType === 'R')        handleRecordLine(p, state, doc);
        else if (p.nameType === 'H')   handleHelpLine(p, state, doc);
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
    doc.modelKey = inferModelKey(doc);
    doc.activeRecordIndex = 0;
    return doc;
}

function isConditionOnly (p) {
    return p.indicators.length > 0 && !p.nameType && !p.name &&
        p.row == null && p.col == null && !p.keywordText.trim();
}

function takeConditionPrefix (state) {
    return state.pendingConditionLines.splice(0).map(line => ({
        conditionOp: line.conditionOp,
        indicators: line.indicators.slice(),
    }));
}

function conditionedKeyword (kw, p, conditionLines = []) {
    return kwNormalize({
        name: kw.name,
        args: kw.args,
        indicators: p.indicators,
        conditionOp: p.conditionOp,
        conditionLines,
    });
}

function handleHelpLine (p, state, doc) {
    ensureCurrentRecord(state, doc);
    const conditionLines = takeConditionPrefix(state);
    const spec = {
        keywords: tokenizeKeywords(p.keywordText).map(kw =>
            conditionedKeyword(kw, p, conditionLines)),
    };
    state.curRecord.helpSpecs.push(spec);
    state.curTarget = spec;
}

function inferModelKey (doc) {
    const dspsiz = doc.records
        .flatMap(rec => rec.keywords ?? [])
        .find(kw => kw.name === 'DSPSIZ');
    if (!dspsiz) return '24x80';

    const args = (dspsiz.args ?? []).map(arg => String(arg).toUpperCase());
    const rows = parseInt(args[0], 10);
    const cols = parseInt(args[1], 10);
    if (rows === 27 && cols === 132) return '27x132';
    if (args.includes('*DS4') && !args.includes('*DS3')) return '27x132';
    return '24x80';
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
    const conditionLines = takeConditionPrefix(state);
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
        rec.keywords.push(conditionedKeyword(kw, p, conditionLines));
    }
}

function handleNamedField (p, state, doc) {
    ensureCurrentRecord(state, doc);
    const conditionLines = takeConditionPrefix(state);

    // REFFLD fields commonly omit length/type - the referenced PF supplies
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
        // DDS position 38 defaults to output-only when blank.
        usage: p.usage || 'O',
        indicators: p.indicators ?? [],
        conditionOp: p.conditionOp,
        conditionLines,
    });
    if (isRef)       item.refField        = true;
    if (inferredLen) item._lengthInferred = true;       // renderer clamp

    state.curRecord.items.push(item);
    state.curTarget = item;

    for (const kw of tokenizeKeywords(p.keywordText)) {
        // Conditions on a field-definition line select the field itself,
        // not each keyword that happens to share its keyword area.
        item.keywords.push(kwNormalize({
            name: kw.name, args: kw.args, indicators: [],
        }));
    }

    if (p.row != null) state.lastRow    = item.row;
    if (p.col != null) state.lastEndCol = item.col + (item.length || 1);
}

function handlePositionedItem (p, state, doc) {
    ensureCurrentRecord(state, doc);
    const conditionLines = takeConditionPrefix(state);
    const kwText = p.keywordText.trim();

    if (!kwText && p.indicators.length === 1 &&
        String(p.indicators[0]).startsWith('*') &&
        state.curTarget?.kind) {
        state.curTarget.alternateLocations ??= [];
        state.curTarget.alternateLocations.push({
            conditionName: p.indicators[0], row: p.row, col: p.col,
        });
        state.lastRow = p.row;
        state.lastEndCol = p.col;
        return;
    }

    if (kwText.startsWith("'")) {
        pushConstant(p, state, kwText, conditionLines);
    } else if (kwText) {
        pushConstantOrSysvalue(p, state, kwText, conditionLines);
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

function pushConstant (p, state, kwText, conditionLines) {
    const { text, rest } = readQuotedString(kwText);
    const item = makeItem({
        kind: 'constant',
        row: p.row || 1, col: p.col || 1,
        text,
        indicators: p.indicators ?? [],
        conditionOp: p.conditionOp,
        conditionLines,
    });
    state.curRecord.items.push(item);
    state.curTarget = item;
    if (rest.trim()) {
        for (const kw of tokenizeKeywords(rest)) {
            item.keywords.push(kwNormalize({
                name: kw.name, args: kw.args, indicators: [],
            }));
        }
    }
}

function pushConstantOrSysvalue (p, state, kwText, conditionLines) {
    const kws = tokenizeKeywords(kwText);
    if (!kws.length) return;
    const head  = kws[0];
    const isSys = SYSVALUE_NAMES.has(head.name);

    if (head.name === 'DFT' && head.args.length) {
        const { text } = readQuotedString(String(head.args[0]));
        const item = makeItem({
            kind: 'constant', row: p.row || 1, col: p.col || 1,
            text, indicators: p.indicators ?? [],
            conditionOp: p.conditionOp, conditionLines,
            keywords: kws.slice(1).map(kw => kwNormalize({
                name: kw.name, args: kw.args, indicators: [],
            })),
        });
        state.curRecord.items.push(item);
        state.curTarget = item;
        return;
    }

    const item = makeItem({
        // A positioned keyword can start an unnamed field whose actual
        // DATE/TIME/MSGCON marker follows on the next DDS line.  Keep it as
        // an unnamed keyword field, never turn the keyword into quoted text.
        kind: 'sysvalue',
        row: p.row || 1, col: p.col || 1,
        sysName: isSys ? head.name : '',
        text: '',
        indicators: p.indicators ?? [],
        conditionOp: p.conditionOp,
        conditionLines,
    });
    state.curRecord.items.push(item);
    state.curTarget = item;

    // The first token doubles as the sysvalue marker AND a keyword - keep
    // it as a keyword so the writer can round-trip cleanly.
    item.keywords.push(kwNormalize({
        name: head.name, args: head.args, indicators: [],
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
    const conditionLines = takeConditionPrefix(state);

    if (!target) {
        // Document-level keywords seen before the first record header -
        // stash and prepend to records[0] once we have one.
        for (const kw of kws) {
            const normalized = conditionedKeyword(kw, p, conditionLines);
            state.pendingDocKw.push(kwNormalize({
                ...normalized,
                scope: 'file',
            }));
        }
        return;
    }

    for (const kw of kws) {
        target.keywords.push(conditionedKeyword(kw, p, conditionLines));
        if (target.kind === 'sysvalue' && !target.sysName &&
            SYSVALUE_NAMES.has(kw.name)) {
            target.sysName = kw.name;
        }
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
