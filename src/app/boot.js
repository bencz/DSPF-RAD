// Bootstrap.  Constructs the document, the renderer, the inspector,
// the source editor, and wires them together with the toolbar / menubar /
// statusbar chrome.  Each concern lives in its own sibling module - this
// file is the assembly line.

import { DspfDocument } from '../model/index.js';
import { Designer }     from '../designer/Designer.js';
import { Palette }      from '../palette/Palette.js';
import { Inspector }    from '../inspector/Inspector.js';
import { SourceEditor } from '../source/SourceEditor.js';

import { parseDspf } from '../parser/parseDspf.js';
import { writeDspf } from '../writer/writeDspf.js';

import { seedDemo }       from './demoSeed.js';
import { setupMenubar }   from './menubar.js';
import { makeChromeSync } from './chromeSync.js';
import { bindSourceSync } from './sourceSync.js';
import { bindPanelResize } from './panelResize.js';
import { bindFileIO } from './fileIO.js';
import { initTheme }      from './Theme.js';
import { recoverAutosave, bindPersistence } from './persistence.js';
import { bindProblemsPanel } from './problemsPanel.js';
import { bindTemplateDialog } from './templateDialog.js';
import { bindSimulator } from './simulator.js';
import { bindRecordTree } from './recordTree.js';
import { bindDatabaseImportDialog } from './databaseImportDialog.js';
import { bindKeyFlowDialog } from './keyFlowDialog.js';
import { bindFindDialog } from './findDialog.js';
import { validateDspf }   from '../validation/validateDspf.js';
import { PRODUCT }        from '../product.js';
import { createHostBridge } from '../platform/host/index.js';
import { HostStatusController } from '../workbench/status/HostStatusController.js';
import { bindCodeGenerationActions } from '../features/code-generation/bindCodeGenerationActions.js';

const $ = (id) => document.getElementById(id);

function main () {
    console.log('%c[ironterm]', 'color:#6f6',
        `boot - ${PRODUCT.name} ${PRODUCT.version}`);

    initTheme();

    const els = collectDomRefs();
    const host = createHostBridge();
    const hostStatus = new HostStatusController({ element: els.sbHost, host });
    hostStatus.render();
    const doc = new DspfDocument();
    seedDemo(doc);
    const recovered = recoverAutosave(doc);
    doc.resetHistory({ markClean: !recovered });

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

    // Source editor + bidirectional canvas/source bridge.
    const sourceEditor = new SourceEditor($('sourceEditor'));
    const sourceSync = bindSourceSync({
        doc, designer, sourceEditor,
        sourceStatusEl: $('sourceStatus'),
    });
    bindProblemsPanel({ doc, designer, sourceEditor });

    bindPanelResize({
        designer,
        handle:      $('resizeHandle'),
        collapseBtn: $('sourceCollapse'),
    });

    bindColumnMarkerPref(sourceEditor, $('cursorColToggle'));

    // ---- toolbar / menubar action wiring -------------------------------
    const flash = makeFlasher(els.statusEl);
    bindPersistence(doc);
    bindFileIO({
        doc, designer, modelSel: els.modelSel, host, flash,
        flushSource: sourceSync.flush,
    });
    bindToolbarActions({
        doc, designer, modelSel: els.modelSel, recordSel: els.recordSel,
        els, flash,
    });
    bindTemplateDialog({
        doc, designer, palette, flash, flushSource: sourceSync.flush,
    });
    bindDatabaseImportDialog({
        doc, designer, host, flash, flushSource: sourceSync.flush,
    });
    bindKeyFlowDialog({ doc, flash, flushSource: sourceSync.flush });
    bindFindDialog({ doc, designer, flushSource: sourceSync.flush });
    bindSimulator({ doc, designer, flash });
    bindRecordTree({ doc, designer });
    bindCodeGenerationActions({ doc, host, flash, flushSource: sourceSync.flush });
    bindGlobalKeys({ doc, designer, palette });
    bindCanvasCursor(els, palette, designer);

    // First paint + listeners.
    refreshChrome();
    setupMenubar();
    if (recovered) flash('Recovered unsaved work from the previous session.', 'ok', 4000);

    // Console debugging surface.
    window.ironTermStudio = {
        product: PRODUCT, host: host.describe(), doc, designer, palette,
        parse: (s) => parseDspf(s),
        write: () => writeDspf(doc),
        validate: (options) => validateDspf(doc, options),
        load:  (s) => { doc.adopt(parseDspf(s)); designer.selectItem(null); },
    };
    // Temporary compatibility alias for existing console snippets.
    window.dspfRad = window.ironTermStudio;
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
        sbHost:       $('sbHost'),
        sbModel:      $('sbModel'),
        sbRecord:     $('sbRecord'),
        sbItems:      $('sbItems'),
        sbCursor:     $('sbCursor'),
        sbDirty:      $('sbDirty'),
        undoBtn:      $('undoDoc'),
        redoBtn:      $('redoDoc'),
        recordUpBtn:  $('recordUp'),
        recordDownBtn: $('recordDown'),
    };
}

// ---- toolbar action handlers --------------------------------------------

function bindToolbarActions ({
    doc, designer, modelSel, recordSel, els, flash,
}) {
    modelSel.addEventListener('change', () => {
        doc.setModel(modelSel.value);
        document.body.classList.toggle('wide-mode', doc.modelKey === '27x132');
        // CSS aspect-ratio settles async; double-tap so the canvas
        // picks up the new bounds.
        requestAnimationFrame(() => designer.forceResize());
        setTimeout(() => designer.forceResize(), 60);
    });

    $('undoDoc')?.addEventListener('click', () => doc.undo());
    $('redoDoc')?.addEventListener('click', () => doc.redo());
    $('copyItems')?.addEventListener('click', () => {
        if (!designer.copySelection()) flash('Select one or more items first.', 'error');
        else flash(`Copied ${designer.selectedIds.size} item(s).`, 'ok');
    });
    $('pasteItems')?.addEventListener('click', () => {
        const added = designer.pasteSelection();
        if (!added.length) flash('Nothing has been copied yet.', 'error');
        else flash(`Pasted ${added.length} item(s).`, 'ok');
    });
    $('duplicateItems')?.addEventListener('click', () => {
        const added = designer.duplicateSelection();
        if (!added.length) flash('Select one or more items first.', 'error');
        else flash(`Duplicated ${added.length} item(s).`, 'ok');
    });
    $('arrangeItems')?.addEventListener('click', () => {
        const mode = $('arrangeSel')?.value;
        const changed = mode?.startsWith('distribute-')
            ? designer.distributeSelection(mode.replace('distribute-', ''))
            : designer.alignSelection(mode);
        if (!changed) flash('Select at least 2 items (3 to distribute).', 'error');
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

    $('cloneRecord')?.addEventListener('click', () => {
        const created = doc.duplicateRecord(doc.activeRecordIndex);
        if (!created.length) return;
        designer.selectItem(null);
        flash(created.length === 2
            ? `Duplicated subfile pair as ${created[0].name} + ${created[1].name}.`
            : `Duplicated record as ${created[0].name}.`, 'ok', 4000);
    });

    $('recordUp')?.addEventListener('click', () =>
        doc.moveRecord(doc.activeRecordIndex, -1));
    $('recordDown')?.addEventListener('click', () =>
        doc.moveRecord(doc.activeRecordIndex, 1));

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

// ---- misc bindings ------------------------------------------------------

// Global Escape disarms the palette regardless of focus.
function bindGlobalKeys ({ doc, designer, palette }) {
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && palette.getArmedSpec()) {
            palette.clearArmed();
            $('grid').classList.remove('canvas-armed');
        }
        const command = ev.ctrlKey || ev.metaKey;
        if (!command) return;

        const key = ev.key.toLowerCase();
        if (key === 's') {
            ev.preventDefault();
            $('saveDoc').click();
            return;
        }
        if (key === 'o') {
            ev.preventDefault();
            $('openDoc').click();
            return;
        }
        if (key === 'n') {
            ev.preventDefault();
            $('newDoc').click();
            return;
        }
        if (isTextEditingTarget(ev.target)) return;

        if (key === 'f') {
            ev.preventDefault();
            $('findDesign')?.click();
            return;
        }

        if (key === 'z') {
            ev.preventDefault();
            if (ev.shiftKey) doc.redo();
            else doc.undo();
        } else if (key === 'y') {
            ev.preventDefault();
            doc.redo();
        } else if (key === 'c') {
            if (designer.selectedIds.size) {
                ev.preventDefault();
                designer.copySelection();
            }
        } else if (key === 'v') {
            ev.preventDefault();
            designer.pasteSelection();
        } else if (key === 'd') {
            if (designer.selectedIds.size) {
                ev.preventDefault();
                designer.duplicateSelection();
            }
        } else if (key === 'a' && document.activeElement === designer.canvas) {
            ev.preventDefault();
            designer.selectAll();
        }
    });
}

function isTextEditingTarget (target) {
    return !!target?.closest?.('input, textarea, select, [contenteditable="true"], .cm-editor');
}

// Cursor readout + armed-state class toggle on the canvas.
function bindCanvasCursor (els, palette, designer) {
    const grid = els.canvas;
    grid.addEventListener('pointermove', (ev) => {
        const cell = designer.renderer.cellAt(ev.clientX, ev.clientY);
        els.sbCursor.textContent = cell ? `(${cell.row},${cell.col})` : '(-,-)';
        grid.classList.toggle('canvas-armed', !!palette.getArmedSpec());
    });
    grid.addEventListener('pointerleave', () => {
        els.sbCursor.textContent = '(-,-)';
    });
}

// Column-marker preference (persisted in localStorage).
// Preserve the established preference key across the product rebrand.
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
        console.error('[ironterm] boot failed:', err);
        const status = document.getElementById('status');
        if (status) {
            status.textContent = 'BOOT ERROR (see console): ' + (err.message || err);
            status.className   = 'error';
        }
        document.title = `[!] ${PRODUCT.name} boot error`;
    }
}
