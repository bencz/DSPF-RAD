import { WorkbenchDocument } from './WorkbenchDocument.js';

export class WorkbenchDocumentService {
    #documents = new Map();
    #listeners = new Set();
    #lastActiveDocumentId = null;

    constructor () {
        this.activeDocumentId = null;
    }

    get documents () {
        return Object.freeze([...this.#documents.values()]);
    }

    get activeDocument () {
        return this.#documents.get(this.activeDocumentId) ?? null;
    }

    get lastActiveDocument () {
        return this.#documents.get(this.#lastActiveDocumentId) ?? null;
    }

    get isStartPageActive () {
        return this.activeDocumentId === null;
    }

    get (documentId) {
        return this.#documents.get(documentId) ?? null;
    }

    open (documentDescriptor) {
        const document = documentDescriptor instanceof WorkbenchDocument
            ? documentDescriptor
            : new WorkbenchDocument(documentDescriptor);
        const existing = this.#documents.get(document.id);
        this.#documents.set(document.id, document);
        this.activeDocumentId = document.id;
        this.#lastActiveDocumentId = document.id;
        this.#emit(existing ? 'document.updated' : 'document.opened', document);
        return document;
    }

    update (documentId, patch) {
        const current = this.#documents.get(documentId);
        if (!current) return null;
        const updated = current.with(patch);
        this.#documents.set(documentId, updated);
        this.#emit('document.updated', updated);
        return updated;
    }

    activate (documentId) {
        const document = this.#documents.get(documentId);
        if (!document) throw new Error(`Unknown workbench document: ${documentId}`);
        if (this.activeDocumentId === documentId) return false;
        this.activeDocumentId = documentId;
        this.#lastActiveDocumentId = documentId;
        this.#emit('document.activated', document);
        return true;
    }

    showStartPage () {
        if (this.isStartPageActive) return false;
        this.activeDocumentId = null;
        this.#emit('startPage.activated', null);
        return true;
    }

    close (documentId) {
        const document = this.#documents.get(documentId);
        if (!document) return false;
        this.#documents.delete(documentId);
        if (this.activeDocumentId === documentId) {
            this.activeDocumentId = this.documents.at(-1)?.id ?? null;
        }
        if (this.#lastActiveDocumentId === documentId) {
            this.#lastActiveDocumentId = this.activeDocumentId ??
                this.documents.at(-1)?.id ?? null;
        }
        this.#emit('document.closed', document);
        return true;
    }

    onDidChange (listener) {
        if (typeof listener !== 'function') throw new TypeError('Document listener must be a function.');
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    describe () {
        return Object.freeze({
            activeDocumentId: this.activeDocumentId,
            lastActiveDocumentId: this.#lastActiveDocumentId,
            documents: Object.freeze(this.documents.map(document => document.describe())),
        });
    }

    #emit (type, document) {
        const event = Object.freeze({ type, document, service: this });
        for (const listener of this.#listeners) listener(event);
    }
}
