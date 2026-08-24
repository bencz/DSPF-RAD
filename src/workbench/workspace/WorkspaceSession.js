import { Workspace } from './Workspace.js';

export class WorkspaceSession {
    #workspaceDispose = null;
    #listeners = new Set();

    constructor ({ workspace = Workspace.createScratch(), fileName = null } = {}) {
        this.workspace = null;
        this.fileName = fileName;
        this.isDirty = false;
        this.replace(workspace, { fileName, markClean: true, emit: false });
    }

    replace (workspace, {
        fileName = null, markClean = true, emit = true,
    } = {}) {
        if (!(workspace instanceof Workspace)) {
            throw new TypeError('WorkspaceSession requires a Workspace instance.');
        }
        this.#workspaceDispose?.();
        this.workspace = workspace;
        this.fileName = fileName;
        this.isDirty = !markClean;
        this.#workspaceDispose = workspace.onDidChange(event => {
            this.isDirty = true;
            this.#emit(event.type);
        });
        if (emit) this.#emit('workspace.replaced');
    }

    markClean (fileName = this.fileName) {
        const changed = this.isDirty || fileName !== this.fileName;
        this.fileName = fileName;
        this.isDirty = false;
        if (changed) this.#emit('workspace.saved');
    }

    get suggestedFileName () {
        if (this.fileName) return this.fileName;
        const base = this.workspace.name
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase() || 'workspace';
        return `${base}.itworkspace`;
    }

    onDidChange (listener) {
        if (typeof listener !== 'function') throw new TypeError('Workspace session listener must be a function.');
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    dispose () {
        this.#workspaceDispose?.();
        this.#workspaceDispose = null;
        this.#listeners.clear();
    }

    #emit (type) {
        const event = Object.freeze({ type, session: this, workspace: this.workspace });
        for (const listener of this.#listeners) listener(event);
    }
}
