import { IbmiProjectLocation } from './model/IbmiProjectLocation.js';

const CatalogStatus = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    ERROR: 'error',
});

export class IbmiObjectCatalog {
    #projects = new Map();
    #listeners = new Set();
    #pending = new Map();
    #disposeConnection = null;

    constructor ({ browser, connectionService, logger = globalThis.console }) {
        if (!browser) throw new TypeError('IbmiObjectCatalog requires an object browser.');
        if (!connectionService) {
            throw new TypeError('IbmiObjectCatalog requires a connection service.');
        }
        this.browser = browser;
        this.connectionService = connectionService;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#disposeConnection = this.connectionService.onDidChange(() => this.clear());
    }

    stop () {
        this.#disposeConnection?.();
        this.#disposeConnection = null;
        this.#pending.clear();
    }

    clear () {
        if (!this.#projects.size) return;
        this.#projects.clear();
        this.#pending.clear();
        this.#emit();
    }

    projectState (projectId) {
        return this.#projects.get(projectId) ?? Object.freeze({
            status: CatalogStatus.IDLE,
            library: null,
            objects: Object.freeze([]),
            members: new Map(),
            error: null,
        });
    }

    async loadProject (project, { force = false } = {}) {
        const current = this.#projects.get(project.id);
        if (!force && current?.status === CatalogStatus.READY) return current;
        const pendingKey = `project:${project.id}`;
        if (this.#pending.has(pendingKey)) return this.#pending.get(pendingKey);
        const operation = this.#loadProject(project).finally(() => this.#pending.delete(pendingKey));
        this.#pending.set(pendingKey, operation);
        return operation;
    }

    async loadSourceFile (project, sourceFile, { force = false } = {}) {
        const current = this.#projects.get(project.id);
        const currentMembers = current?.members.get(sourceFile);
        if (!force && currentMembers?.status === CatalogStatus.READY) return currentMembers;
        const pendingKey = `members:${project.id}:${sourceFile}`;
        if (this.#pending.has(pendingKey)) return this.#pending.get(pendingKey);
        const operation = this.#loadSourceFile(project, sourceFile)
            .finally(() => this.#pending.delete(pendingKey));
        this.#pending.set(pendingKey, operation);
        return operation;
    }

    onDidChange (listener) {
        if (typeof listener !== 'function') throw new TypeError('Catalog listener must be a function.');
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    async #loadProject (project) {
        const location = IbmiProjectLocation.fromProject(project);
        this.#setProject(project.id, {
            status: CatalogStatus.LOADING,
            library: location.library,
            objects: Object.freeze([]),
            members: new Map(),
            error: null,
        });
        try {
            const objects = await this.browser.listLibraryObjects(location);
            const ready = this.#setProject(project.id, {
                status: CatalogStatus.READY,
                library: location.library,
                objects,
                members: new Map(),
                error: null,
            });
            return ready;
        } catch (error) {
            this.logger.error(`[ironterm] could not browse IBM i library ${location.library}:`, error);
            const failed = this.#setProject(project.id, {
                status: CatalogStatus.ERROR,
                library: location.library,
                objects: Object.freeze([]),
                members: new Map(),
                error: error instanceof Error ? error.message : String(error),
            });
            return failed;
        }
    }

    async #loadSourceFile (project, sourceFile) {
        const location = IbmiProjectLocation.fromProject(project);
        const projectState = this.#projects.get(project.id) ?? {
            status: CatalogStatus.IDLE,
            library: location.library,
            objects: Object.freeze([]),
            members: new Map(),
            error: null,
        };
        this.#setMembers(project.id, projectState, sourceFile, {
            status: CatalogStatus.LOADING,
            entries: Object.freeze([]),
            error: null,
        });
        try {
            const entries = await this.browser.listSourceMembers({
                ...location,
                sourceFile,
            });
            return this.#setMembers(project.id, this.#projects.get(project.id), sourceFile, {
                status: CatalogStatus.READY,
                entries,
                error: null,
            });
        } catch (error) {
            this.logger.error(`[ironterm] could not browse source file ${sourceFile}:`, error);
            return this.#setMembers(project.id, this.#projects.get(project.id), sourceFile, {
                status: CatalogStatus.ERROR,
                entries: Object.freeze([]),
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    #setMembers (projectId, projectState, sourceFile, memberState) {
        const members = new Map(projectState.members);
        const frozen = Object.freeze(memberState);
        members.set(sourceFile, frozen);
        this.#setProject(projectId, { ...projectState, members });
        return frozen;
    }

    #setProject (projectId, state) {
        const frozen = Object.freeze(state);
        this.#projects.set(projectId, frozen);
        this.#emit();
        return frozen;
    }

    #emit () {
        const event = Object.freeze({ catalog: this });
        for (const listener of this.#listeners) listener(event);
    }
}
