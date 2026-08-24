import { WorkbenchDocumentKind } from './WorkbenchDocument.js';

export class WorkbenchEditorTabsController {
    #abortController = null;
    #disposeDocuments = null;

    constructor ({ element, documents, closeDocument, logger = globalThis.console }) {
        if (!element) throw new TypeError('WorkbenchEditorTabsController requires an element.');
        if (!documents) {
            throw new TypeError('WorkbenchEditorTabsController requires document services.');
        }
        if (typeof closeDocument !== 'function') {
            throw new TypeError('WorkbenchEditorTabsController requires a close callback.');
        }
        this.element = element;
        this.documents = documents;
        this.closeDocument = closeDocument;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#abortController = new AbortController();
        this.element.addEventListener('click', event => this.#handleClick(event), {
            signal: this.#abortController.signal,
        });
        this.#disposeDocuments = this.documents.onDidChange(() => this.render());
        this.render();
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
        this.#disposeDocuments?.();
        this.#disposeDocuments = null;
    }

    render () {
        const documents = this.documents.documents;
        this.element.hidden = documents.length === 0;
        this.element.replaceChildren(...documents.map(document => this.#tab(document)));
    }

    #tab (document) {
        const tab = this.element.ownerDocument.createElement('button');
        tab.type = 'button';
        tab.className = 'workbench-editor-tab';
        tab.dataset.documentId = document.id;
        tab.setAttribute('role', 'tab');
        tab.title = document.resourceUri ?? document.title;
        const active = document.id === this.documents.activeDocumentId;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));

        const kind = this.element.ownerDocument.createElement('span');
        kind.className = 'workbench-editor-tab-kind';
        kind.setAttribute('aria-hidden', 'true');
        kind.textContent = document.kind === WorkbenchDocumentKind.DSPF_DESIGNER ? 'D' : 'S';

        const label = this.element.ownerDocument.createElement('span');
        label.className = 'workbench-editor-tab-label';
        label.textContent = `${document.isDirty ? '* ' : ''}${document.title}`;

        const close = this.element.ownerDocument.createElement('span');
        close.className = 'workbench-editor-tab-close';
        close.dataset.action = 'close';
        close.setAttribute('aria-label', `Close ${document.title}`);
        close.textContent = '×';
        tab.append(kind, label, close);
        return tab;
    }

    #handleClick (event) {
        const tab = event.target.closest('[data-document-id]');
        if (!tab) return;
        const document = this.documents.get(tab.dataset.documentId);
        if (!document) return;
        if (event.target.closest('[data-action="close"]')) {
            void Promise.resolve(this.closeDocument(document)).catch(error => {
                this.logger.error('[ironterm] workbench editor close failed:', error);
            });
            return;
        }
        this.documents.activate(document.id);
    }
}
