import {
    SCREEN_TEMPLATES, createTemplateDocument,
} from '../../templates/screenTemplates.js';
import { WorkbenchCommand } from '../../workbench/commands/commandIds.js';

export class DspfTemplateController {
    #abortController = null;
    #unregisterCommand = null;

    constructor ({
        documentModel,
        coordinator,
        designer,
        palette,
        commands,
        flash,
        flushSource,
        documentRef = globalThis.document,
    }) {
        if (!documentModel) throw new TypeError('DspfTemplateController requires a DSPF document.');
        if (!coordinator) throw new TypeError('DspfTemplateController requires a coordinator.');
        if (!commands) throw new TypeError('DspfTemplateController requires commands.');
        this.documentModel = documentModel;
        this.coordinator = coordinator;
        this.designer = designer;
        this.palette = palette;
        this.commands = commands;
        this.flash = flash;
        this.flushSource = flushSource;
        this.document = documentRef;
    }

    start () {
        this.stop();
        this.#collectElements();
        this.#populateTemplates();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;
        this.elements.kind.addEventListener('change', () => this.#renderDescription(), { signal });
        this.elements.toolbarButton?.addEventListener('click', () => this.openDialog(), { signal });
        this.elements.cancel.addEventListener('click', () => this.elements.dialog.close(), { signal });
        this.elements.form.addEventListener('submit', event => this.#create(event), { signal });
        this.elements.dialog.addEventListener('click', event => {
            if (event.target === this.elements.dialog) this.elements.dialog.close();
        }, { signal });
        this.#unregisterCommand = this.commands.register({
            id: WorkbenchCommand.FILE_NEW,
            title: 'New display file',
            category: 'File',
            execute: () => this.openDialog(),
        });
        this.#renderDescription();
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
        this.#unregisterCommand?.();
        this.#unregisterCommand = null;
    }

    async openDialog () {
        this.flushSource?.();
        this.elements.sourceName.value = 'DSPFILE';
        this.elements.recordName.value = 'MAIN';
        this.elements.model.value = this.documentModel.modelKey;
        if (typeof this.elements.dialog.showModal === 'function') this.elements.dialog.showModal();
        else this.elements.dialog.setAttribute('open', '');
        this.elements.sourceName.focus();
        this.elements.sourceName.select();
        return true;
    }

    #collectElements () {
        const required = id => {
            const element = this.document.getElementById(id);
            if (!element) throw new Error(`Missing DSPF template element: ${id}`);
            return element;
        };
        this.elements = {
            dialog: required('templateDialog'),
            form: required('templateForm'),
            kind: required('templateKind'),
            description: required('templateDescription'),
            sourceName: required('templateSourceName'),
            recordName: required('templateRecordName'),
            model: required('templateModel'),
            cancel: required('templateCancel'),
            toolbarButton: this.document.getElementById('templateNew'),
        };
    }

    #populateTemplates () {
        if (this.elements.kind.dataset.populated === 'true') return;
        for (const template of SCREEN_TEMPLATES) {
            const option = this.document.createElement('option');
            option.value = template.id;
            option.textContent = template.label;
            this.elements.kind.appendChild(option);
        }
        this.elements.kind.dataset.populated = 'true';
    }

    #renderDescription () {
        const template = SCREEN_TEMPLATES.find(candidate => candidate.id === this.elements.kind.value);
        this.elements.description.textContent = template?.description ?? '';
    }

    #create (event) {
        event.preventDefault();
        const created = createTemplateDocument(this.elements.kind.value, {
            sourceName: this.elements.sourceName.value,
            recordName: this.elements.recordName.value,
            modelKey: this.elements.model.value,
        });
        created.resetHistory({ markClean: false });
        this.designer.selectItem(null);
        this.palette.clearArmed();
        this.elements.dialog.close();
        this.coordinator.open({ documentModel: created });
        this.flash?.(
            `Created ${created.sourceName} from the ` +
            `${this.elements.kind.selectedOptions[0].textContent} template.`, 'ok', 4000);
    }
}
