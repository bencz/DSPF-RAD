export class IbmiWorkspaceStorageUnavailableError extends Error {
    constructor (portKind) {
        super(`IBM i workspace storage is not available through the ${portKind} port.`);
        this.name = 'IbmiWorkspaceStorageUnavailableError';
        this.code = 'IBMI_WORKSPACE_STORAGE_UNAVAILABLE';
        this.portKind = portKind;
    }
}

export class IbmiWorkspaceRevisionConflictError extends Error {
    constructor ({ path, expectedRevision, actualRevision }) {
        super(`IBM i workspace changed remotely: ${path}`);
        this.name = 'IbmiWorkspaceRevisionConflictError';
        this.code = 'IBMI_WORKSPACE_REVISION_CONFLICT';
        this.path = path;
        this.expectedRevision = expectedRevision;
        this.actualRevision = actualRevision;
    }
}

// Focused remote workspace boundary. Concrete desktop implementations may use
// SFTP/SSH internally, but callers only exchange UTF-8 manifests and opaque
// revisions tied to an established IBM i session.
export class IbmiWorkspaceStoragePort {
    constructor ({ kind, available = false }) {
        if (!kind) throw new TypeError('An IBM i workspace storage port requires a kind.');
        this.kind = kind;
        this.available = Boolean(available);
    }

    describe () {
        return Object.freeze({ kind: this.kind, available: this.available });
    }

    async readWorkspace () {
        throw new IbmiWorkspaceStorageUnavailableError(this.kind);
    }

    async writeWorkspace () {
        throw new IbmiWorkspaceStorageUnavailableError(this.kind);
    }
}
