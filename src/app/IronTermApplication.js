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
import { MenubarController } from '../workbench/chrome/MenubarController.js';
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
import { CodeGenerationController } from '../features/code-generation/CodeGenerationController.js';
import { DspfToolbarController } from '../features/dspf-designer/DspfToolbarController.js';
import { DspfShortcutController } from '../features/dspf-designer/DspfShortcutController.js';
import { CanvasStatusController } from '../features/dspf-designer/CanvasStatusController.js';
import { ColumnMarkerPreferenceController } from '../features/source-editor/ColumnMarkerPreferenceController.js';
import { CommandRegistry } from '../workbench/commands/CommandRegistry.js';
import { WorkbenchCommandRegistrar } from '../workbench/commands/WorkbenchCommandRegistrar.js';
import { Workspace } from '../workbench/workspace/Workspace.js';
import { WorkspaceSession } from '../workbench/workspace/WorkspaceSession.js';
import { WorkspaceController } from '../workbench/workspace/WorkspaceController.js';
import { WorkspaceStatusController } from '../workbench/status/WorkspaceStatusController.js';
import { StatusMessageController } from '../workbench/status/StatusMessageController.js';

export class IronTermApplication {
    constructor ({
        documentRef = globalThis.document,
        windowRef = globalThis.window,
        storage = globalThis.localStorage,
        promptRef = globalThis.prompt,
        confirmRef = globalThis.confirm,
        logger = globalThis.console,
    } = {}) {
        this.document = documentRef;
        this.window = windowRef;
        this.storage = storage;
        this.prompt = promptRef.bind(windowRef);
        this.confirm = confirmRef.bind(windowRef);
        this.logger = logger;
    }

    start () {
        this.logger.log('%c[ironterm]', 'color:#6f6',
            `boot - ${PRODUCT.name} ${PRODUCT.version}`);
        initTheme();

        const els = this.#collectDomRefs();
        const host = createHostBridge({
            documentRef: this.document,
            urlRef: this.window.URL,
        });
        const commands = new CommandRegistry();
        const hostStatus = new HostStatusController({ element: els.sbHost, host });
        hostStatus.render();

        const doc = new DspfDocument();
        seedDemo(doc);
        const recovered = recoverAutosave(doc);
        doc.resetHistory({ markClean: !recovered });

        const workspace = Workspace.createScratch({ projectName: doc.sourceName });
        const workspaceSession = new WorkspaceSession({ workspace });
        const workspaceStatus = new WorkspaceStatusController({
            element: els.sbWorkspace, session: workspaceSession,
        });
        workspaceStatus.start();

        // Inspector / Palette / Designer selection wiring.
        let selectFromInspector = () => {};
        const inspector = new Inspector(this.#element('inspectorBody'), {
            documentRef:     () => doc,
            activeRecordRef: () => doc.activeRecord,
            onItemPatch:   (id, patch) => doc.updateItem(id, patch),
            onItemDelete:  id => doc.removeItem(id),
            onRecordPatch: patch => {
                if (patch.name != null) doc.renameRecord(doc.activeRecordIndex, patch.name);
                if (patch.type != null) doc.setRecordType(doc.activeRecordIndex, patch.type);
            },
            onChange:     () => doc.emit(),
            onSelectItem: id => selectFromInspector(id),
        });

        const palette = new Palette(this.#element('palette'));
        const refreshChrome = makeChromeSync({ doc, els });
        const designer = new Designer({
            canvas: els.canvas,
            document: doc,
            inspector,
            palette,
            onChange: refreshChrome,
        });
        selectFromInspector = id => designer.selectItem(id);

        // Source editor + bidirectional canvas/source bridge.
        const sourceEditor = new SourceEditor(this.#element('sourceEditor'));
        const sourceSync = bindSourceSync({
            doc, designer, sourceEditor,
            sourceStatusEl: this.#element('sourceStatus'),
        });
        bindProblemsPanel({ doc, designer, sourceEditor });
        bindPanelResize({
            designer,
            handle:      this.#element('resizeHandle'),
            collapseBtn: this.#element('sourceCollapse'),
        });
        const columnMarker = new ColumnMarkerPreferenceController({
            sourceEditor,
            toggleElement: this.#element('cursorColToggle'),
            storage: this.storage,
        });
        columnMarker.start();

        // Feature and workbench controller assembly.
        const statusMessages = new StatusMessageController({
            element: els.statusEl, windowRef: this.window,
        });
        const flash = statusMessages.show;
        bindPersistence(doc);
        bindFileIO({
            doc, designer, modelSel: els.modelSel, host, flash,
            flushSource: sourceSync.flush,
        });
        const toolbar = new DspfToolbarController({
            doc, designer, elements: els, flash,
            documentRef: this.document,
            windowRef: this.window,
            promptRef: this.prompt,
            confirmRef: this.confirm,
        });
        toolbar.start();
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

        const codeGeneration = new CodeGenerationController({
            doc, host, flash, flushSource: sourceSync.flush,
            documentRef: this.document,
            navigatorRef: this.window.navigator,
            promptRef: this.prompt,
            confirmRef: this.confirm,
            alertRef: this.window.alert.bind(this.window),
            logger: this.logger,
        });
        codeGeneration.start();

        const commandRegistrar = new WorkbenchCommandRegistrar({
            registry: commands, product: PRODUCT,
            documentRef: this.document,
            alertRef: this.window.alert.bind(this.window),
        });
        commandRegistrar.start();
        const workspaceController = new WorkspaceController({
            session: workspaceSession, commands, host, flash,
            promptRef: this.prompt,
            confirmRef: this.confirm,
            logger: this.logger,
        });
        workspaceController.start();

        const shortcuts = new DspfShortcutController({
            commands, designer, palette,
            documentRef: this.document,
            logger: this.logger,
        });
        shortcuts.start();
        const canvasStatus = new CanvasStatusController({
            canvas: els.canvas,
            cursorElement: els.sbCursor,
            designer,
            palette,
        });
        canvasStatus.start();

        // First paint + workbench chrome.
        refreshChrome();
        const menubar = new MenubarController({
            commands, documentRef: this.document, logger: this.logger,
        });
        menubar.start();
        if (recovered) flash('Recovered unsaved work from the previous session.', 'ok', 4000);

        // Console debugging surface.
        this.window.ironTermStudio = {
            product: PRODUCT,
            host: host.describe(),
            workspace: () => workspaceSession.workspace,
            workspaceSession,
            doc, designer, palette,
            commands: () => commands.list(),
            parse: source => parseDspf(source),
            write: () => writeDspf(doc),
            validate: options => validateDspf(doc, options),
            load: source => {
                doc.adopt(parseDspf(source));
                designer.selectItem(null);
            },
        };
        // Temporary compatibility alias for existing console snippets.
        this.window.dspfRad = this.window.ironTermStudio;
        return this.window.ironTermStudio;
    }

    // ---- DOM references -------------------------------------------------

    #element (id) {
        return this.document.getElementById(id);
    }

    #collectDomRefs () {
        return {
            canvas:       this.#element('grid'),
            modelSel:     this.#element('modelSel'),
            recordSel:    this.#element('recordSel'),
            statusEl:     this.#element('status'),
            helpEl:       this.#element('canvasHelp'),
            overlayBtn:   this.#element('overlayToggle'),
            hideCondBtn:  this.#element('hideCondToggle'),
            deleteBtn:    this.#element('deleteRecord'),
            sbHost:       this.#element('sbHost'),
            sbWorkspace:  this.#element('sbWorkspace'),
            sbModel:      this.#element('sbModel'),
            sbRecord:     this.#element('sbRecord'),
            sbItems:      this.#element('sbItems'),
            sbCursor:     this.#element('sbCursor'),
            sbDirty:      this.#element('sbDirty'),
            undoBtn:      this.#element('undoDoc'),
            redoBtn:      this.#element('redoDoc'),
            recordUpBtn:  this.#element('recordUp'),
            recordDownBtn: this.#element('recordDown'),
        };
    }

}
