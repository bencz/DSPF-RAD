import { DspfDocument } from '../../model/DspfDocument.js';
import { WorkbenchDocumentKind } from '../../workbench/documents/WorkbenchDocument.js';

export class DspfEditorSession {
    constructor ({ id, documentModel, title = null, resourceUri = null, readOnly = false }) {
        if (!(documentModel instanceof DspfDocument)) {
            throw new TypeError('DspfEditorSession requires a DSPF document.');
        }
        this.id = requiredText(id, 'DSPF editor session id');
        this.explicitTitle = optionalText(title);
        this.explicitResourceUri = optionalText(resourceUri) !== null;
        this.resourceUri = optionalText(resourceUri) ?? modelResourceUri(documentModel);
        this.readOnly = Boolean(readOnly);
        this.documentModel = new DspfDocument();
        this.documentModel.copySessionFrom(documentModel);
    }

    get title () {
        return this.explicitTitle ?? `${this.documentModel.sourceName || 'DSPFILE'}.DSPF`;
    }

    capture (documentModel) {
        const previousResourceUri = this.resourceUri;
        this.documentModel.copySessionFrom(documentModel);
        if (!this.explicitResourceUri) this.resourceUri = modelResourceUri(documentModel);
        return previousResourceUri;
    }

    restoreInto (documentModel) {
        documentModel.copySessionFrom(this.documentModel);
    }

    descriptor () {
        return {
            id: this.id,
            kind: WorkbenchDocumentKind.DSPF_DESIGNER,
            title: this.title,
            resourceUri: this.resourceUri,
            isDirty: this.documentModel.isDirty,
        };
    }
}

function modelResourceUri (documentModel) {
    return `dspf:${documentModel.sourceName}`;
}

function requiredText (value, label) {
    const text = String(value ?? '').trim();
    if (!text) throw new TypeError(`${label} is required.`);
    return text;
}

function optionalText (value) {
    const text = String(value ?? '').trim();
    return text || null;
}
