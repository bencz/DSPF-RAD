// React shell for DSPF·RAD.
//
// Reuses the existing zero-dependency DSPF logic modules unchanged via
// the `@dspf/*` alias (../src).  The shell DOM below replicates the
// original index.html (same ids/classes) so the legacy wiring modules —
// setupMenubar, bindSourceSync, bindFileIO, bindPanelResize, initTheme —
// run verbatim.  The imperative classes (Designer/GridCanvas, Palette,
// SourceEditor) mount through refs; the inspector is the React
// InspectorForm (TanStack Form, D-2).  The only new React code is this
// shell plus the chrome state that replaces chromeSync's direct DOM
// writes.

import { useEffect, useRef, useState } from 'react';

import { DspfDocument } from '@dspf/model/index.js';
import { MODELS }       from '@dspf/model/constants.js';
import { Designer }     from '@dspf/designer/Designer.js';
import { Palette }      from '@dspf/palette/Palette.js';
import { SourceEditor } from '@dspf/source/SourceEditor.js';

import { parseDspf }      from '@dspf/parser/parseDspf.js';
import { writeDspf }      from '@dspf/writer/writeDspf.js';
import { buildCompleteSemanticIR } from '@dspf/codegen/semanticAssembly.js';
import { buildMappingContract } from '@dspf/codegen/mappingContract.js';
import { generateReactApp } from '@dspf/codegen/reactApp.js';
import { generateSpringBootApp } from '@dspf/codegen/springBoot.js';

import { seedDemo }       from '@dspf/app/demoSeed.js';
import { setupMenubar }   from '@dspf/app/menubar.js';
import { bindSourceSync } from '@dspf/app/sourceSync.js';
import { bindPanelResize } from '@dspf/app/panelResize.js';
import { bindFileIO, downloadText } from '@dspf/app/fileIO.js';
import { initTheme }      from '@dspf/app/Theme.js';

import { DspfGrid }       from './preview/DspfGrid.jsx';
import { createSelectionBus } from './preview/useSelection.js';
import { InspectorForm }  from './preview/InspectorForm.jsx';
import { TestPanel }      from './preview/TestPanel.jsx';
import { bindPreviewResize } from './preview/previewResize.js';
import { ConvertedPane }  from './converted/ConvertedPane.jsx';
import { bindConvertedResize } from './converted/convertedResize.js';
import { loadDesignOverrides } from './conversion/designOverridesLoader.js';
import { buildSemanticPreview } from './conversion/semanticPreview.js';

// ---- small bindings ported from boot.js (not exported there) -----------

function bindColumnMarkerPref (sourceEditor, toggleBtn) {
    const KEY = 'dspf-rad:col-marker';
    let initial = false;
    try { initial = localStorage.getItem(KEY) === 'on'; } catch (_) { /* private mode */ }
    sourceEditor.setCursorColumnMarker(initial);
    if (initial) toggleBtn?.classList.add('on');

    toggleBtn?.addEventListener('click', () => {
        const next = !toggleBtn.classList.contains('on');
        toggleBtn.classList.toggle('on', next);
        sourceEditor.setCursorColumnMarker(next);
        try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch (_) { /* private mode */ }
    });
}

// Global Escape disarms the palette regardless of focus.
function bindGlobalKeys (palette) {
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && palette.getArmedSpec()) {
            palette.clearArmed();
            document.getElementById('grid')?.classList.remove('canvas-armed');
        }
    });
}

// Cursor readout + armed-state class toggle on the canvas.
function bindCanvasCursor (designer, palette, sbCursor) {
    const grid = document.getElementById('grid');
    if (!grid || !sbCursor) return;
    grid.addEventListener('pointermove', (ev) => {
        const cell = designer.renderer.cellAt(ev.clientX, ev.clientY);
        sbCursor.textContent = cell ? `(${cell.row},${cell.col})` : '(–,–)';
        grid.classList.toggle('canvas-armed', !!palette.getArmedSpec());
    });
    grid.addEventListener('pointerleave', () => { sbCursor.textContent = '(–,–)'; });
}

// ---- palette catalogue (mirrors the original index.html markup) ---------

const PALETTE_GROUPS = [
    { title: 'Widgets', items: [
        { kind: 'constant', text: 'Sample', icon: 'A', label: 'Constant' },
        { kind: 'input', length: '10', icon: '▭', label: 'Input field' },
        { kind: 'output', length: '10', icon: '▷', label: 'Output field' },
        { kind: 'both', length: '10', icon: '⇄', label: 'I/O field' },
    ]},
    { title: 'Presets', items: [
        { kind: 'constant', text: '================================================================================', icon: '─', label: 'Rule line' },
        { kind: 'constant', text: 'Sign On', dspatr: 'HI', color: 'WHT', icon: '»', label: '"Sign On" title' },
        { kind: 'input', length: '10', name: 'USER', dspatr: 'UL', icon: '▭', label: 'USER (10A, UL)' },
        { kind: 'input', length: '10', name: 'PASSWD', dspatr: 'ND,UL', icon: '▭', label: 'Password (ND·UL)' },
        { kind: 'output', length: '6', name: 'MSG', dspatr: 'HI', color: 'YLW', icon: '▷', label: 'Message (HI·YLW)' },
        { kind: 'constant', text: 'F3=Exit   F12=Cancel', color: 'BLU', icon: '⌨', label: 'Function-key legend' },
    ]},
    { title: 'ENPTUI controls', items: [
        { kind: 'pushbtn', icon: '⊓', label: 'Push button' },
        { kind: 'pushbtnGroup', icon: '⊓⊓', label: 'Push button group (3)' },
        { kind: 'radio', icon: '◉', label: 'Radio (single)' },
        { kind: 'radioGroup', icon: '◉', label: 'Radio group (3)' },
        { kind: 'checkbox', icon: '☑', label: 'Checkbox (single)' },
        { kind: 'checkGroup', icon: '☑', label: 'Check group (3)' },
        { kind: 'mnubar', icon: '≡', label: 'Menu bar (2 items)' },
        { kind: 'cntfld', icon: '¶', label: 'Continued field' },
        { kind: 'errmsg', icon: '!', label: 'Error msg field' },
    ]},
    { title: 'System values', items: [
        { kind: 'sysvalue', sys: 'DATE', icon: '⌚', label: 'DATE' },
        { kind: 'sysvalue', sys: 'TIME', icon: '⌛', label: 'TIME' },
        { kind: 'sysvalue', sys: 'USER', icon: '☻', label: 'USER' },
        { kind: 'sysvalue', sys: 'SYSNAME', icon: '⌬', label: 'SYSNAME' },
    ]},
];

function paletteAttrs (it) {
    const attrs = { 'data-kind': it.kind };
    if (it.text)   attrs['data-text']   = it.text;
    if (it.length) attrs['data-length'] = it.length;
    if (it.name)   attrs['data-name']   = it.name;
    if (it.dspatr) attrs['data-dspatr'] = it.dspatr;
    if (it.color)  attrs['data-color']  = it.color;
    if (it.sys)    attrs['data-sys']    = it.sys;
    return attrs;
}

// ---- app ----------------------------------------------------------------

export default function App () {
    // Stable document instance: created once, seeded with the SIGNON demo.
    const docRef = useRef(null);
    if (!docRef.current) {
        const doc = new DspfDocument();
        seedDemo(doc);
        docRef.current = doc;
    }
    const doc = docRef.current;

    // Imperative mount points (elements the legacy classes take over).
    const canvasRef       = useRef(null);
    const sourceElRef     = useRef(null);
    const paletteElRef    = useRef(null);
    const sourceStatusRef = useRef(null);
    const modelSelRef     = useRef(null);
    const fileInputRef    = useRef(null);
    const convertedResizeRef = useRef(null);
    const previewResizeRef = useRef(null);

    // Handlers created in the mount effect (designer/palette/inspector…)
    // are reached through these refs from JSX event handlers.
    const designerRef = useRef(null);
    const paletteRef  = useRef(null);
    // 選取 bus：在 mount effect 內建立（依賴 designer），用 state 傳給
    // DspfGrid，建立後觸發一次 re-render 完成訂閱。
    const [bus, setBus] = useState(null);
    // First-slice feature flag: keep the converted pane removable without
    // changing the Canvas or faithful React preview contracts.
    const [convertedEnabled, setConvertedEnabled] = useState(true);
    // Keep the faithful preview optional so compact workspaces can focus on
    // the Canvas or the Modern React converted pane without changing doc state.
    const [faithfulPreviewEnabled, setFaithfulPreviewEnabled] = useState(true);
    // Design overlay (D-15): optional projection fetched once; absent file = no-op.
    const [designOverrides, setDesignOverrides] = useState([]);
    // Live mirror for the console/debug hook and mount effect closures.
    const overridesRef = useRef([]);
    overridesRef.current = designOverrides;

    // ---- chrome state (replaces chromeSync's DOM writes) ----------------
    const buildChrome = () => ({
        modelKey:          doc.modelKey,
        modelLabel:        MODELS[doc.modelKey].label.split(' · ')[0],
        records:           doc.records.map((r) => ({ name: r.name, type: r.type })),
        activeRecordIndex: doc.activeRecordIndex,
        itemCount:         doc.activeRecord.items.length,
        showOverlay:       doc.showOverlay,
        hideConditioned:   doc.hideConditioned,
    });
    const [chrome, setChrome] = useState(buildChrome);
    const refreshChrome = () => setChrome(buildChrome());

    // ---- status pill (flash) --------------------------------------------
    const [flashState, setFlashState] = useState({ text: 'ready', cls: '' });
    const flash = (text, cls = '', ms = 2500) => {
        setFlashState({ text, cls });
        if (cls) setTimeout(() => setFlashState({ text: 'ready', cls: '' }), ms);
    };

    // ---- one-time assembly (mirrors boot.js main()) ---------------------
    useEffect(() => {
        initTheme();

        // D-2：legacy DOM Inspector 退休，TanStack Form（InspectorForm）
        // 接管。Designer 只呼叫 inspector.setSelection，用 no-op stub。
        const inspector = { setSelection: () => {} };

        const palette = new Palette(paletteElRef.current);
        const designer = new Designer({
            canvas:    canvasRef.current,
            document:  doc,
            inspector,
            palette,
            onChange:  refreshChrome,
        });
        designerRef.current = designer;
        paletteRef.current  = palette;        // Source editor + canvas↔source bridge (verbatim legacy module).
        const sourceEditor = new SourceEditor(sourceElRef.current);
        bindSourceSync({
            doc, designer, sourceEditor,
            sourceStatusEl: sourceStatusRef.current,
        });

        // 選取 bus：在 bindSourceSync 之後安裝（T-06）。
        setBus(createSelectionBus(designer, doc));

        bindPanelResize({
            designer,
            handle:      document.getElementById('resizeHandle'),
            collapseBtn: document.getElementById('sourceCollapse'),
        });

        // Horizontal splitter for the React preview pane (drag left to magnify).
        bindPreviewResize({ handle: previewResizeRef.current });
        bindConvertedResize({ handle: convertedResizeRef.current });
        bindColumnMarkerPref(sourceEditor, document.getElementById('cursorColToggle'));

        // File open/save (verbatim legacy module; ids resolved inside).
        bindFileIO({
            doc, designer,
            modelSel:   modelSelRef.current,
            fileInput:  fileInputRef.current,
            flash,
        });

        bindGlobalKeys(palette);
        bindCanvasCursor(designer, palette, document.getElementById('sbCursor'));

        // First paint + listeners.
        refreshChrome();
        doc.onChange(refreshChrome);
        setupMenubar();

        // Console debugging surface (same as the legacy app).
        // `semantic()` exposes the full mapping view: IR, contract (mappings,
        // diagnostics) and applied design overrides — see through
        // window.dspfRad.semantic().contract.mappings in the console.
        window.dspfRad = {
            doc, designer, palette,
            parse: (s) => parseDspf(s),
            write: () => writeDspf(doc),
            load:  (s) => { doc.adopt(parseDspf(s)); designer.selectItem(null); },
            get designOverrides() { return overridesRef.current; },
            semantic: () => buildSemanticPreview(doc, { overrides: overridesRef.current }),
        };

        return () => {
            sourceEditor.destroy();
            delete window.dspfRad;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc]);

    // wide-mode body class follows the model geometry.
    useEffect(() => {
        document.body.classList.toggle('wide-mode', chrome.modelKey === '27x132');
    }, [chrome.modelKey]);

    // Design overlay projection: one fetch; a 404 keeps the default conversion.
    useEffect(() => {
        let live = true;
        loadDesignOverrides().then((result) => {
            if (!live) return;
            setDesignOverrides(result.overrides);
            if (result.error) console.warn('[dspf·rad] design overlay disabled:', result.error);
        });
        return () => { live = false; };
    }, []);

    // ---- toolbar handlers ------------------------------------------------
    const onModelChange = (ev) => {
        doc.setModel(ev.target.value);
        requestAnimationFrame(() => designerRef.current?.forceResize());
        setTimeout(() => designerRef.current?.forceResize(), 60);
    };
    const onRecordChange = (ev) => {
        doc.setActiveRecord(parseInt(ev.target.value, 10));
        designerRef.current?.selectItem(null);
    };
    const onNewDoc = () => {
        if (!confirm('Discard the current design?')) return;
        doc.reset();
        designerRef.current?.selectItem(null);
        paletteRef.current?.clearArmed();
    };
    const onAddRecord = () => {
        const name = prompt('New record format name:', `R${doc.records.length + 1}`);
        if (name == null) return;
        doc.addRecord(name);
    };
    const onAddSubfile = () => {
        const base = prompt('Subfile base name (creates <BASE> + <BASE>C):', 'SFL');
        if (base == null) return;
        const { sflctl } = doc.addSubfile(base);
        const sflName = doc.records[doc.records.length - 2].name;
        flash(`Created subfile pair: ${sflName} + ${sflctl.name}.`, 'ok');
    };
    const onRenameRecord = () => {
        const cur = doc.activeRecord.name;
        const name = prompt('Rename record format:', cur);
        if (name == null || name === cur) return;
        doc.renameRecord(doc.activeRecordIndex, name);
    };
    const onDeleteRecord = () => {
        if (doc.records.length === 1) {
            flash('At least one record is required.', 'error');
            return;
        }
        if (!confirm(`Delete record ${doc.activeRecord.name}?`)) return;
        doc.deleteRecord(doc.activeRecordIndex);
    };
    const onToggleOverlay = () => doc.setShowOverlay(!doc.showOverlay);
    const onToggleHideCond = () => doc.setHideConditioned(!doc.hideConditioned);

    // ---- export handlers --------------------------------------------------
    const onGenRpgle = () => {
        const dspfName = (doc.records[0]?.name || 'DSPF').toUpperCase().slice(0, 10);
        const prog = prompt('Program name (max 10 chars, RPGLE):', dspfName + 'R')?.toUpperCase().slice(0, 10);
        if (!prog) return;
        const src = generateRpgle(doc, { programName: prog, dspfName });
        downloadText(prog + '.RPGLE', src);
        flash(`Generated ${prog}.RPGLE skeleton.`, 'ok');
    };
    const onGenCobol = () => {
        const dspfName = (doc.records[0]?.name || 'DSPF').toUpperCase().slice(0, 10);
        const prog = prompt('Program name (max 10 chars, COBOL):', dspfName + 'C')?.toUpperCase().slice(0, 10);
        if (!prog) return;
        const src = generateCobol(doc, { programName: prog, dspfName });
        downloadText(prog + '.CBLLE', src);
        flash(`Generated ${prog}.CBLLE skeleton.`, 'ok');
    };
    const onGenReact = () => {
        const contract = buildMappingContract(buildCompleteSemanticIR(doc), { overrides: designOverrides });
        downloadText('dspf-react-output.json', JSON.stringify(generateReactApp(contract), null, 2));
        flash('Generated React/Vite app artifact map.', 'ok');
    };
    const onGenSpring = () => {
        const contract = buildMappingContract(buildCompleteSemanticIR(doc), { overrides: designOverrides });
        downloadText('dspf-spring-output.json', JSON.stringify(generateSpringBootApp(contract), null, 2));
        flash('Generated Spring Boot artifact map.', 'ok');
    };

    const onExportJson = async () => {
        const json = JSON.stringify(doc.toJSON(), null, 2);
        console.log(json);
        try {
            await navigator.clipboard.writeText(json);
            flash('Internal model copied to clipboard.', 'ok');
        } catch {
            flash('Internal model dumped to console.', 'ok');
        }
    };

    // ---- render ------------------------------------------------------------
    const rec = chrome.records[chrome.activeRecordIndex];
    return (
        <div className="window app-window">
            <div className="title-bar">
                <div className="title-bar-text">
                    <span className="app-brand-mark">DSPF</span> · RAD — IronTerm Display File Designer
                </div>
            </div>

            <div className="app-body">
                <menu id="menubar" role="menubar">
                    <li className="menu" data-menu="file">
                        <button className="menu-title" type="button"><u>F</u>ile</button>
                        <ul className="menu-dropdown" role="menu">
                            <li><button className="menu-item" data-cmd="newDoc">
                                <span className="menu-label"><u>N</u>ew</span>
                                <span className="menu-accel">Ctrl+N</span>
                            </button></li>
                            <li><button className="menu-item" data-cmd="openDoc">
                                <span className="menu-label"><u>O</u>pen…</span>
                                <span className="menu-accel">Ctrl+O</span>
                            </button></li>
                            <li><button className="menu-item" data-cmd="saveDoc">
                                <span className="menu-label"><u>S</u>ave</span>
                                <span className="menu-accel">Ctrl+S</span>
                            </button></li>
                        </ul>
                    </li>

                    <li className="menu" data-menu="export">
                        <button className="menu-title" type="button"><u>E</u>xport</button>
                        <ul className="menu-dropdown" role="menu">
                            <li><button className="menu-item" data-cmd="genRpgle">
                                <span className="menu-label">Generate <u>R</u>PGLE skeleton…</span>
                            </button></li>
                            <li><button className="menu-item" data-cmd="genCobol">
                                <span className="menu-label">Generate <u>C</u>OBOL skeleton…</span>
                            </button></li>
                            <li className="menu-separator"></li>
                            <li><button className="menu-item" data-cmd="exportJson">
                                <span className="menu-label">Copy model as <u>J</u>SON (debug)</span>
                            </button></li>
                        </ul>
                    </li>

                    <li className="menu" data-menu="help">
                        <button className="menu-title" type="button"><u>H</u>elp</button>
                        <ul className="menu-dropdown" role="menu">
                            <li><button className="menu-item" data-cmd="about">
                                <span className="menu-label"><u>A</u>bout DSPF·RAD…</span>
                            </button></li>
                        </ul>
                    </li>

                    <li className="menubar-spacer" aria-hidden="true"></li>
                    <li className="menubar-info">
                        <button id="themeToggle" type="button" className="theme-toggle"
                                title="Toggle light/dark theme" aria-label="Toggle theme">☀</button>
                        <span className="hint" title="Drag from palette · Click to select · Arrow keys to nudge (Shift = ×5) · Del to remove">drag·click·arrows·Del</span>
                        <span id="status" className={'toolbar-status' + (flashState.cls ? ' ' + flashState.cls : '')}>{flashState.text}</span>
                    </li>
                </menu>

                <div id="toolbar" className="toolbar-row">
                    <label className="lbl">Model
                        <select id="modelSel" ref={modelSelRef} value={chrome.modelKey} onChange={onModelChange} title="Display file geometry">
                            <option value="24x80">24×80 (5251-11)</option>
                            <option value="27x132">27×132 (3477-FC)</option>
                        </select>
                    </label>

                    <span className="sep" aria-hidden="true"></span>

                    <label className="lbl">Record
                        <select id="recordSel" value={chrome.activeRecordIndex} onChange={onRecordChange} title="Active record format">
                            {chrome.records.map((r, i) => (
                                <option key={r.name + i} value={i}>
                                    {r.name}{r.type !== 'RECORD' ? ` [${r.type}]` : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button id="addRecord"    title="Add a new record format" onClick={onAddRecord}>+R</button>
                    <button id="addSubfile"   title="Add a Subfile pair (SFL + SFLCTL) wired with defaults" onClick={onAddSubfile}>+SFL</button>
                    <button id="renameRecord" title="Rename the active record format" onClick={onRenameRecord}>⇄</button>
                    <button id="deleteRecord" title="Delete the active record format" onClick={onDeleteRecord}
                            disabled={chrome.records.length === 1}>−R</button>

                    <span className="sep" aria-hidden="true"></span>

                    <button id="hideReactPreviewToggle" className={'toggle' + (!faithfulPreviewEnabled ? ' on' : '')}
                            aria-pressed={!faithfulPreviewEnabled}
                            title="Hide or show the faithful React Preview pane"
                            onClick={() => setFaithfulPreviewEnabled((value) => !value)}>
                        {faithfulPreviewEnabled ? 'Hide React' : 'Show React'}
                    </button>
                    <button id="overlayToggle" className={'toggle' + (chrome.showOverlay ? ' on' : '')}
                            title="Render the other records faded behind the active one" onClick={onToggleOverlay}>Overlay</button>
                    <button id="genRpgle" title="Generate RPGLE skeleton with protected regions" onClick={onGenRpgle}>↗ RPGLE</button>
                    <button id="genCobol" title="Generate COBOL skeleton with protected regions" onClick={onGenCobol}>↗ COBOL</button>
                    <button id="genReact" title="Generate standalone React/Vite artifact" onClick={onGenReact}>↗ React</button>
                    <button id="genSpring" title="Generate Spring Boot artifact" onClick={onGenSpring}>↗ Spring</button>
                    <button id="exportJson" title="Copy internal model as JSON (debug)" onClick={onExportJson}>{`{·}`}</button>
                </div>

                <div id="legacyControls" hidden>
                    <button id="newDoc"  title="Discard the current design and start fresh" onClick={onNewDoc}>New</button>
                    <button id="openDoc" title="Open DSPF source">Open…</button>
                    <button id="saveDoc" title="Generate DSPF source">Save</button>
                    <input id="fileInput" ref={fileInputRef} type="file" />

                    <button id="genRpgle" title="Generate RPGLE skeleton with protected regions" onClick={onGenRpgle}>↗ RPGLE</button>
                    <button id="genCobol" title="Generate COBOL skeleton with protected regions" onClick={onGenCobol}>↗ COBOL</button>
                    <button id="exportJson" title="Copy internal model as JSON (debug)" onClick={onExportJson}>{`{·}`}</button>
                </div>

                <div className="workspace">
                    <aside className="window panel palette" id="palette" ref={paletteElRef}>
                        <div className="title-bar">
                            <div className="title-bar-text">Palette</div>
                        </div>
                        <div className="panel-body">
                            {PALETTE_GROUPS.map((g) => (
                                <div className="palette-group" key={g.title}>
                                    <h4>{g.title}</h4>
                                    {g.items.map((it) => (
                                        <div className="palette-item" draggable="true" key={it.label} {...paletteAttrs(it)}>
                                            <span className="pi-icon">{it.icon}</span><span className="pi-label">{it.label}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                            <p className="palette-hint">
                                Drag onto the grid <em>or</em> click an item then click the grid (click-to-place).
                            </p>
                        </div>
                    </aside>

                    <main className="canvas-wrap">
                        <div className="canvas-frame" id="canvasFrame">
                            <canvas id="grid" ref={canvasRef} tabIndex="0"></canvas>
                        </div>
                        <div className={'canvas-help' + (chrome.itemCount > 0 ? ' hidden' : '')} id="canvasHelp">
                            Drag a widget from the palette onto the grid.
                        </div>
                    </main>

                    <div className={'preview-resize-handle' + (!faithfulPreviewEnabled ? ' is-hidden' : '')}
                         ref={previewResizeRef} role="separator"
                         aria-label="Resize React preview pane" aria-orientation="vertical"
                         aria-hidden={!faithfulPreviewEnabled}></div>

                    <aside className={'window panel preview' + (!faithfulPreviewEnabled ? ' is-hidden' : '')}
                           id="reactGridPane" aria-hidden={!faithfulPreviewEnabled}>
                        <div className="title-bar">
                            <div className="title-bar-text">React Preview</div>
                        </div>
                        <div className="panel-body preview-body">
                            <DspfGrid doc={doc} bus={bus}
                                      onSelect={(id) => designerRef.current?.selectItem(id)}
                                      onPlace={(spec, cell) => designerRef.current?.placeFromSpec(spec, cell)}
                                      onPlaceArmed={() => paletteRef.current?.getArmedSpec() ?? null} />
                        </div>
                    </aside>
                    <div className={'converted-resize-handle' + (!convertedEnabled ? ' is-hidden' : '')}
                         ref={convertedResizeRef} role="separator"
                         aria-label="Resize Modern React pane" aria-orientation="vertical"
                         aria-hidden={!convertedEnabled}></div>

                    <aside className="window panel converted"
                           id="convertedPane" data-enabled={convertedEnabled ? 'true' : 'false'}>
                        <div className="title-bar">
                            <div className="title-bar-text">Modern React</div>
                            <div className="title-bar-controls">
                                <button type="button" className="converted-toggle"
                                        aria-pressed={convertedEnabled}
                                        onClick={() => setConvertedEnabled((value) => !value)}>
                                    {convertedEnabled ? 'On' : 'Off'}
                                </button>
                            </div>
                        </div>
                        <div className="panel-body converted-body">
                            <ConvertedPane doc={doc} bus={bus} enabled={convertedEnabled} overrides={designOverrides} />
                        </div>
                    </aside>

                    <aside className="window panel inspector" id="inspector">
                        <div className="title-bar">
                            <div className="title-bar-text">Inspector</div>
                        </div>
                        <div className="panel-body">
                            <InspectorForm doc={doc} bus={bus} />
                        </div>
                        <TestPanel doc={doc} />
                    </aside>
                </div>

                <div className="resize-handle" id="resizeHandle" role="separator"
                     aria-label="Resize source panel" aria-orientation="horizontal"></div>

                <section className="window source-panel" id="sourcePanel">
                    <div className="title-bar">
                        <div className="title-bar-text">Source — DSPF</div>
                        <div className="title-bar-controls">
                            <button id="sourceCollapse" className="source-collapse"
                                    title="Hide source panel">▾</button>
                        </div>
                    </div>
                    <div className="source-toolbar">
                        <button id="cursorColToggle" className="source-chip"
                                title="Vertical column marker at cursor position">┃ col</button>
                        <span className="source-toolbar-spacer"></span>
                        <span className="source-status ok" id="sourceStatus" ref={sourceStatusRef} title="Sync state">sync</span>
                    </div>
                    <div className="source-editor" id="sourceEditor" ref={sourceElRef}></div>
                </section>

                <div id="statusbar" className="status-bar" role="status" aria-live="polite">
                    <p className="status-bar-field" id="sbModel"  title="Display model">{chrome.modelLabel}</p>
                    <p className="status-bar-field" id="sbRecord" title="Active record">
                        {rec ? rec.name + (rec.type !== 'RECORD' ? ` · ${rec.type}` : '') : '—'}
                    </p>
                    <p className="status-bar-field" id="sbItems"  title="Item count in active record">{chrome.itemCount} items</p>
                    <p className="status-bar-field" id="sbCursor" title="Grid cursor (row, col)">(–,–)</p>
                </div>
            </div>
        </div>
    );
}
