export const WorkbenchDocumentKind = Object.freeze({
    DSPF_DESIGNER: 'dspf-designer',
    SOURCE_CODE: 'source-code',
});

const DOCUMENT_KINDS = new Set(Object.values(WorkbenchDocumentKind));

export class WorkbenchDocument {
    constructor ({ id, kind, title, resourceUri = null, isDirty = false }) {
        this.id = WorkbenchDocument.requiredText(id, 'Document id');
        if (!DOCUMENT_KINDS.has(kind)) {
            throw new Error(`Unsupported workbench document kind: ${kind}`);
        }
        this.kind = kind;
        this.title = WorkbenchDocument.requiredText(title, 'Document title');
        this.resourceUri = WorkbenchDocument.optionalText(resourceUri);
        this.isDirty = Boolean(isDirty);
        Object.freeze(this);
    }

    with (patch) {
        return new WorkbenchDocument({
            id: this.id,
            kind: this.kind,
            title: patch.title ?? this.title,
            resourceUri: Object.hasOwn(patch, 'resourceUri')
                ? patch.resourceUri
                : this.resourceUri,
            isDirty: patch.isDirty ?? this.isDirty,
        });
    }

    describe () {
        return Object.freeze({
            id: this.id,
            kind: this.kind,
            title: this.title,
            resourceUri: this.resourceUri,
            isDirty: this.isDirty,
        });
    }

    static requiredText (value, label) {
        const text = String(value ?? '').trim();
        if (!text) throw new TypeError(`${label} is required.`);
        return text;
    }

    static optionalText (value) {
        const text = String(value ?? '').trim();
        return text || null;
    }
}
