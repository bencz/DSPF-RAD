export const WORKSPACE_FORMAT = 'IRONTERM-WORKSPACE';
export const WORKSPACE_VERSION = 1;

export const WorkspaceProjectKind = Object.freeze({
    SCRATCH: 'scratch',
    LOCAL: 'local',
    IBMI: 'ibmi',
});

const PROJECT_KINDS = new Set(Object.values(WorkspaceProjectKind));
const CREDENTIAL_KEY = /(password|passphrase|private.?key|secret|token|credential)/i;

export class Workspace {
    #projects = [];
    #listeners = new Set();

    constructor ({ id = createId('workspace'), name = 'Untitled Workspace', projects = [], activeProjectId = null } = {}) {
        this.id = requiredText(id, 'Workspace id');
        this.name = requiredText(name, 'Workspace name');
        this.#projects = projects.map(normalizeProject);
        assertUniqueProjectIds(this.#projects);
        this.activeProjectId = activeProjectId ?? this.#projects[0]?.id ?? null;
        this.#assertKnownActiveProject();
    }

    static createScratch ({ workspaceName = 'Untitled Workspace', projectName = 'Display file design' } = {}) {
        const project = normalizeProject({
            id: createId('project'),
            name: projectName,
            kind: WorkspaceProjectKind.SCRATCH,
        });
        return new Workspace({ name: workspaceName, projects: [project] });
    }

    static fromJSON (value) {
        assertNoCredentials(value);
        if (value?.format !== WORKSPACE_FORMAT) {
            throw new Error(`Unsupported workspace format: ${value?.format ?? 'missing'}`);
        }
        if (value.version !== WORKSPACE_VERSION) {
            throw new Error(`Unsupported workspace version: ${value.version}`);
        }
        return new Workspace(value);
    }

    get projects () {
        return Object.freeze([...this.#projects]);
    }

    get activeProject () {
        return this.#projects.find(project => project.id === this.activeProjectId) ?? null;
    }

    rename (name) {
        const next = requiredText(name, 'Workspace name');
        if (next === this.name) return false;
        this.name = next;
        this.#emit('workspace.renamed');
        return true;
    }

    addProject (project) {
        const normalized = normalizeProject({ id: createId('project'), ...project });
        if (this.#projects.some(entry => entry.id === normalized.id)) {
            throw new Error(`Duplicate workspace project id: ${normalized.id}`);
        }
        this.#projects = [...this.#projects, normalized];
        if (!this.activeProjectId) this.activeProjectId = normalized.id;
        this.#emit('project.added');
        return normalized;
    }

    renameProject (projectId, name) {
        const index = this.#projects.findIndex(project => project.id === projectId);
        if (index < 0) return false;
        const next = requiredText(name, 'Project name');
        if (this.#projects[index].name === next) return false;
        const projects = [...this.#projects];
        projects[index] = Object.freeze({ ...projects[index], name: next });
        this.#projects = projects;
        this.#emit('project.renamed');
        return true;
    }

    removeProject (projectId) {
        const index = this.#projects.findIndex(project => project.id === projectId);
        if (index < 0) return false;
        this.#projects = this.#projects.filter(project => project.id !== projectId);
        if (this.activeProjectId === projectId) {
            this.activeProjectId = this.#projects[Math.min(index, this.#projects.length - 1)]?.id ?? null;
        }
        this.#emit('project.removed');
        return true;
    }

    activateProject (projectId) {
        if (!this.#projects.some(project => project.id === projectId)) {
            throw new Error(`Unknown workspace project: ${projectId}`);
        }
        if (this.activeProjectId === projectId) return false;
        this.activeProjectId = projectId;
        this.#emit('project.activated');
        return true;
    }

    onDidChange (listener) {
        if (typeof listener !== 'function') throw new TypeError('Workspace listener must be a function.');
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    toJSON () {
        return {
            format: WORKSPACE_FORMAT,
            version: WORKSPACE_VERSION,
            id: this.id,
            name: this.name,
            projects: this.#projects.map(project => ({ ...project })),
            activeProjectId: this.activeProjectId,
        };
    }

    #assertKnownActiveProject () {
        if (this.activeProjectId && !this.#projects.some(project => project.id === this.activeProjectId)) {
            throw new Error(`Unknown active workspace project: ${this.activeProjectId}`);
        }
    }

    #emit (type) {
        const event = Object.freeze({ type, workspace: this });
        for (const listener of this.#listeners) listener(event);
    }
}

function normalizeProject (value) {
    assertNoCredentials(value);
    const kind = value?.kind ?? WorkspaceProjectKind.LOCAL;
    if (!PROJECT_KINDS.has(kind)) throw new Error(`Unsupported workspace project kind: ${kind}`);
    const connectionProfileId = optionalText(value?.connectionProfileId);
    if (kind !== WorkspaceProjectKind.IBMI && connectionProfileId) {
        throw new Error('Only IBM i projects may reference a connection profile.');
    }
    return Object.freeze({
        id: requiredText(value?.id, 'Project id'),
        name: requiredText(value?.name, 'Project name'),
        kind,
        rootUri: optionalText(value?.rootUri),
        connectionProfileId,
    });
}

function assertNoCredentials (value, path = 'workspace') {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
        if (CREDENTIAL_KEY.test(key)) {
            throw new Error(`Credentials are not allowed in workspace manifests (${path}.${key}).`);
        }
        assertNoCredentials(child, `${path}.${key}`);
    }
}

function assertUniqueProjectIds (projects) {
    const ids = new Set();
    for (const project of projects) {
        if (ids.has(project.id)) throw new Error(`Duplicate workspace project id: ${project.id}`);
        ids.add(project.id);
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

function createId (prefix) {
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
