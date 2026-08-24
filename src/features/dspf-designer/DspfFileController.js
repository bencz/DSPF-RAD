import { ibmiName } from '../../model/factories.js';
import { DspfDocument } from '../../model/DspfDocument.js';
import { parseDspf } from '../../parser/parseDspf.js';
import { HostCapability } from '../../platform/host/capabilities.js';
import { writeDspf } from '../../writer/writeDspf.js';
import { WorkbenchCommand } from '../../workbench/commands/commandIds.js';

export class DspfFileController {
    #unregister = [];

    constructor ({
        documentModel,
        coordinator,
        designer,
        modelSelect,
        host,
        commands,
        flash,
        flushSource,
        documentRef = globalThis.document,
        windowRef = globalThis.window,
        dialogs,
        logger = globalThis.console,
    }) {
        if (!documentModel) throw new TypeError('DspfFileController requires a DSPF document.');
        if (!coordinator) throw new TypeError('DspfFileController requires a document coordinator.');
        if (!designer) throw new TypeError('DspfFileController requires a designer.');
        if (!host) throw new TypeError('DspfFileController requires a host.');
        if (!commands) throw new TypeError('DspfFileController requires commands.');
        if (!dialogs) throw new TypeError('DspfFileController requires dialogs.');
        this.documentModel = documentModel;
        this.coordinator = coordinator;
        this.designer = designer;
        this.modelSelect = modelSelect;
        this.host = host;
        this.commands = commands;
        this.flash = flash;
        this.flushSource = flushSource;
        this.document = documentRef;
        this.window = windowRef;
        this.dialogs = dialogs;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#unregister.push(
            this.commands.register({
                id: WorkbenchCommand.FILE_OPEN,
                title: 'Open DSPF source',
                category: 'File',
                execute: () => this.openSource(),
                isEnabled: () => this.host.supports(HostCapability.OPEN_LOCAL_TEXT),
            }),
            this.commands.register({
                id: WorkbenchCommand.FILE_SAVE,
                title: 'Save DSPF source',
                category: 'File',
                execute: () => this.saveSource(),
                isEnabled: () => this.coordinator.isActive &&
                    !this.coordinator.isReadOnly &&
                    this.host.supports(HostCapability.SAVE_LOCAL_TEXT),
            }),
            this.commands.register({
                id: WorkbenchCommand.PROJECT_OPEN,
                title: 'Open RAD design project',
                category: 'File',
                execute: () => this.openProject(),
                isEnabled: () => this.host.supports(HostCapability.OPEN_LOCAL_TEXT),
            }),
            this.commands.register({
                id: WorkbenchCommand.PROJECT_SAVE,
                title: 'Save RAD design project',
                category: 'File',
                execute: () => this.saveProject(),
                isEnabled: () => this.coordinator.isActive &&
                    this.host.supports(HostCapability.SAVE_LOCAL_TEXT),
            }),
        );
    }

    stop () {
        for (const unregister of this.#unregister.splice(0)) unregister();
    }

    async openSource () {
        this.flushSource?.();
        try {
            const file = await this.host.openTextFile({ accept: '.dspf,.dds,.txt' });
            if (!file) return false;
            this.#openParsedSource({
                text: file.text,
                sourceName: file.name.replace(/\.[^.]+$/, ''),
                title: file.name,
                resourceUri: `local:///${encodeURIComponent(file.name)}`,
            });
            this.flash?.(
                `Loaded ${file.name}: ${this.documentModel.records.length} records, ` +
                `${this.documentModel.itemCount()} items.`, 'ok');
            return true;
        } catch (error) {
            this.#reportFailure('Open', error);
            return false;
        }
    }

    async openRemoteSource ({ text, sourceName, title, resourceUri }) {
        if (this.coordinator.activateResource(resourceUri)) return true;
        this.flushSource?.();
        this.#openParsedSource({ text, sourceName, title, resourceUri, readOnly: true });
        this.flash?.(`Opened ${title} in the visual DSPF designer (remote read-only).`, 'ok');
        return true;
    }

    activateResource (resourceUri) {
        return this.coordinator.activateResource(resourceUri);
    }

    async close (documentId = this.coordinator.activeDocumentId) {
        const info = this.coordinator.documentInfo(documentId);
        if (!info) return false;
        if (info.isDirty && !await this.dialogs.confirm({
            title: 'Unsaved display file',
            message: `Close ${info.title} and discard unsaved changes?`,
            acceptLabel: 'Discard and close',
            danger: true,
        })) return false;
        return this.coordinator.close(documentId);
    }

    async saveSource () {
        try {
            this.flushSource?.();
            const source = writeDspf(this.documentModel);
            const name = `${this.documentModel.sourceName || 'DSPFILE'}.DSPF`;
            await this.host.saveTextFile({ suggestedName: name, text: source });
            if (!this.documentModel.aidActions.length) this.documentModel.markClean();
            this.flash?.(this.documentModel.aidActions.length
                ? `Exported ${name}. Save the RAD design project too to keep key actions.`
                : `Saved ${name}.`, 'ok', 5000);
            return true;
        } catch (error) {
            this.#reportFailure('Save', error);
            return false;
        }
    }

    async openProject () {
        this.flushSource?.();
        try {
            const file = await this.host.openTextFile({ accept: '.json,.dspfrad.json' });
            if (!file) return false;
            const data = JSON.parse(file.text);
            if (data.format && data.format !== 'DSPF-RAD') {
                throw new Error(`Unsupported project format: ${data.format}`);
            }
            const payload = data.document ?? data;
            if (!Array.isArray(payload?.records) || !payload.records.length) {
                throw new Error('The file does not contain a DSPF-RAD document.');
            }
            const restored = DspfDocument.fromJSON(payload);
            restored.resetHistory({ markClean: true });
            this.#showLoadedDocument({ documentModel: restored });
            this.flash?.(`Loaded RAD design project ${file.name}.`, 'ok');
            return true;
        } catch (error) {
            this.#reportFailure('Project open', error);
            return false;
        }
    }

    async saveProject () {
        try {
            this.flushSource?.();
            const project = {
                // Keep the established format identifier for backward compatibility.
                format: 'DSPF-RAD', version: 1,
                document: this.documentModel.toJSON(),
            };
            const name = `${this.documentModel.sourceName || 'DSPFILE'}.dspfrad.json`;
            await this.host.saveTextFile({
                suggestedName: name,
                text: JSON.stringify(project, null, 2) + '\n',
                mime: 'application/json;charset=utf-8',
            });
            this.documentModel.markClean();
            this.flash?.(`Saved RAD design project ${name}.`, 'ok');
            return true;
        } catch (error) {
            this.#reportFailure('Project save', error);
            return false;
        }
    }

    #openParsedSource ({ text, sourceName, title, resourceUri, readOnly = false }) {
        const parsed = parseDspf(text);
        parsed.sourceName = ibmiName(sourceName, 'DSPFILE');
        parsed.resetHistory({ markClean: true });
        this.#showLoadedDocument({
            documentModel: parsed,
            title,
            resourceUri,
            readOnly,
        });
    }

    #showLoadedDocument ({
        documentModel = this.documentModel,
        title = null,
        resourceUri = null,
        readOnly = false,
    } = {}) {
        this.coordinator.open({ documentModel, title, resourceUri, readOnly });
        this.modelSelect.value = this.documentModel.modelKey;
        this.document.body.classList.toggle('wide-mode', this.documentModel.modelKey === '27x132');
        this.designer.selectItem(null);
        this.window.requestAnimationFrame(() => this.designer.forceResize());
    }

    #reportFailure (operation, error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[ironterm] ${operation.toLowerCase()} failed:`, error);
        this.flash?.(`${operation} failed: ${message}`, 'error', 5000);
    }
}
