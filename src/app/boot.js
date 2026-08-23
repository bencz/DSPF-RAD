// Bootstrap.  Constructs the document, the renderer, the inspector,
// the source editor, and wires them together with the toolbar / menubar /
// statusbar chrome.  Each concern lives in its own sibling module — this
// file is the assembly line.

import { DspfDocument } from '../model/index.js';
import { Designer }     from '../designer/Designer.js';
import { Palette }      from '../palette/Palette.js';
import { Inspector }    from '../inspector/Inspector.js';
import { SourceEditor } from '../source/SourceEditor.js';

import { parseDspf } from '../parser/parseDspf.js';
import { writeDspf } from '../writer/writeDspf.js';
import { generateRpgle } from '../codegen/rpgle.js';
import { generateCobol } from '../codegen/cobol.js';

import { seedDemo }       from './demoSeed.js';
import { setupMenubar }   from './menubar.js';
import { makeChromeSync } from './chromeSync.js';
import { bindSourceSync } from './sourceSync.js';
import { bindPanelResize } from './panelResize.js';
import { bindFileIO, downloadText } from './fileIO.js';
import { initTheme }      from './Theme.js';
import { usesIndara }     from '../codegen/analysis.js';
import { validateDspf }   from '../validation/validateDspf.js';
import { ibmiName }       from '../model/factories.js';

const $ = (id) => document.getElementById(id);

function main () {
    console.log('%c[dspf·rad]', 'color:#6f6', 'boot — DSPF-RAD designer (v0.5)');

    initTheme();

    const els = collectDomRefs();
    const doc = new DspfDocument();
    seedDemo(doc);

    // Inspector / Palette / Designer + selection callback wiring.
    // selectFromInspector is patched after Designer construction because
    // the closure captures `designer` declared just below.
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
        onChange:     () => doc.emit(),
        onSelectItem: (id) => selectFromInspector(id),
    });

    const palette  = new Palette($('palette'));
    const refreshChrome = makeChromeSync({ doc, els });
    const designer = new Designer({
        canvas:    els.canvas,
        document:  doc,
        inspector,
        palette,
        onChange:  refreshChrome,
    });
    selectFromInspector = (id) => designer.selectItem(id);

    // Source editor + canvas↔source bridge.
    const sourceEditor = new SourceEditor($('sourceEditor'));
    bindSourceSync({
        doc, designer, sourceEditor,
        sourceStatusEl: $('sourceStatus'),
    });

    bindPanelResize({
        designer,
        handle:      $('resizeHandle'),
        collapseBtn: $('sourceCollapse'),
    });

    bindColumnMarkerPref(sourceEditor, $('cursorColToggle'));

    // ---- toolbar / menubar action wiring -------------------------------
    const flash = makeFlasher(els.statusEl);
    bindFileIO({ doc, designer, modelSel: els.modelSel, fileInput: els.fileInput, flash });
    bindToolbarActions({ doc, designer, palette, modelSel: els.modelSel, recordSel: els.recordSel, els, flash });
    bindExportActions({ doc, flash });
    bindGlobalKeys(palette);
    bindCanvasCursor(els, palette, designer);

    // First paint + listeners.
    refreshChrome();
    doc.onChange(refreshChrome);
    setupMenubar();

    // Console debugging surface.
    window.dspfRad = {
        doc, designer, palette,
        parse: (s) => parseDspf(s),
        write: () => writeDspf(doc),
        validate: (options) => validateDspf(doc, options),
        load:  (s) => { doc.adopt(parseDspf(s)); designer.selectItem(null); },
    };
}

// ---- DOM references -----------------------------------------------------

function collectDomRefs () {
    return {
        canvas:       $('grid'),
        modelSel:     $('modelSel'),
        recordSel:    $('recordSel'),
        statusEl:     $('status'),
        helpEl:       $('canvasHelp'),
        overlayBtn:   $('overlayToggle'),
        hideCondBtn:  $('hideCondToggle'),
        deleteBtn:    $('deleteRecord'),
        fileInput:    $('fileInput'),
        sbModel:      $('sbModel'),
        sbRecord:     $('sbRecord'),
        sbItems:      $('sbItems'),
        sbCursor:     $('sbCursor'),
    };
}

// ---- toolbar action handlers --------------------------------------------

function bindToolbarActions ({ doc, designer, palette, modelSel, recordSel, els, flash }) {
    modelSel.addEventListener('change', () => {
        doc.setModel(modelSel.value);
        document.body.classList.toggle('wide-mode', doc.modelKey === '27x132');
        // CSS aspect-ratio settles async; double-tap so the canvas
        // picks up the new bounds.
        requestAnimationFrame(() => designer.forceResize());
        setTimeout(() => designer.forceResize(), 60);
    });

    $('newDoc').addEventListener('click', () => {
        if (!confirm('Discard the current design?')) return;
        doc.reset();
        designer.selectItem(null);
        palette.clearArmed();
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
        const sflName = doc.records[doc.records.length - 2].name;
        flash(`Created subfile pair: ${sflName} + ${sflctl.name}.`, 'ok');
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

    els.overlayBtn?.addEventListener('click', () => {
        doc.setShowOverlay(!doc.showOverlay);
    });
    els.hideCondBtn?.addEventListener('click', () => {
        doc.setHideConditioned(!doc.hideConditioned);
    });
}

function bindExportActions ({ doc, flash }) {
    $('genRpgle')?.addEventListener('click', () => exportRpgle(false));
    $('regenRpgle')?.addEventListener('click', () => exportRpgle(true));
    $('genCobol')?.addEventListener('click', () => exportCobol(false));
    $('regenCobol')?.addEventListener('click', () => exportCobol(true));

    async function exportRpgle (mergeExisting) {
        if (!confirmValidGeneration(doc, 'rpgle', flash)) return;
        const dspfName = ibmiName(doc.sourceName, 'DSPFILE');
        const prog = ibmiName(
            prompt('Program name (max 10 chars, RPGLE):', dspfName + 'R'), '');
        if (!prog) return;
        const previousSource = mergeExisting
            ? await selectSourceFile('.rpgle,.sqlrpgle,.txt')
            : null;
        if (mergeExisting && previousSource == null) {
            flash('RPGLE regeneration cancelled.', 'error');
            return;
        }
        try {
            const src = generateRpgle(doc, {
                programName: prog, dspfName, previousSource,
            });
            downloadText(prog + '.RPGLE', src);
            flash(`${mergeExisting ? 'Regenerated' : 'Generated'} ${prog}.RPGLE.`, 'ok');
        } catch (err) {
            console.error('[dspf·rad] RPGLE generation failed:', err);
            flash(`RPGLE generation failed: ${err.message}`, 'error', 5000);
        }
    }

    async function exportCobol (mergeExisting) {
        if (!usesIndara(doc)) {
            const add = confirm(
                'ILE COBOL needs a stable separate indicator area. ' +
                'Add the file-level INDARA keyword before generating?');
            if (!add) {
                flash('COBOL generation cancelled: INDARA is required.', 'error', 4000);
                return;
            }
            doc.records[0].keywords.unshift({
                name: 'INDARA', args: [], indicators: [], scope: 'file',
            });
            doc.emit();
        }
        if (!confirmValidGeneration(doc, 'cobol', flash)) return;
        const dspfName = ibmiName(doc.sourceName, 'DSPFILE');
        const prog = ibmiName(
            prompt('Program name (max 10 chars, COBOL):', dspfName + 'C'), '');
        if (!prog) return;
        const previousSource = mergeExisting
            ? await selectSourceFile('.cblle,.cobol,.cbl,.txt')
            : null;
        if (mergeExisting && previousSource == null) {
            flash('COBOL regeneration cancelled.', 'error');
            return;
        }
        try {
            const src = generateCobol(doc, {
                programName: prog, dspfName, previousSource,
            });
            downloadText(prog + '.CBLLE', src);
            flash(`${mergeExisting ? 'Regenerated' : 'Generated'} ${prog}.CBLLE.`, 'ok');
        } catch (err) {
            console.error('[dspf·rad] COBOL generation failed:', err);
            flash(`COBOL generation failed: ${err.message}`, 'error', 5000);
        }
    }

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
}

function selectSourceFile (accept) {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.hidden = true;
        document.body.appendChild(input);
        let settled = false;
        const finish = async file => {
            if (settled) return;
            settled = true;
            input.remove();
            resolve(file ? await file.text() : null);
        };
        input.addEventListener('change', () => finish(input.files?.[0] ?? null),
            { once: true });
        input.addEventListener('cancel', () => finish(null), { once: true });
        input.click();
    });
}

function confirmValidGeneration (doc, language, flash) {
    const diagnostics = validateDspf(doc, { language });
    const errors = diagnostics.filter(item => item.severity === 'error');
    if (errors.length) {
        const detail = errors.slice(0, 8)
            .map(item => `${item.code}: ${item.message}`).join('\n');
        alert(`Code generation stopped: ${errors.length} DSPF error(s).\n\n${detail}`);
        flash(`Generation stopped: ${errors.length} DSPF error(s).`, 'error', 5000);
        return false;
    }
    const warnings = diagnostics.filter(item => item.severity === 'warning');
    if (!warnings.length) return true;
    const detail = warnings.slice(0, 8)
        .map(item => `${item.code}: ${item.message}`).join('\n');
    return confirm(`Generate with ${warnings.length} warning(s)?\n\n${detail}`);
}

// ---- misc bindings ------------------------------------------------------

// Global Escape disarms the palette regardless of focus.
function bindGlobalKeys (palette) {
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && palette.getArmedSpec()) {
            palette.clearArmed();
            $('grid').classList.remove('canvas-armed');
        }
    });
}

// Cursor readout + armed-state class toggle on the canvas.
function bindCanvasCursor (els, palette, designer) {
    const grid = els.canvas;
    grid.addEventListener('pointermove', (ev) => {
        const cell = designer.renderer.cellAt(ev.clientX, ev.clientY);
        els.sbCursor.textContent = cell ? `(${cell.row},${cell.col})` : '(–,–)';
        grid.classList.toggle('canvas-armed', !!palette.getArmedSpec());
    });
    grid.addEventListener('pointerleave', () => {
        els.sbCursor.textContent = '(–,–)';
    });
}

// Column-marker preference (persisted in localStorage).
const COL_MARKER_KEY = 'dspf-rad:col-marker';
function bindColumnMarkerPref (sourceEditor, toggleBtn) {
    let initial = false;
    try { initial = localStorage.getItem(COL_MARKER_KEY) === 'on'; }
    catch (_) { /* private mode storage may throw */ }
    sourceEditor.setCursorColumnMarker(initial);
    if (initial) toggleBtn?.classList.add('on');

    toggleBtn?.addEventListener('click', () => {
        const next = !toggleBtn.classList.contains('on');
        toggleBtn.classList.toggle('on', next);
        sourceEditor.setCursorColumnMarker(next);
        try { localStorage.setItem(COL_MARKER_KEY, next ? 'on' : 'off'); }
        catch (_) { /* private mode storage may throw */ }
    });
}

// ---- ephemeral status pill ---------------------------------------------

function makeFlasher (statusEl) {
    return function flash (text, cls = '', ms = 2500) {
        statusEl.textContent = text;
        statusEl.className   = cls;
        if (cls) setTimeout(() => {
            statusEl.textContent = 'ready';
            statusEl.className   = '';
        }, ms);
    };
}

// ---- entry point --------------------------------------------------------

export function boot () {
    try { main(); }
    catch (err) {
        // Surface bootstrap errors so they don't fail silently and leave
        // every toolbar button wireless.  Common cause: a TDZ violation
        // from reordering initialisation.
        console.error('[dspf·rad] boot failed:', err);
        const status = document.getElementById('status');
        if (status) {
            status.textContent = 'BOOT ERROR (see console): ' + (err.message || err);
            status.className   = 'error';
        }
        document.title = '⚠ dspf·rad boot error';
    }
}
