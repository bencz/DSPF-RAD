import { WorkbenchDocumentKind } from '../../workbench/documents/WorkbenchDocument.js';

export const DSPF_WORKBENCH_DOCUMENT_ID = 'dspf-designer:primary';

export class DspfDocumentCoordinator {
    #disposeDocument = null;

    constructor ({ documentModel, workbenchDocuments }) {
        if (!documentModel) throw new TypeError('DspfDocumentCoordinator requires a DSPF document.');
        if (!workbenchDocuments) {
            throw new TypeError('DspfDocumentCoordinator requires a workbench document service.');
        }
        this.documentModel = documentModel;
        this.workbenchDocuments = workbenchDocuments;
    }

    get isOpen () {
        return this.workbenchDocuments.get(DSPF_WORKBENCH_DOCUMENT_ID) !== null;
    }

    get isActive () {
        return this.workbenchDocuments.activeDocumentId === DSPF_WORKBENCH_DOCUMENT_ID;
    }

    start () {
        this.stop();
        this.#disposeDocument = this.documentModel.onChange(() => this.#syncDescriptor());
    }

    stop () {
        this.#disposeDocument?.();
        this.#disposeDocument = null;
    }

    open () {
        return this.workbenchDocuments.open({
            id: DSPF_WORKBENCH_DOCUMENT_ID,
            kind: WorkbenchDocumentKind.DSPF_DESIGNER,
            title: this.#title(),
            resourceUri: `dspf:${this.documentModel.sourceName}`,
            isDirty: this.documentModel.isDirty,
        });
    }

    activate () {
        if (!this.isOpen) return false;
        return this.workbenchDocuments.activate(DSPF_WORKBENCH_DOCUMENT_ID);
    }

    #syncDescriptor () {
        if (!this.isOpen) return;
        this.workbenchDocuments.update(DSPF_WORKBENCH_DOCUMENT_ID, {
            title: this.#title(),
            resourceUri: `dspf:${this.documentModel.sourceName}`,
            isDirty: this.documentModel.isDirty,
        });
    }

    #title () {
        return `${this.documentModel.sourceName || 'DSPFILE'}.DSPF`;
    }
}
