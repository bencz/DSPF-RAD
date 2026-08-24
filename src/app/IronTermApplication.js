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

import { MenubarController } from '../workbench/chrome/MenubarController.js';
import { makeChromeSync } from './chromeSync.js';
import { bindSourceSync } from './sourceSync.js';
import { bindPanelResize } from './panelResize.js';
import { initTheme }      from './Theme.js';
import { recoverAutosave, bindPersistence } from './persistence.js';
import { bindProblemsPanel } from './problemsPanel.js';
import { bindSimulator } from './simulator.js';
import { bindRecordTree } from './recordTree.js';
import { bindDatabaseImportDialog } from './databaseImportDialog.js';
import { bindKeyFlowDialog } from './keyFlowDialog.js';
import { bindFindDialog } from './findDialog.js';
import { validateDspf }   from '../validation/validateDspf.js';
import { PRODUCT }        from '../product.js';
import { createPlatformServices } from '../platform/index.js';
import { HostStatusController } from '../workbench/status/HostStatusController.js';
import { ConnectionStatusController } from '../workbench/status/ConnectionStatusController.js';
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
import { ConnectionProfileStore } from '../features/ibmi-connections/model/ConnectionProfileStore.js';
import { IbmiConnectionService } from '../features/ibmi-connections/IbmiConnectionService.js';
import { ConnectionController } from '../features/ibmi-connections/ConnectionController.js';
import { WorkbenchDocumentService } from '../workbench/documents/WorkbenchDocumentService.js';
import { WorkbenchNavigationController } from '../workbench/documents/WorkbenchNavigationController.js';
import { WorkbenchLayoutController } from '../workbench/chrome/WorkbenchLayoutController.js';
import { StartPageController } from '../workbench/start/StartPageController.js';
import { DspfDocumentCoordinator } from '../features/dspf-designer/DspfDocumentCoordinator.js';
import { DspfFileController } from '../features/dspf-designer/DspfFileController.js';
import { DspfTemplateController } from '../features/dspf-designer/DspfTemplateController.js';
import { WorkbenchView } from '../workbench/views/WorkbenchView.js';
import { WorkbenchDialogService } from '../workbench/ui/dialogs/WorkbenchDialogService.js';
import { WorkbenchDialogView } from '../workbench/ui/dialogs/WorkbenchDialogView.js';
import { createLanguageServices } from '../languages/createLanguageServices.js';
import { SourceCodeDocumentService } from '../features/source-code/SourceCodeDocumentService.js';
import { SourceCodeEditor } from '../features/source-code/SourceCodeEditor.js';
import { SourceCodeEditorController } from '../features/source-code/SourceCodeEditorController.js';
import { ProjectExplorerController } from '../workbench/explorer/ProjectExplorerController.js';

export class IronTermApplication {
    constructor ({
        documentRef = globalThis.document,
        windowRef = globalThis.window,
        storage = globalThis.localStorage,
        logger = globalThis.console,
    } = {}) {
        this.document = documentRef;
        this.window = windowRef;
        this.storage = storage;
        this.logger = logger;
    }

    async start () {
        this.logger.log('%c[ironterm]', 'color:#6f6',
            `boot - ${PRODUCT.name} ${PRODUCT.version}`);
        new WorkbenchView({ documentRef: this.document }).mount();
        initTheme();
        const dialogs = new WorkbenchDialogService({
            view: new WorkbenchDialogView({
                documentRef: this.document,
                windowRef: this.window,
            }),
        });
        dialogs.start();

        const els = this.#collectDomRefs();
        const platform = createPlatformServices({
            documentRef: this.document,
            urlRef: this.window.URL,
            logger: this.logger,
        });
        const { host, ibmiConnections, desktopWindow } = platform;
        desktopWindow.start();
        const commands = new CommandRegistry();
        const languageServices = createLanguageServices();
        const hostStatus = new HostStatusController({ element: els.sbHost, host });
        hostStatus.render();

        const doc = new DspfDocument();
        const recovered = await recoverAutosave(doc, dialogs);
        doc.resetHistory({ markClean: !recovered });
        const workbenchDocuments = new WorkbenchDocumentService();
        const dspfDocument = new DspfDocumentCoordinator({
            documentModel: doc,
            workbenchDocuments,
        });
        dspfDocument.start();
        const sourceCodeDocuments = new SourceCodeDocumentService({
            workbenchDocuments,
        });

        const workspace = Workspace.createScratch();
        const workspaceSession = new WorkspaceSession({ workspace });
        const workspaceStatus = new WorkspaceStatusController({
            element: els.sbWorkspace, session: workspaceSession,
        });
        workspaceStatus.start();

        const connectionProfiles = new ConnectionProfileStore({
            storage: this.storage,
            logger: this.logger,
        }).load();
        const ibmiConnection = new IbmiConnectionService({
            profiles: connectionProfiles,
            port: ibmiConnections,
        });
        const connectionStatus = new ConnectionStatusController({
            element: els.sbConnection,
            service: ibmiConnection,
            profiles: connectionProfiles,
        });
        connectionStatus.start();

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
            dialogs,
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
        const sourceCodeEditor = new SourceCodeEditor({
            parent: this.#element('sourceCodeEditorHost'),
            languageServices,
            onDocumentChanged: (document, text) => document.replaceText(text),
            onCursorChanged: ({ line, column }) => {
                els.sbSourcePosition.textContent = `Ln ${line}, Col ${column}`;
            },
        });
        const sourceCodeController = new SourceCodeEditorController({
            documents: sourceCodeDocuments,
            workbenchDocuments,
            workspaceSession,
            editor: sourceCodeEditor,
            languageServices,
            commands,
            host,
            dialogs,
            flash,
            elements: {
                tabs: this.#element('sourceCodeTabs'),
                language: this.#element('sourceCodeLanguage'),
                resource: this.#element('sourceCodeResource'),
                save: this.#element('sourceCodeSave'),
                close: this.#element('sourceCodeClose'),
                statusLanguage: els.sbLanguage,
            },
            logger: this.logger,
        });
        sourceCodeController.start();
        bindPersistence(doc);
        const dspfFiles = new DspfFileController({
            documentModel: doc,
            coordinator: dspfDocument,
            designer,
            modelSelect: els.modelSel,
            host,
            commands,
            flash,
            flushSource: sourceSync.flush,
            documentRef: this.document,
            windowRef: this.window,
            dialogs,
            logger: this.logger,
        });
        dspfFiles.start();
        const toolbar = new DspfToolbarController({
            doc, designer, elements: els, flash,
            documentRef: this.document,
            windowRef: this.window,
            dialogs,
        });
        toolbar.start();
        const dspfTemplates = new DspfTemplateController({
            documentModel: doc,
            coordinator: dspfDocument,
            designer,
            palette,
            commands,
            flash,
            flushSource: sourceSync.flush,
            documentRef: this.document,
            dialogs,
        });
        dspfTemplates.start();
        bindDatabaseImportDialog({
            doc, designer, host, flash, flushSource: sourceSync.flush,
        });
        bindKeyFlowDialog({ doc, flash, flushSource: sourceSync.flush });
        bindFindDialog({ doc, designer, flushSource: sourceSync.flush });
        bindSimulator({ doc, designer, flash });
        bindRecordTree({ doc, designer });

        const codeGeneration = new CodeGenerationController({
            doc, host, commands, coordinator: dspfDocument,
            flash, flushSource: sourceSync.flush,
            navigatorRef: this.window.navigator,
            dialogs,
            logger: this.logger,
        });
        codeGeneration.start();

        const commandRegistrar = new WorkbenchCommandRegistrar({
            registry: commands, product: PRODUCT, documents: workbenchDocuments,
            documentRef: this.document,
            dialogs,
        });
        commandRegistrar.start();
        const navigation = new WorkbenchNavigationController({
            documents: workbenchDocuments,
            commands,
        });
        navigation.start();
        const workspaceController = new WorkspaceController({
            session: workspaceSession, commands, host, flash,
            dialogs,
            logger: this.logger,
        });
        workspaceController.start();
        const projectExplorer = new ProjectExplorerController({
            element: this.#element('projectExplorerTree'),
            summaryElement: this.#element('projectExplorerSummary'),
            workspaceSession,
            sourceDocuments: sourceCodeDocuments,
            workbenchDocuments,
            commands,
            logger: this.logger,
        });
        projectExplorer.start();
        const connectionController = new ConnectionController({
            service: ibmiConnection,
            profiles: connectionProfiles,
            workspaceSession,
            commands,
            flash,
        });
        connectionController.start();

        const shortcuts = new DspfShortcutController({
            commands, documents: workbenchDocuments, designer, palette,
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
        const layout = new WorkbenchLayoutController({
            documents: workbenchDocuments,
            startPage: els.startPage,
            dspfSurface: els.dspfEditorSurface,
            sourceCodeSurface: els.sourceCodeSurface,
            dspfStatusElements: [
                els.sbModel, els.sbRecord, els.sbItems, els.sbCursor, els.sbDirty,
            ],
            sourceCodeStatusElements: [els.sbLanguage, els.sbSourcePosition],
            interactionHint: els.interactionHint,
            documentRef: this.document,
            windowRef: this.window,
            onDspfShown: () => designer.forceResize(),
        });
        layout.start();
        const startPage = new StartPageController({
            element: els.startPage,
            commands,
            documents: workbenchDocuments,
            workspaceSession,
            connectionService: ibmiConnection,
            host,
            logger: this.logger,
        });
        startPage.start();
        const menubar = new MenubarController({
            commands, documentRef: this.document, logger: this.logger,
        });
        menubar.start();
        if (recovered) {
            dspfDocument.open();
            flash('Recovered unsaved work from the previous session.', 'ok', 4000);
        }

        // Console debugging surface.
        this.window.ironTermStudio = {
            product: PRODUCT,
            host: host.describe(),
            platform: Object.freeze({
                host: host.describe(),
                ibmiConnections: ibmiConnections.describe(),
                desktopWindow: Object.freeze({ available: desktopWindow.available }),
            }),
            connectionProfiles,
            ibmiConnection,
            dialogs,
            languageServices,
            documents: workbenchDocuments,
            sourceCodeDocuments,
            sourceCodeEditor,
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
                dspfDocument.open();
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
            startPage:    this.#element('startPage'),
            dspfEditorSurface: this.#element('dspfEditorSurface'),
            sourceCodeSurface: this.#element('sourceCodeSurface'),
            interactionHint: this.#element('interactionHint'),
            helpEl:       this.#element('canvasHelp'),
            overlayBtn:   this.#element('overlayToggle'),
            hideCondBtn:  this.#element('hideCondToggle'),
            deleteBtn:    this.#element('deleteRecord'),
            sbHost:       this.#element('sbHost'),
            sbConnection: this.#element('sbConnection'),
            sbWorkspace:  this.#element('sbWorkspace'),
            sbModel:      this.#element('sbModel'),
            sbRecord:     this.#element('sbRecord'),
            sbItems:      this.#element('sbItems'),
            sbCursor:     this.#element('sbCursor'),
            sbDirty:      this.#element('sbDirty'),
            sbLanguage:   this.#element('sbLanguage'),
            sbSourcePosition: this.#element('sbSourcePosition'),
            undoBtn:      this.#element('undoDoc'),
            redoBtn:      this.#element('redoDoc'),
            recordUpBtn:  this.#element('recordUp'),
            recordDownBtn: this.#element('recordDown'),
        };
    }

}
