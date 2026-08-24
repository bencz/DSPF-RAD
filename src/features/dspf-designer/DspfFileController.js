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
        confirmRef = globalThis.confirm,
        logger = globalThis.console,
    }) {
        if (!documentModel) throw new TypeError('DspfFileController requires a DSPF document.');
        if (!coordinator) throw new TypeError('DspfFileController requires a document coordinator.');
        if (!designer) throw new TypeError('DspfFileController requires a designer.');
        if (!host) throw new TypeError('DspfFileController requires a host.');
        if (!commands) throw new TypeError('DspfFileController requires commands.');
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
        this.confirm = confirmRef;
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
        if (!this.#confirmReplace('Open another DSPF source')) return false;
        try {
            const file = await this.host.openTextFile({ accept: '.dspf,.dds,.txt' });
            if (!file) return false;
            const parsed = parseDspf(file.text);
            this.documentModel.adopt(parsed, { preserveAidActions: false });
            this.documentModel.sourceName = ibmiName(file.name.replace(/\.[^.]+$/, ''), 'DSPFILE');
            this.documentModel.resetHistory({ markClean: true });
            this.#showLoadedDocument();
            this.flash?.(
                `Loaded ${file.name}: ${this.documentModel.records.length} records, ` +
                `${this.documentModel.itemCount()} items.`, 'ok');
            return true;
        } catch (error) {
            this.#reportFailure('Open', error);
            return false;
        }
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
        if (!this.#confirmReplace('Open another RAD design project')) return false;
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
            this.documentModel.sourceName = restored.sourceName;
            this.documentModel.showOverlay = restored.showOverlay;
            this.documentModel.hideConditioned = restored.hideConditioned;
            this.documentModel.adopt(restored, { preserveAidActions: false });
            this.documentModel.resetHistory({ markClean: true });
            this.#showLoadedDocument();
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

    #showLoadedDocument () {
        this.modelSelect.value = this.documentModel.modelKey;
        this.document.body.classList.toggle('wide-mode', this.documentModel.modelKey === '27x132');
        this.designer.selectItem(null);
        this.coordinator.open();
        this.window.requestAnimationFrame(() => this.designer.forceResize());
    }

    #confirmReplace (action) {
        return !this.coordinator.isOpen || !this.documentModel.isDirty ||
            this.confirm(`${action} and discard unsaved changes?`);
    }

    #reportFailure (operation, error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[ironterm] ${operation.toLowerCase()} failed:`, error);
        this.flash?.(`${operation} failed: ${message}`, 'error', 5000);
    }
}
