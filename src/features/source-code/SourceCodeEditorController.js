import { HostCapability } from '../../platform/host/capabilities.js';
import { WorkbenchCommand } from '../../workbench/commands/commandIds.js';
import { WorkbenchDocumentKind } from '../../workbench/documents/WorkbenchDocument.js';
import { SourceDocument } from './model/SourceDocument.js';

export class SourceCodeEditorController {
    #abortController = null;
    #disposeDocuments = null;
    #disposeWorkbench = null;
    #unregister = [];
    #documentSequence = 0;

    constructor ({
        documents,
        workbenchDocuments,
        editor,
        languageServices,
        commands,
        host,
        dialogs,
        flash,
        elements,
        logger = globalThis.console,
    }) {
        if (!documents) throw new TypeError('SourceCodeEditorController requires documents.');
        if (!editor) throw new TypeError('SourceCodeEditorController requires an editor.');
        if (!commands) throw new TypeError('SourceCodeEditorController requires commands.');
        this.documents = documents;
        this.workbenchDocuments = workbenchDocuments;
        this.editor = editor;
        this.languageServices = languageServices;
        this.commands = commands;
        this.host = host;
        this.dialogs = dialogs;
        this.flash = flash;
        this.elements = elements;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;
        this.elements.tabs.addEventListener('click', event => this.#handleTabClick(event), {
            signal,
        });
        this.elements.save.addEventListener('click', () => {
            void this.saveActive();
        }, { signal });
        this.elements.close.addEventListener('click', () => {
            void this.closeActive();
        }, { signal });
        this.#disposeDocuments = this.documents.onDidChange(() => this.render());
        this.#disposeWorkbench = this.workbenchDocuments.onDidChange(() => this.render());
        this.#unregister.push(
            this.commands.register({
                id: WorkbenchCommand.SOURCE_OPEN_LOCAL,
                title: 'Open source code',
                category: 'File',
                execute: () => this.openLocalSource(),
                isEnabled: () => this.host.supports(HostCapability.OPEN_LOCAL_TEXT),
            }),
            this.commands.register({
                id: WorkbenchCommand.SOURCE_SAVE,
                title: 'Save source code',
                category: 'File',
                execute: () => this.saveActive(),
                isEnabled: () => this.#sourceEditorActive() &&
                    this.host.supports(HostCapability.SAVE_LOCAL_TEXT),
            }),
            this.commands.register({
                id: WorkbenchCommand.SOURCE_CLOSE,
                title: 'Close source editor',
                category: 'File',
                execute: () => this.closeActive(),
                isEnabled: () => this.#sourceEditorActive(),
            }),
        );
        this.render();
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
        this.#disposeDocuments?.();
        this.#disposeWorkbench?.();
        this.#disposeDocuments = null;
        this.#disposeWorkbench = null;
        for (const unregister of this.#unregister.splice(0)) unregister();
    }

    async openLocalSource () {
        try {
            const file = await this.host.openTextFile({
                accept: '.cl,.clp,.clle,.rpg,.rpgle,.sqlrpg,.sqlrpgle,.cbl,.cobol,' +
                    '.cblle,.sql,.dds,.dspf,.mnudds,.pf,.lf,.prtf,.cmd,.pnlgrp,.txt',
            });
            if (!file) return false;
            const language = this.languageServices.languages.resolve({ fileName: file.name });
            const document = new SourceDocument({
                id: `local-${++this.#documentSequence}`,
                name: file.name,
                languageId: language.id,
                sourceType: inferredSourceType(file.name, language),
                text: file.text,
                resourceUri: `local:///${encodeURIComponent(file.name)}`,
            });
            this.documents.open(document);
            this.flash?.(`Opened ${file.name} as ${language.label}.`, 'ok');
            return true;
        } catch (error) {
            this.#reportFailure('Source open', error);
            return false;
        }
    }

    async saveActive () {
        const document = this.documents.activeDocument;
        if (!document) return false;
        try {
            await this.host.saveTextFile({
                suggestedName: document.name,
                text: document.text,
            });
            document.markClean();
            this.flash?.(`Saved ${document.name}.`, 'ok');
            return true;
        } catch (error) {
            this.#reportFailure('Source save', error);
            return false;
        }
    }

    async closeActive () {
        const document = this.documents.activeDocument;
        return document ? this.close(document.id) : false;
    }

    async close (documentId) {
        const document = this.documents.documents.find(candidate => candidate.id === documentId);
        if (!document) return false;
        if (document.isDirty && !await this.dialogs.confirm({
            title: 'Unsaved source',
            message: `Close ${document.name} without saving?`,
            acceptLabel: 'Close without saving',
            danger: true,
        })) return false;
        this.editor.close(document.id);
        return this.documents.close(document.id);
    }

    render () {
        this.#renderTabs();
        const document = this.documents.activeDocument;
        if (!document || !this.#sourceEditorActive()) return;
        this.editor.open(document);
        const language = this.languageServices.languages.get(document.languageId);
        this.elements.language.textContent = language?.label ?? document.languageId;
        this.elements.statusLanguage.textContent =
            document.sourceType || language?.label || document.languageId;
        this.elements.resource.textContent =
            document.sourceType ? `${document.sourceType} · ${document.resourceUri ?? 'local'}`
                : document.resourceUri ?? 'local';
        this.elements.save.disabled = !this.host.supports(HostCapability.SAVE_LOCAL_TEXT);
    }

    #renderTabs () {
        this.elements.tabs.replaceChildren(...this.documents.documents.map(document => {
            const tab = this.elements.tabs.ownerDocument.createElement('button');
            tab.type = 'button';
            tab.className = 'source-code-tab';
            tab.dataset.documentId = document.id;
            tab.setAttribute('role', 'tab');
            const active = this.documents.activeDocument?.id === document.id &&
                this.#sourceEditorActive();
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', String(active));

            const label = this.elements.tabs.ownerDocument.createElement('span');
            label.className = 'source-code-tab-label';
            label.textContent = `${document.isDirty ? '* ' : ''}${document.name}`;
            tab.append(label);

            const close = this.elements.tabs.ownerDocument.createElement('span');
            close.className = 'source-code-tab-close';
            close.dataset.action = 'close';
            close.setAttribute('aria-label', `Close ${document.name}`);
            close.textContent = '×';
            tab.append(close);
            return tab;
        }));
    }

    #handleTabClick (event) {
        const tab = event.target.closest('[data-document-id]');
        if (!tab) return;
        const documentId = tab.dataset.documentId;
        if (event.target.closest('[data-action="close"]')) {
            void this.close(documentId);
            return;
        }
        this.documents.activate(documentId);
    }

    #sourceEditorActive () {
        return this.workbenchDocuments.activeDocument?.kind ===
            WorkbenchDocumentKind.SOURCE_CODE;
    }

    #reportFailure (operation, error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[ironterm] ${operation.toLowerCase()} failed:`, error);
        this.flash?.(`${operation} failed: ${message}`, 'error', 5000);
    }
}

function inferredSourceType (fileName, language) {
    const extension = String(fileName).split('.').at(-1)?.toUpperCase() ?? '';
    return language.memberTypes.includes(extension)
        ? extension
        : language.memberTypes[0] ?? '';
}
