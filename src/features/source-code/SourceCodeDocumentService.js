import {
    WorkbenchDocumentKind,
} from '../../workbench/documents/WorkbenchDocument.js';

const WORKBENCH_PREFIX = 'source-code:';

export class SourceCodeDocumentService {
    #documents = new Map();
    #disposables = new Map();
    #listeners = new Set();

    constructor ({ workbenchDocuments }) {
        if (!workbenchDocuments) {
            throw new TypeError('SourceCodeDocumentService requires workbench documents.');
        }
        this.workbenchDocuments = workbenchDocuments;
    }

    get documents () {
        return Object.freeze([...this.#documents.values()]);
    }

    get activeDocument () {
        const activeId = this.workbenchDocuments.activeDocumentId;
        return activeId ? this.#documents.get(activeId) ?? null : null;
    }

    getForWorkbenchDocument (workbenchDocumentId) {
        return this.#documents.get(String(workbenchDocumentId)) ?? null;
    }

    open (sourceDocument) {
        const workbenchId = this.#workbenchId(sourceDocument.id);
        if (!this.#documents.has(workbenchId)) {
            this.#documents.set(workbenchId, sourceDocument);
            this.#disposables.set(workbenchId, sourceDocument.onDidChange(() => {
                this.#sync(sourceDocument);
                this.#emit('document.changed', sourceDocument);
            }));
        }
        this.workbenchDocuments.open(this.#descriptor(sourceDocument));
        this.#emit('document.opened', sourceDocument);
        return sourceDocument;
    }

    activate (sourceDocumentId) {
        return this.workbenchDocuments.activate(this.#workbenchId(sourceDocumentId));
    }

    close (sourceDocumentId) {
        const workbenchId = this.#workbenchId(sourceDocumentId);
        const document = this.#documents.get(workbenchId);
        if (!document) return false;
        this.#disposables.get(workbenchId)?.();
        this.#disposables.delete(workbenchId);
        this.#documents.delete(workbenchId);
        this.workbenchDocuments.close(workbenchId);
        this.#emit('document.closed', document);
        return true;
    }

    onDidChange (listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('Source document service listener must be a function.');
        }
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    #sync (sourceDocument) {
        this.workbenchDocuments.update(this.#workbenchId(sourceDocument.id), {
            title: sourceDocument.name,
            resourceUri: sourceDocument.resourceUri,
            isDirty: sourceDocument.isDirty,
        });
    }

    #descriptor (sourceDocument) {
        return {
            id: this.#workbenchId(sourceDocument.id),
            kind: WorkbenchDocumentKind.SOURCE_CODE,
            title: sourceDocument.name,
            resourceUri: sourceDocument.resourceUri,
            isDirty: sourceDocument.isDirty,
        };
    }

    #workbenchId (sourceDocumentId) {
        const id = String(sourceDocumentId);
        return id.startsWith(WORKBENCH_PREFIX) ? id : WORKBENCH_PREFIX + id;
    }

    #emit (type, document) {
        const event = Object.freeze({ type, document, service: this });
        for (const listener of this.#listeners) listener(event);
    }
}
