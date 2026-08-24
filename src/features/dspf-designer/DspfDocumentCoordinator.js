import { DspfDocument } from '../../model/DspfDocument.js';
import { WorkbenchDocumentKind } from '../../workbench/documents/WorkbenchDocument.js';
import { DspfEditorSession } from './DspfEditorSession.js';

const DSPF_DOCUMENT_PREFIX = 'dspf-designer:';

export class DspfDocumentCoordinator {
    #activeSessionId = null;
    #beforeSwitch = null;
    #disposeDocument = null;
    #disposeWorkbench = null;
    #listeners = new Set();
    #resourceIndex = new Map();
    #sequence = 0;
    #sessions = new Map();
    #switching = false;

    constructor ({ documentModel, workbenchDocuments }) {
        if (!(documentModel instanceof DspfDocument)) {
            throw new TypeError('DspfDocumentCoordinator requires a DSPF document.');
        }
        if (!workbenchDocuments) {
            throw new TypeError('DspfDocumentCoordinator requires a workbench document service.');
        }
        this.documentModel = documentModel;
        this.workbenchDocuments = workbenchDocuments;
    }

    get isOpen () {
        return this.#sessions.size > 0;
    }

    get isActive () {
        return this.workbenchDocuments.activeDocument?.kind ===
            WorkbenchDocumentKind.DSPF_DESIGNER;
    }

    get activeDocumentId () {
        return this.isActive ? this.workbenchDocuments.activeDocumentId : null;
    }

    get resourceUri () {
        return this.#activeSession()?.resourceUri ?? null;
    }

    get isReadOnly () {
        return this.#activeSession()?.readOnly ?? false;
    }

    start () {
        this.stop();
        this.#disposeDocument = this.documentModel.onChange(() => this.#syncActiveSession());
        this.#disposeWorkbench = this.workbenchDocuments.onDidChange(
            event => this.#handleWorkbenchChange(event));
    }

    stop () {
        this.#disposeDocument?.();
        this.#disposeWorkbench?.();
        this.#disposeDocument = null;
        this.#disposeWorkbench = null;
    }

    setBeforeSwitch (listener) {
        if (listener !== null && typeof listener !== 'function') {
            throw new TypeError('DSPF before-switch hook must be a function.');
        }
        this.#beforeSwitch = listener;
    }

    onDidActivate (listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('DSPF activation listener must be a function.');
        }
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    open ({
        title = null,
        resourceUri = null,
        readOnly = false,
        documentModel = this.documentModel,
    } = {}) {
        if (!(documentModel instanceof DspfDocument)) {
            throw new TypeError('Opening a DSPF editor requires a DSPF document.');
        }
        const existingId = resourceUri ? this.#resourceIndex.get(resourceUri) : null;
        if (existingId) {
            this.activate(existingId);
            return this.workbenchDocuments.get(existingId);
        }

        this.#beforeSwitch?.();
        this.#captureActiveSession();
        const session = new DspfEditorSession({
            id: `${DSPF_DOCUMENT_PREFIX}${++this.#sequence}`,
            documentModel,
            title,
            resourceUri,
            readOnly,
        });
        this.#sessions.set(session.id, session);
        this.#resourceIndex.set(session.resourceUri, session.id);
        this.#switching = true;
        try {
            this.#restoreSession(session);
            return this.workbenchDocuments.open(session.descriptor());
        } finally {
            this.#switching = false;
            this.#emitActivated(session);
        }
    }

    activate (documentId = this.#activeSessionId) {
        if (!documentId || !this.#sessions.has(documentId)) return false;
        if (this.workbenchDocuments.activeDocumentId === documentId) return false;
        return this.workbenchDocuments.activate(documentId);
    }

    activateResource (resourceUri) {
        const documentId = this.#resourceIndex.get(String(resourceUri));
        if (!documentId) return false;
        if (this.workbenchDocuments.activeDocumentId === documentId) return true;
        this.activate(documentId);
        return true;
    }

    documentInfo (documentId) {
        const session = this.#sessions.get(String(documentId));
        if (!session) return null;
        if (session.id === this.#activeSessionId) this.#captureActiveSession();
        return Object.freeze({
            id: session.id,
            title: session.title,
            resourceUri: session.resourceUri,
            isDirty: session.documentModel.isDirty,
            isReadOnly: session.readOnly,
        });
    }

    close (documentId = this.activeDocumentId) {
        const session = this.#sessions.get(String(documentId));
        if (!session) return false;
        if (session.id === this.#activeSessionId) {
            this.#beforeSwitch?.();
            this.#captureActiveSession();
            this.#activeSessionId = null;
        }
        this.#sessions.delete(session.id);
        if (this.#resourceIndex.get(session.resourceUri) === session.id) {
            this.#resourceIndex.delete(session.resourceUri);
        }
        return this.workbenchDocuments.close(session.id);
    }

    #activeSession () {
        return this.#sessions.get(this.#activeSessionId) ?? null;
    }

    #captureActiveSession () {
        const session = this.#activeSession();
        if (!session) return;
        const previousResourceUri = session.capture(this.documentModel);
        if (previousResourceUri !== session.resourceUri) {
            if (this.#resourceIndex.get(previousResourceUri) === session.id) {
                this.#resourceIndex.delete(previousResourceUri);
            }
            this.#resourceIndex.set(session.resourceUri, session.id);
        }
        this.workbenchDocuments.update(session.id, session.descriptor());
    }

    #restoreSession (session) {
        session.restoreInto(this.documentModel);
        this.#activeSessionId = session.id;
    }

    #syncActiveSession () {
        if (this.#switching) return;
        this.#captureActiveSession();
    }

    #handleWorkbenchChange (event) {
        if (this.#switching) return;
        if (![
            'document.opened',
            'document.activated',
            'document.closed',
            'startPage.activated',
        ].includes(event.type)) {
            return;
        }
        const active = this.workbenchDocuments.activeDocument;
        if (active?.kind !== WorkbenchDocumentKind.DSPF_DESIGNER) {
            if (event.type === 'document.opened' ||
                event.type === 'document.activated' ||
                event.type === 'startPage.activated') {
                this.#beforeSwitch?.();
                this.#captureActiveSession();
            }
            return;
        }
        const session = this.#sessions.get(active.id);
        if (!session || session.id === this.#activeSessionId) return;
        this.#beforeSwitch?.();
        this.#captureActiveSession();
        this.#switching = true;
        try {
            this.#restoreSession(session);
        } finally {
            this.#switching = false;
        }
        this.#emitActivated(session);
    }

    #emitActivated (session) {
        const event = Object.freeze({ sessionId: session.id, coordinator: this });
        for (const listener of this.#listeners) listener(event);
    }
}
