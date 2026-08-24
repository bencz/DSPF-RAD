import { Workspace } from '../../workbench/workspace/Workspace.js';
import { WorkspaceSnapshot } from '../../workbench/workspace/persistence/WorkspaceSnapshot.js';
import {
    WorkspaceStorageKind,
    WorkspaceStorageLocation,
} from '../../workbench/workspace/persistence/WorkspaceStorageLocation.js';

export class IbmiWorkspaceSessionError extends Error {
    constructor (message) {
        super(message);
        this.name = 'IbmiWorkspaceSessionError';
        this.code = 'IBMI_WORKSPACE_SESSION';
    }
}

export class IbmiWorkspaceService {
    constructor ({ connectionService, port, clock = () => new Date().toISOString() }) {
        if (!connectionService) {
            throw new TypeError('IbmiWorkspaceService requires a connection service.');
        }
        if (!port) throw new TypeError('IbmiWorkspaceService requires a storage port.');
        if (typeof clock !== 'function') throw new TypeError('Workspace clock must be a function.');
        this.connectionService = connectionService;
        this.port = port;
        this.clock = clock;
    }

    canAccess (location) {
        const normalized = WorkspaceStorageLocation.fromJSON(location);
        if (!normalized || normalized.kind !== WorkspaceStorageKind.IBMI_IFS) return false;
        const session = this.connectionService.session;
        return this.port.available && this.connectionService.isConnected &&
            session?.profileId === normalized.connectionProfileId;
    }

    async load (location) {
        const normalized = this.#remoteLocation(location);
        const session = this.#session(normalized);
        const result = await this.port.readWorkspace({
            sessionId: session.id,
            path: normalized.path,
        });
        const workspace = Workspace.fromJSON(JSON.parse(requiredText(
            result?.text, 'IBM i workspace content')));
        return new WorkspaceSnapshot({
            workspace,
            location: normalized,
            revision: requiredText(result?.revision, 'IBM i workspace revision'),
            capturedAt: this.clock(),
        });
    }

    async save (workspaceSession, {
        location = workspaceSession?.location,
        expectedRevision = workspaceSession?.revision,
    } = {}) {
        if (!workspaceSession) {
            throw new TypeError('Saving an IBM i workspace requires a workspace session.');
        }
        const normalized = this.#remoteLocation(location);
        const session = this.#session(normalized);
        const text = JSON.stringify(workspaceSession.workspace.toJSON(), null, 2) + '\n';
        const result = await this.port.writeWorkspace({
            sessionId: session.id,
            path: normalized.path,
            text,
            expectedRevision: optionalText(expectedRevision),
        });
        const revision = requiredText(result?.revision, 'IBM i workspace revision');
        workspaceSession.markClean(normalized.fileName, {
            location: normalized,
            revision,
        });
        return new WorkspaceSnapshot({
            workspace: workspaceSession.workspace,
            location: normalized,
            revision,
            capturedAt: this.clock(),
        });
    }

    #session (location) {
        if (!this.port.available || !this.connectionService.isConnected ||
            !this.connectionService.session) {
            throw new IbmiWorkspaceSessionError(
                'Connect to IBM i before accessing a remote workspace.');
        }
        if (this.connectionService.session.profileId !== location.connectionProfileId) {
            throw new IbmiWorkspaceSessionError(
                'The active IBM i connection does not match the workspace location.');
        }
        return this.connectionService.session;
    }

    #remoteLocation (location) {
        const normalized = WorkspaceStorageLocation.fromJSON(location);
        if (!normalized || normalized.kind !== WorkspaceStorageKind.IBMI_IFS) {
            throw new TypeError('IBM i workspace operations require an IFS location.');
        }
        return normalized;
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
