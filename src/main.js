// Bootstrap.  Builds the document, wires every UI piece, and forwards
// document changes into toolbar / statusbar chrome.  Also handles real
// Open (parse DSPF source) and Save (emit DSPF source + download).

import { DspfDocument, MODELS, RECORD_TYPES, makeItem } from './DspfModel.js';
import { Designer }  from './Designer.js';
import { Palette }   from './Palette.js';
import { Inspector } from './Inspector.js';
import { SourceEditor } from './SourceEditor.js';
import { keywordsFromShortcuts } from './Keywords.js';
import { parseDspf } from './DspfParser.js';
import { writeDspf, writeDspfWithMap } from './DspfWriter.js';
import { generateRpgle, generateCobol } from './CodeGen.js';

function main () {
    console.log('%c[dspf·rad]', 'color:#6f6', 'boot - DSPF-RAD designer (v0.5)');

    const $ = (id) => document.getElementById(id);

    // ---- DOM references collected first ----------------------------------
    // refreshChrome (defined below) reads these.  The Designer constructor
    // calls refreshChrome() during its initial paint, so the references
    // *must* exist before `new Designer(...)` runs.  If you move these
    // declarations back below `new Designer(...)` you'll trip a TDZ
    // ReferenceError that silently aborts the rest of bootstrap and
    // leaves every toolbar button unwired.
    const canvasEl   = $('grid');
    const modelSel   = $('modelSel');
    const recordSel  = $('recordSel');
    const statusEl   = $('status');
    const helpEl     = $('canvasHelp');
    const overlayBtn = $('overlayToggle');
    const fileInput  = $('fileInput');

    const doc = new DspfDocument();
    seedDemo(doc);

    // The selectFromInspector reference is patched after Designer is
     // created (closure captures `designer` which is declared just below).
    let selectFromInspector = () => {};
    const inspector = new Inspector($('inspectorBody'), {
        documentRef:     () => doc,
        activeRecordRef: () => doc.activeRecord,
        onItemPatch:   (id, patch) => doc.updateItem(id, patch),
        onItemDelete:  (id) => doc.removeItem(id),
        onRecordPatch: (patch) => {
            if (patch.name != null) doc.renameRecord(doc.activeRecordIndex, patch.name);
            if (patch.type != null) doc.setRecordType(doc.activeRecordIndex, patch.type);
        },
        onChange:      () => doc.emit(),
        onSelectItem:  (id) => selectFromInspector(id),
    });

    const palette = new Palette($('palette'));

    const designer = new Designer({
        canvas:    canvasEl,
        document:  doc,
        inspector,
        palette,
        onChange:  () => refreshChrome(),
    });
    selectFromInspector = (id) => designer.selectItem(id);

    // ---- Source pane (CodeMirror) ---------------------------------------
    // Two-way sync between the canvas and a live DSPF source view.
    //
    //   canvas → source: every doc.emit() runs `writeDspfWithMap`, swaps
    //   the editor text and refreshes the line-range map so cursor↔item
    //   link stays correct.  Skipped while `sourceIsAuthoritative` is on,
    //   so a parse round-trip doesn't reformat the user's in-progress
    //   text on every keystroke.
    //
    //   source → canvas: typing fires `onUserChange` (debounced 300 ms),
    //   we parse and `doc.adopt` the result.  Parse failures keep the
    //   canvas at its last-good state and surface as a status badge.
    let lineMap              = { records: [], items: [] };
    let sourceIsAuthoritative = false;
    let parseTimer           = null;
    let cursorSyncTimer      = null;
    // When the source pane drives a canvas selection, we don't want the
    // canvas's onSelectionChange callback to bounce the source cursor
    // back to the start of the item's first line — the user just clicked
    // somewhere in the source and we should leave their caret alone.
    let suppressCursorSync   = false;

    const sourceStatusEl = $('sourceStatus');
    const setSourceStatus = (cls, label) => {
        if (!sourceStatusEl) return;
        sourceStatusEl.className   = 'source-status ' + (cls || 'ok');
        sourceStatusEl.textContent = label;
    };

    const sourceEditor = new SourceEditor($('sourceEditor'), {
        onUserChange: (text) => {
            setSourceStatus('warn', 'parsing…');
            clearTimeout(parseTimer);
            parseTimer = setTimeout(() => {
                try {
                    const parsed = parseDspf(text);
                    if (!parsed || !parsed.records?.length) {
                        setSourceStatus('error', 'no records parsed');
                        return;
                    }
                    sourceIsAuthoritative = true;
                    try { doc.adopt(parsed); }
                    finally { sourceIsAuthoritative = false; }
                    // doc.adopt → emit fired our other listeners, but the
                    // source-pane listener below skipped because of the
                    // flag.  Recompute the line map manually so the
                    // cursor↔item link reflects the freshly-adopted doc.
                    lineMap = writeDspfWithMap(doc).map;
                    applyHighlightForSelection();
                    setSourceStatus('ok', 'sync');
                } catch (err) {
                    sourceIsAuthoritative = false;
                    setSourceStatus('error', err.message || 'parse error');
                    console.error('[dspf·rad] source parse failed:', err);
                }
            }, 300);
        },
        onCursorChange: (line) => {
            // Throttle so arrow-key sweeps don't thrash canvas selection.
            clearTimeout(cursorSyncTimer);
            cursorSyncTimer = setTimeout(() => {
                const itemEntry = lineMap.items.find(it =>
                    line >= it.first && line <= it.last);
                if (itemEntry) {
                    if (designer.selectedId !== itemEntry.id) {
                        suppressCursorSync = true;
                        try { designer.selectItem(itemEntry.id); }
                        finally { suppressCursorSync = false; }
                    }
                    return;
                }
                const recEntry = lineMap.records.find(r =>
                    line >= r.first && line <= r.last);
                if (recEntry && recEntry.idx !== doc.activeRecordIndex) {
                    suppressCursorSync = true;
                    try {
                        designer.selectItem(null);
                        doc.setActiveRecord(recEntry.idx);
                    } finally { suppressCursorSync = false; }
                }
            }, 80);
        },
    });

    // After any doc mutation that DIDN'T come from the source pane, push
    // the freshly-regenerated source text into the editor.  This is the
    // canvas→source half of the sync.
    doc.onChange(() => {
        if (sourceIsAuthoritative) return;
        const { text, map } = writeDspfWithMap(doc);
        lineMap = map;
        sourceEditor.setValue(text);
        applyHighlightForSelection();
        setSourceStatus('ok', 'sync');
    });

    // First paint: seed the editor with the demo document.
    {
        const { text, map } = writeDspfWithMap(doc);
        lineMap = map;
        sourceEditor.setValue(text);
    }

    function applyHighlightForSelection () {
        const id = designer.selectedId;
        if (!id) { sourceEditor.setHighlightLines([]); return; }
        const entry = lineMap.items.find(i => i.id === id);
        if (!entry) { sourceEditor.setHighlightLines([]); return; }
        const lines = [];
        for (let l = entry.first; l <= entry.last; l++) lines.push(l);
        sourceEditor.setHighlightLines(lines);
    }

    // Canvas selection → highlight + scroll source cursor to first line.
    // When the source pane is the one that drove this selection we skip
    // the setCursorLine, otherwise the user's click in the source jumps
    // their caret back to the start of the item's first line.
    designer.onSelectionChange = (id) => {
        applyHighlightForSelection();
        if (suppressCursorSync) return;
        if (!id) return;
        const entry = lineMap.items.find(i => i.id === id);
        if (entry) sourceEditor.setCursorLine(entry.first);
    };

    // ---- Source-panel chrome (resize handle + collapse toggle) ----------
    const sourceHandle = $('resizeHandle');
    let sourceDrag = null;
    const DEFAULT_PANEL_H = 260;
    sourceHandle?.addEventListener('pointerdown', (ev) => {
        sourceDrag = {
            y: ev.clientY,
            startH: parseFloat(
                getComputedStyle(document.documentElement)
                    .getPropertyValue('--source-panel-h')) || DEFAULT_PANEL_H,
        };
        sourceHandle.setPointerCapture(ev.pointerId);
        sourceHandle.classList.add('dragging');
    });
    sourceHandle?.addEventListener('pointermove', (ev) => {
        if (!sourceDrag) return;
        // Dragging up grows the panel.  Clamp between 80px and 70vh so the
        // canvas always has breathing room.
        const delta = sourceDrag.y - ev.clientY;
        const max   = Math.floor(window.innerHeight * 0.7);
        const next  = Math.min(Math.max(80, sourceDrag.startH + delta), max);
        document.documentElement.style.setProperty('--source-panel-h', next + 'px');
    });
    sourceHandle?.addEventListener('pointerup', (ev) => {
        if (!sourceDrag) return;
        sourceHandle.releasePointerCapture(ev.pointerId);
        sourceHandle.classList.remove('dragging');
        sourceDrag = null;
        // Canvas sizes off CSS vars we just mutated; force a fresh layout.
        designer.forceResize();
    });

    // ---- Cursor column marker toggle ------------------------------------
    // Tracked in localStorage so the preference survives reloads.  Default
    // OFF — a vertical guide is helpful but adds visual noise some users
    // would rather not have on by default.
    const COL_MARKER_KEY = 'dspf-rad:col-marker';
    const colToggleBtn = $('cursorColToggle');
    const initColMarker = localStorage.getItem(COL_MARKER_KEY) === 'on';
    sourceEditor.setCursorColumnMarker(initColMarker);
    if (initColMarker) colToggleBtn?.classList.add('on');
    colToggleBtn?.addEventListener('click', () => {
        const next = !colToggleBtn.classList.contains('on');
        colToggleBtn.classList.toggle('on', next);
        sourceEditor.setCursorColumnMarker(next);
        try { localStorage.setItem(COL_MARKER_KEY, next ? 'on' : 'off'); }
        catch (_) { /* private-mode storage may throw */ }
    });

    const sourceCollapseBtn = $('sourceCollapse');
    sourceCollapseBtn?.addEventListener('click', () => {
        const collapsed = document.body.classList.toggle('source-collapsed');
        sourceCollapseBtn.textContent = collapsed ? '▴' : '▾';
        sourceCollapseBtn.title = collapsed ? 'Show source panel' : 'Hide source panel';
        document.documentElement.style.setProperty(
            '--source-panel-h', collapsed ? '0px' : DEFAULT_PANEL_H + 'px');
        document.documentElement.style.setProperty(
            '--source-handle-h', collapsed ? '0px' : '5px');
        requestAnimationFrame(() => designer.forceResize());
    });

    modelSel.addEventListener('change', () => {
        doc.setModel(modelSel.value);
        document.body.classList.toggle('wide-mode', doc.modelKey === '27x132');
        // The CSS aspect-ratio change settles asynchronously; force a
        // resize+redraw after the next frame so the canvas picks up the
        // new bounds.  Without this the grid keeps drawing at the old
        // dimensions until you wiggle the window.
        requestAnimationFrame(() => designer.forceResize());
        setTimeout(() => designer.forceResize(), 60);
    });

    $('newDoc').addEventListener('click', () => {
        if (!confirm('Discard the current design?')) return;
        doc.reset();
        designer.selectItem(null);
        palette.clearArmed();
    });

    $('openDoc').addEventListener('click', () => {
        console.debug('[dspf·rad] Open clicked; opening native file picker.');
        fileInput.click();
    });
    fileInput.addEventListener('change', async (ev) => {
        const file = ev.target.files?.[0];
        fileInput.value = '';
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = parseDspf(text);
            doc.adopt(parsed);
            // Match the model to the actual DSPSIZ if present.
            const dspsiz = doc.records[0]?.keywords?.find(kw => kw.name === 'DSPSIZ');
            if (dspsiz && dspsiz.args.length >= 2) {
                const rows = parseInt(dspsiz.args[0], 10);
                const cols = parseInt(dspsiz.args[1], 10);
                if (rows === 27 && cols === 132) {
                    doc.setModel('27x132');
                    modelSel.value = '27x132';
                    document.body.classList.add('wide-mode');
                } else {
                    doc.setModel('24x80');
                    modelSel.value = '24x80';
                    document.body.classList.remove('wide-mode');
                }
                requestAnimationFrame(() => designer.forceResize());
            }
            designer.selectItem(null);
            flash(`Loaded ${file.name}: ${doc.records.length} records, ${doc.itemCount()} items.`, 'ok');
        } catch (err) {
            console.error('[dspf·rad] open failed:', err);
            flash(`Open failed: ${err.message}`, 'error', 4000);
        }
    });

    $('saveDoc').addEventListener('click', () => {
        try {
            const source = writeDspf(doc);
            const name = (doc.records[0]?.name || 'DSPF') + '.DSPF';
            downloadText(name, source);
            flash(`Saved ${name}.`, 'ok');
        } catch (err) {
            console.error('[dspf·rad] save failed:', err);
            flash(`Save failed: ${err.message}`, 'error');
        }
    });

    $('addRecord').addEventListener('click', () => {
        const name = prompt('New record format name:', `R${doc.records.length + 1}`);
        if (name == null) return;
        doc.addRecord(name);
    });
    $('addSubfile')?.addEventListener('click', () => {
        const base = prompt('Subfile base name (creates <BASE> + <BASE>C):', 'SFL');
        if (base == null) return;
        const { sflctl } = doc.addSubfile(base);
        flash(`Created subfile pair: ${doc.records[doc.records.length - 2].name} + ${sflctl.name}.`, 'ok');
    });
    $('renameRecord').addEventListener('click', () => {
        const cur = doc.activeRecord.name;
        const name = prompt('Rename record format:', cur);
        if (name == null || name === cur) return;
        doc.renameRecord(doc.activeRecordIndex, name);
    });
    $('deleteRecord').addEventListener('click', () => {
        if (doc.records.length === 1) {
            flash('At least one record is required.', 'error');
            return;
        }
        if (!confirm(`Delete record ${doc.activeRecord.name}?`)) return;
        doc.deleteRecord(doc.activeRecordIndex);
    });
    recordSel.addEventListener('change', () => {
        doc.setActiveRecord(parseInt(recordSel.value, 10));
        designer.selectItem(null);
    });

    overlayBtn?.addEventListener('click', () => {
        doc.setShowOverlay(!doc.showOverlay);
    });
    $('hideCondToggle')?.addEventListener('click', () => {
        doc.setHideConditioned(!doc.hideConditioned);
    });

    $('genRpgle')?.addEventListener('click', () => {
        const dspfName = (doc.records[0]?.name || 'DSPF').toUpperCase().slice(0, 10);
        const prog = prompt('Program name (max 10 chars, RPGLE):', dspfName + 'R')?.toUpperCase().slice(0, 10);
        if (!prog) return;
        const src = generateRpgle(doc, { programName: prog, dspfName });
        downloadText(prog + '.RPGLE', src);
        flash(`Generated ${prog}.RPGLE skeleton.`, 'ok');
    });

    $('genCobol')?.addEventListener('click', () => {
        const dspfName = (doc.records[0]?.name || 'DSPF').toUpperCase().slice(0, 10);
        const prog = prompt('Program name (max 10 chars, COBOL):', dspfName + 'C')?.toUpperCase().slice(0, 10);
        if (!prog) return;
        const src = generateCobol(doc, { programName: prog, dspfName });
        downloadText(prog + '.CBLLE', src);
        flash(`Generated ${prog}.CBLLE skeleton.`, 'ok');
    });

    $('exportJson').addEventListener('click', async () => {
        const json = JSON.stringify(doc.toJSON(), null, 2);
        console.log(json);
        try {
            await navigator.clipboard.writeText(json);
            flash('Internal model copied to clipboard.', 'ok');
        } catch {
            flash('Internal model dumped to console.', 'ok');
        }
    });

    // Global Escape disarms the palette no matter where focus is.
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && palette.getArmedSpec()) {
            palette.clearArmed();
            $('grid').classList.remove('canvas-armed');
        }
    });

    // ---- click on canvas updates cursor readout + reflects armed state ----
    $('grid').addEventListener('pointermove', (ev) => {
        const cell = designer.renderer.cellAt(ev.clientX, ev.clientY);
        $('sbCursor').textContent = cell ? `(${cell.row},${cell.col})` : '(–,–)';
        $('grid').classList.toggle('canvas-armed', !!palette.getArmedSpec());
    });
    $('grid').addEventListener('pointerleave', () => {
        $('sbCursor').textContent = '(–,–)';
    });

    function refreshChrome () {
        $('sbModel').textContent = MODELS[doc.modelKey].label.split(' · ')[0];
        modelSel.value = doc.modelKey;
        document.body.classList.toggle('wide-mode', doc.modelKey === '27x132');

        recordSel.innerHTML = '';
        for (let i = 0; i < doc.records.length; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            const r = doc.records[i];
            const typeBadge = r.type === 'RECORD' ? '' : ` [${r.type}]`;
            opt.textContent = r.name + typeBadge;
            recordSel.appendChild(opt);
        }
        recordSel.value = doc.activeRecordIndex;

        const rec = doc.activeRecord;
        const typeShort = rec.type === 'RECORD' ? '' : ` · ${rec.type}`;
        $('sbRecord').textContent = rec.name + typeShort;
        $('sbItems').textContent  = `${rec.items.length} items`;
        helpEl.classList.toggle('hidden', rec.items.length > 0);
        overlayBtn?.classList.toggle('on', doc.showOverlay);
        $('hideCondToggle')?.classList.toggle('on', doc.hideConditioned);
    }
    refreshChrome();
    doc.onChange(refreshChrome);

    function flash (text, cls = '', ms = 2500) {
        statusEl.textContent = text;
        statusEl.className = cls;
        if (cls) setTimeout(() => {
            statusEl.textContent = 'ready';
            statusEl.className = '';
        }, ms);
    }

    // Expose for console debugging.  `dspfRad.parse(str)` and
    // `dspfRad.write()` are handy when comparing parser/writer round-trips.
    window.dspfRad = {
        doc, designer, palette,
        parse: (s) => parseDspf(s),
        write: () => writeDspf(doc),
        load:  (s) => { doc.adopt(parseDspf(s)); designer.selectItem(null); },
    };
}

function downloadText (filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Convenience constructors for the seed.
function ct (row, col, text, opts = {}) {
    return makeItem({
        kind: 'constant', row, col, text,
        keywords: keywordsFromShortcuts(opts),
    });
}
function fd (row, col, name, length, opts = {}) {
    return makeItem({
        kind: 'field', row, col, name, length,
        usage:    opts.usage    ?? 'B',
        dataType: opts.dataType ?? 'A',
        decimals: opts.decimals ?? 0,
        keywords: keywordsFromShortcuts(opts),
    });
}

function seedDemo (doc) {
    const r = doc.activeRecord;
    r.name = 'SIGNON';
    r.type = 'RECORD';
    r.keywords = [
        { name: 'DSPSIZ',  args: ['24', '80', '*DS3'], indicators: [] },
        { name: 'CA03',    args: ['03'],               indicators: [] },
        { name: 'CA12',    args: ['12'],               indicators: [] },
        { name: 'PRINT',   args: [],                   indicators: [] },
    ];
    const push = (it) => r.items.push(it);
    push(ct(1,  2,  'SIGNON',                              { color: 'BLU' }));
    push(ct(1,  36, 'Sign On',                             { dspatr: ['HI'], color: 'WHT' }));
    push(ct(2,  51, 'System . . . . . :',                  { color: 'GRN' }));
    push(fd(2,  71, 'SYSNAME', 8,                          { usage: 'O', color: 'WHT' }));
    push(ct(3,  51, 'Subsystem . . . . :',                 { color: 'GRN' }));
    push(fd(3,  71, 'SBSNAME', 8,                          { usage: 'O', color: 'WHT' }));
    push(ct(4,  51, 'Display . . . . . :',                 { color: 'GRN' }));
    push(fd(4,  71, 'DSPNAME', 8,                          { usage: 'O', color: 'WHT' }));
    push(ct(6,  17, 'User  . . . . . . . . . . . . . . .', { color: 'GRN' }));
    push(fd(6,  53, 'USER',    10,                         { usage: 'I', dspatr: ['UL'] }));
    push(ct(7,  17, 'Password  . . . . . . . . . . . . .', { color: 'GRN' }));
    push(fd(7,  53, 'PASSWD',  10,                         { usage: 'I', dspatr: ['ND','UL'] }));
    push(ct(8,  17, 'Program/procedure . . . . . . . . .', { color: 'GRN' }));
    push(fd(8,  53, 'PROGRAM', 10,                         { usage: 'I', dspatr: ['UL'] }));
    push(ct(9,  17, 'Menu  . . . . . . . . . . . . . . .', { color: 'GRN' }));
    push(fd(9,  53, 'MENU',    10,                         { usage: 'I', dspatr: ['UL'] }));
    push(ct(10, 17, 'Current library . . . . . . . . . .', { color: 'GRN' }));
    push(fd(10, 53, 'CURLIB',  10,                         { usage: 'I', dspatr: ['UL'] }));
    push(ct(23, 7,  '(C) COPYRIGHT IBM CORP. 1980, 2024.', { color: 'BLU' }));
    push(fd(24, 2,  'MSG',     79,                         { usage: 'O', dspatr: ['HI'], color: 'YLW' }));
}

function boot () {
    try {
        main();
    } catch (err) {
        // Surface bootstrap errors so they don't fail silently and leave
        // every toolbar button wireless.  Helpful when you change the
        // initialisation order and accidentally trip a TDZ violation.
        console.error('[dspf·rad] boot failed:', err);
        const status = document.getElementById('status');
        if (status) {
            status.textContent = 'BOOT ERROR (see console): ' + (err.message || err);
            status.className = 'error';
        }
        document.title = '⚠ dspf·rad boot error';
    }
}

if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
else
    boot();
