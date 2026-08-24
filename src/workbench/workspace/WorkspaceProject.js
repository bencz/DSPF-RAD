export const WorkspaceProjectKind = Object.freeze({
    SCRATCH: 'scratch',
    LOCAL: 'local',
    IBMI: 'ibmi',
});

const PROJECT_KINDS = new Set(Object.values(WorkspaceProjectKind));
const CREDENTIAL_KEY = /(password|passphrase|private.?key|secret|token|credential)/i;

export class WorkspaceProject {
    constructor ({
        id = WorkspaceProject.createId(),
        name,
        kind = WorkspaceProjectKind.LOCAL,
        rootUri = null,
        connectionProfileId = null,
        ...additional
    }) {
        WorkspaceProject.assertNoCredentials(additional);
        WorkspaceProject.assertNoCredentials({
            id, name, kind, rootUri, connectionProfileId,
        });
        if (!PROJECT_KINDS.has(kind)) {
            throw new Error(`Unsupported workspace project kind: ${kind}`);
        }

        this.id = WorkspaceProject.requiredText(id, 'Project id');
        this.name = WorkspaceProject.requiredText(name, 'Project name');
        this.kind = kind;
        this.rootUri = WorkspaceProject.optionalText(rootUri);
        this.connectionProfileId = WorkspaceProject.optionalText(connectionProfileId);

        if (this.kind !== WorkspaceProjectKind.IBMI && this.connectionProfileId) {
            throw new Error('Only IBM i projects may reference a connection profile.');
        }
        Object.freeze(this);
    }

    static fromJSON (value) {
        if (value instanceof WorkspaceProject) return value;
        WorkspaceProject.assertNoCredentials(value);
        return new WorkspaceProject(value);
    }

    rename (name) {
        const next = WorkspaceProject.requiredText(name, 'Project name');
        return next === this.name ? this : new WorkspaceProject({ ...this.toJSON(), name: next });
    }

    withConnectionProfile (connectionProfileId) {
        if (this.kind !== WorkspaceProjectKind.IBMI) {
            throw new Error('Only IBM i projects may reference a connection profile.');
        }
        const next = WorkspaceProject.optionalText(connectionProfileId);
        return next === this.connectionProfileId
            ? this
            : new WorkspaceProject({ ...this.toJSON(), connectionProfileId: next });
    }

    toJSON () {
        return {
            id: this.id,
            name: this.name,
            kind: this.kind,
            rootUri: this.rootUri,
            connectionProfileId: this.connectionProfileId,
        };
    }

    static assertNoCredentials (value, path = 'project') {
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
            if (CREDENTIAL_KEY.test(key)) {
                throw new Error(`Credentials are not allowed in workspace projects (${path}.${key}).`);
            }
            WorkspaceProject.assertNoCredentials(child, `${path}.${key}`);
        }
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

    static createId () {
        const uuid = globalThis.crypto?.randomUUID?.();
        return uuid
            ? `project-${uuid}`
            : `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
}
