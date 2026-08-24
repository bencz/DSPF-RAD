export const WorkspaceStorageKind = Object.freeze({
    LOCAL_FILE: 'local-file',
    IBMI_IFS: 'ibmi-ifs',
});

const STORAGE_KINDS = new Set(Object.values(WorkspaceStorageKind));

export class WorkspaceStorageLocation {
    constructor ({
        kind,
        fileName,
        path = null,
        connectionProfileId = null,
        ...additional
    }) {
        if (Object.keys(additional).length) {
            throw new Error('Workspace storage location contains unsupported metadata.');
        }
        if (!STORAGE_KINDS.has(kind)) {
            throw new Error(`Unsupported workspace storage kind: ${kind}`);
        }
        this.kind = kind;
        this.fileName = requiredText(fileName, 'Workspace file name');
        this.path = optionalText(path);
        this.connectionProfileId = optionalText(connectionProfileId);

        if (kind === WorkspaceStorageKind.IBMI_IFS) {
            this.path = validIfsPath(this.path);
            this.connectionProfileId = requiredText(
                this.connectionProfileId, 'IBM i connection profile id');
        } else if (this.path || this.connectionProfileId) {
            throw new Error('Local workspace locations cannot contain IBM i metadata.');
        }
        Object.freeze(this);
    }

    static localFile (fileName) {
        return new WorkspaceStorageLocation({
            kind: WorkspaceStorageKind.LOCAL_FILE,
            fileName,
        });
    }

    static ibmiIfs ({ path, connectionProfileId }) {
        const segments = String(path ?? '').split('/');
        return new WorkspaceStorageLocation({
            kind: WorkspaceStorageKind.IBMI_IFS,
            fileName: segments.at(-1),
            path,
            connectionProfileId,
        });
    }

    static fromJSON (value) {
        if (value == null) return null;
        if (value instanceof WorkspaceStorageLocation) return value;
        return new WorkspaceStorageLocation(value);
    }

    get isRemote () {
        return this.kind === WorkspaceStorageKind.IBMI_IFS;
    }

    toJSON () {
        return {
            kind: this.kind,
            fileName: this.fileName,
            path: this.path,
            connectionProfileId: this.connectionProfileId,
        };
    }
}

function validIfsPath (value) {
    const path = requiredText(value, 'IBM i IFS workspace path');
    if (!path.startsWith('/')) throw new Error('IBM i IFS workspace paths must be absolute.');
    if (path.includes('\0') || path.split('/').includes('..')) {
        throw new Error('IBM i IFS workspace path contains an unsafe segment.');
    }
    if (!path.toLowerCase().endsWith('.itworkspace')) {
        throw new Error('IBM i IFS workspace paths must end in .itworkspace.');
    }
    return path;
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
