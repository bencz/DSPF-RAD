export class SourceDocument {
    #listeners = new Set();
    #cleanText;

    constructor ({
        id,
        name,
        languageId,
        sourceType = '',
        text = '',
        resourceUri = null,
        projectId = null,
        markClean = true,
    }) {
        this.id = requiredText(id, 'Source document id');
        this.name = requiredText(name, 'Source document name');
        this.languageId = requiredText(languageId, 'Source language id').toLowerCase();
        this.sourceType = String(sourceType ?? '').trim().toUpperCase();
        this.resourceUri = optionalText(resourceUri);
        this.projectId = optionalText(projectId);
        this.text = String(text ?? '');
        this.version = 1;
        this.#cleanText = markClean ? this.text : null;
    }

    get isDirty () {
        return this.text !== this.#cleanText;
    }

    replaceText (text, { source = 'editor' } = {}) {
        const next = String(text ?? '');
        if (next === this.text) return false;
        this.text = next;
        this.version++;
        this.#emit('document.changed', { source });
        return true;
    }

    rename (name) {
        const next = requiredText(name, 'Source document name');
        if (next === this.name) return false;
        this.name = next;
        this.version++;
        this.#emit('document.renamed');
        return true;
    }

    markClean () {
        if (!this.isDirty) return false;
        this.#cleanText = this.text;
        this.#emit('document.saved');
        return true;
    }

    onDidChange (listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('Source document listener must be a function.');
        }
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    describe () {
        return Object.freeze({
            id: this.id,
            name: this.name,
            languageId: this.languageId,
            sourceType: this.sourceType,
            resourceUri: this.resourceUri,
            projectId: this.projectId,
            version: this.version,
            isDirty: this.isDirty,
        });
    }

    #emit (type, detail = {}) {
        const event = Object.freeze({
            type,
            document: this,
            detail: Object.freeze({ ...detail }),
        });
        for (const listener of this.#listeners) listener(event);
    }
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
