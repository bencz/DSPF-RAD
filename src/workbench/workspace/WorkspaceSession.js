import { Workspace } from './Workspace.js';
import { WorkspaceStorageLocation } from './persistence/WorkspaceStorageLocation.js';

export class WorkspaceSession {
    #workspaceDispose = null;
    #listeners = new Set();

    constructor ({
        workspace = Workspace.createScratch(),
        fileName = null,
        location = null,
        revision = null,
        markClean = true,
    } = {}) {
        this.workspace = null;
        this.fileName = fileName;
        this.location = null;
        this.revision = null;
        this.isDirty = false;
        this.replace(workspace, {
            fileName,
            location,
            revision,
            markClean,
            emit: false,
        });
    }

    replace (workspace, {
        fileName = null,
        location = null,
        revision = null,
        markClean = true,
        emit = true,
    } = {}) {
        if (!(workspace instanceof Workspace)) {
            throw new TypeError('WorkspaceSession requires a Workspace instance.');
        }
        this.#workspaceDispose?.();
        this.workspace = workspace;
        this.fileName = fileName;
        this.location = WorkspaceStorageLocation.fromJSON(location);
        this.revision = optionalText(revision);
        this.isDirty = !markClean;
        this.#workspaceDispose = workspace.onDidChange(event => {
            this.isDirty = true;
            this.#emit(event.type);
        });
        if (emit) this.#emit('workspace.replaced');
    }

    markClean (fileName = this.fileName, {
        location = this.location,
        revision = this.revision,
    } = {}) {
        const normalizedLocation = WorkspaceStorageLocation.fromJSON(location);
        const normalizedRevision = optionalText(revision);
        const changed = this.isDirty || fileName !== this.fileName ||
            normalizedLocation !== this.location || normalizedRevision !== this.revision;
        this.fileName = fileName;
        this.location = normalizedLocation;
        this.revision = normalizedRevision;
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

    describe () {
        return Object.freeze({
            workspaceId: this.workspace.id,
            fileName: this.fileName,
            location: this.location?.toJSON() ?? null,
            revision: this.revision,
            isDirty: this.isDirty,
        });
    }

    #emit (type) {
        const event = Object.freeze({ type, session: this, workspace: this.workspace });
        for (const listener of this.#listeners) listener(event);
    }
}

function optionalText (value) {
    const text = String(value ?? '').trim();
    return text || null;
}
