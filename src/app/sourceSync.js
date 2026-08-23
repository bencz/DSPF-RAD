// Two-way sync between the canvas and the live DSPF source view.
//
//   canvas → source: every doc.emit() runs writeDspfWithMap, swaps the
//   editor text, and refreshes the line-range map so cursor↔item link
//   stays correct.  Skipped while sourceIsAuthoritative is on so a
//   parse round-trip doesn't reformat the user's in-progress text on
//   every keystroke.
//
//   source → canvas: typing fires onUserChange (debounced 300 ms), we
//   parse and doc.adopt the result.  Parse failures keep the canvas at
//   its last-good state and surface as a status badge.
//
// The SourceEditor reads `_onUserChange` / `_onCursorChange` off itself
// at fire-time, so assigning these after construction works (and lets
// the caller close over locals like `state` here).

import { parseDspf }        from '../parser/parseDspf.js';
import { writeDspfWithMap } from '../writer/writeDspf.js';
import { validateDspf }      from '../validation/validateDspf.js';

const PARSE_DEBOUNCE_MS  = 300;
const CURSOR_DEBOUNCE_MS = 80;

export function bindSourceSync ({ doc, designer, sourceEditor, sourceStatusEl }) {
    const state = {
        lineMap:               { records: [], items: [] },
        sourceIsAuthoritative: false,
        parseTimer:            null,
        cursorSyncTimer:       null,
        // When source drives a canvas selection, we don't want the
        // canvas's onSelectionChange callback to bounce the source
        // cursor back to the item's first line — the user just clicked
        // somewhere in the source.
        suppressCursorSync:    false,
    };

    const setStatus = makeStatusSetter(sourceStatusEl);
    const applyHighlight = () =>
        applyHighlightForSelection(designer, sourceEditor, state.lineMap);

    // Source → canvas + cursor reciprocity.
    sourceEditor._onUserChange = (text) =>
        scheduleParse(text, state, doc, designer, setStatus, applyHighlight);
    sourceEditor._onCursorChange = (line) =>
        scheduleCursorSync(line, state, designer, doc);

    // Canvas → source: refresh on every doc emit unless source is in
    // control of the latest mutation.
    doc.onChange(() => {
        if (state.sourceIsAuthoritative) return;
        // A canvas/inspector mutation supersedes any source snapshot still
        // waiting in the debounce queue.  Otherwise the stale timer can
        // overwrite the newer visual edit a fraction of a second later.
        clearTimeout(state.parseTimer);
        state.parseTimer = null;
        try {
            const { text, map } = writeDspfWithMap(doc);
            state.lineMap = map;
            sourceEditor.setValue(text);
            applyHighlight();
            setStatus('ok', 'sync');
        } catch (error) {
            setStatus('error', error.message || 'invalid DDS model');
        }
    });

    // First paint.
    const { text, map } = writeDspfWithMap(doc);
    state.lineMap = map;
    sourceEditor.setValue(text);

    // Canvas selection → highlight + scroll source cursor to first line.
    designer.onSelectionChange = (id) => {
        applyHighlight();
        if (state.suppressCursorSync) return;
        if (!id) return;
        const entry = state.lineMap.items.find(i => i.id === id);
        if (entry) sourceEditor.setCursorLine(entry.first);
    };
}

function makeStatusSetter (el) {
    return (cls, label) => {
        if (!el) return;
        el.className   = 'source-status ' + (cls || 'ok');
        el.textContent = label;
    };
}

function scheduleParse (text, state, doc, designer, setStatus, applyHighlight) {
    setStatus('warn', 'parsing…');
    clearTimeout(state.parseTimer);
    state.parseTimer = setTimeout(() =>
        runParse(text, state, doc, designer, setStatus, applyHighlight),
        PARSE_DEBOUNCE_MS);
}

function runParse (text, state, doc, designer, setStatus, applyHighlight) {
    try {
        const parsed = parseDspf(text);
        if (!parsed || !parsed.records?.length) {
            setStatus('error', 'no records parsed');
            return;
        }
        const selection = selectionLocator(doc, designer.selectedId);
        state.sourceIsAuthoritative = true;
        try { doc.adopt(parsed); }
        finally { state.sourceIsAuthoritative = false; }
        const replacement = findLocatedItem(doc, selection);
        state.suppressCursorSync = true;
        try { designer.selectItem(replacement?.id ?? null); }
        finally { state.suppressCursorSync = false; }
        // doc.adopt → emit fired our other listeners, but the canvas→
        // source listener skipped because of the flag.  Recompute the
        // line map so cursor↔item reflects the adopted doc.
        state.lineMap = writeDspfWithMap(doc).map;
        applyHighlight();
        const diagnostics = validateDspf(doc);
        const errors = diagnostics.filter(item => item.severity === 'error').length;
        const warnings = diagnostics.filter(item => item.severity === 'warning').length;
        if (errors) setStatus('error', `${errors} DDS error${errors === 1 ? '' : 's'}`);
        else if (warnings) setStatus('warn', `${warnings} DDS warning${warnings === 1 ? '' : 's'}`);
        else setStatus('ok', 'sync');
    } catch (err) {
        state.sourceIsAuthoritative = false;
        setStatus('error', err.message || 'parse error');
        console.error('[dspf·rad] source parse failed:', err);
    }
}

function selectionLocator (doc, id) {
    if (!id) return null;
    for (let recordIndex = 0; recordIndex < doc.records.length; recordIndex++) {
        const record = doc.records[recordIndex];
        const itemIndex = record.items.findIndex(item => item.id === id);
        if (itemIndex < 0) continue;
        const item = record.items[itemIndex];
        return {
            recordName: record.name, recordIndex, itemIndex,
            kind: item.kind, name: item.name || '', row: item.row, col: item.col,
        };
    }
    return null;
}

function findLocatedItem (doc, locator) {
    if (!locator) return null;
    const record = doc.records.find(candidate => candidate.name === locator.recordName) ??
        doc.records[locator.recordIndex];
    if (!record) return null;
    if (locator.name) {
        const named = record.items.find(item =>
            item.kind === locator.kind && item.name === locator.name);
        if (named) return named;
    }
    const positional = record.items.find(item =>
        item.kind === locator.kind && item.row === locator.row && item.col === locator.col);
    return positional ?? record.items[locator.itemIndex] ?? null;
}

function scheduleCursorSync (line, state, designer, doc) {
    clearTimeout(state.cursorSyncTimer);
    state.cursorSyncTimer = setTimeout(() =>
        runCursorSync(line, state, designer, doc),
        CURSOR_DEBOUNCE_MS);
}

function runCursorSync (line, state, designer, doc) {
    const itemEntry = state.lineMap.items.find(it =>
        line >= it.first && line <= it.last);
    if (itemEntry) {
        if (designer.selectedId !== itemEntry.id) {
            state.suppressCursorSync = true;
            try { designer.selectItem(itemEntry.id); }
            finally { state.suppressCursorSync = false; }
        }
        return;
    }
    const recEntry = state.lineMap.records.find(r =>
        line >= r.first && line <= r.last);
    if (recEntry && recEntry.idx !== doc.activeRecordIndex) {
        state.suppressCursorSync = true;
        try {
            designer.selectItem(null);
            doc.setActiveRecord(recEntry.idx);
        } finally { state.suppressCursorSync = false; }
    }
}

function applyHighlightForSelection (designer, sourceEditor, lineMap) {
    const id = designer.selectedId;
    if (!id) { sourceEditor.setHighlightLines([]); return; }
    const entry = lineMap.items.find(i => i.id === id);
    if (!entry) { sourceEditor.setHighlightLines([]); return; }
    const lines = [];
    for (let l = entry.first; l <= entry.last; l++) lines.push(l);
    sourceEditor.setHighlightLines(lines);
}
