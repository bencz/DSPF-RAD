import { IbmiWorkspaceRevisionConflictError } from '../../platform/ibmi/IbmiWorkspaceStoragePort.js';
import { WorkbenchCommand } from '../../workbench/commands/commandIds.js';
import {
    WorkspaceStorageKind,
    WorkspaceStorageLocation,
} from '../../workbench/workspace/persistence/WorkspaceStorageLocation.js';

export class IbmiWorkspaceController {
    #unregister = [];

    constructor ({
        service,
        connectionService,
        workspaceSession,
        commands,
        dialogs,
        flash,
        logger = globalThis.console,
    }) {
        if (!service) throw new TypeError('IbmiWorkspaceController requires a service.');
        if (!connectionService) {
            throw new TypeError('IbmiWorkspaceController requires a connection service.');
        }
        if (!workspaceSession) {
            throw new TypeError('IbmiWorkspaceController requires a workspace session.');
        }
        if (!commands) throw new TypeError('IbmiWorkspaceController requires commands.');
        if (!dialogs) throw new TypeError('IbmiWorkspaceController requires dialogs.');
        this.service = service;
        this.connectionService = connectionService;
        this.workspaceSession = workspaceSession;
        this.commands = commands;
        this.dialogs = dialogs;
        this.flash = flash;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#unregister.push(
            this.commands.register({
                id: WorkbenchCommand.WORKSPACE_OPEN_IBMI,
                title: 'Open workspace from IBM i IFS',
                category: 'Project',
                execute: () => this.openRemote(),
                isEnabled: () => this.#connected(),
            }),
            this.commands.register({
                id: WorkbenchCommand.WORKSPACE_PUBLISH_IBMI,
                title: 'Publish workspace to IBM i IFS',
                category: 'Project',
                execute: () => this.publishRemote(),
                isEnabled: () => this.#connected(),
            }),
            this.commands.register({
                id: WorkbenchCommand.WORKSPACE_SYNC_IBMI,
                title: 'Synchronize IBM i workspace',
                category: 'Project',
                execute: () => this.synchronize(),
                isEnabled: () => this.#remoteActive(),
            }),
        );
    }

    stop () {
        for (const unregister of this.#unregister.splice(0)) unregister();
    }

    async openRemote () {
        if (!await this.#confirmDiscard()) return false;
        const location = await this.#requestLocation('Open IBM i workspace');
        if (!location) return false;
        try {
            const snapshot = await this.service.load(location);
            this.workspaceSession.replace(snapshot.workspace, {
                fileName: location.fileName,
                location,
                revision: snapshot.revision,
                markClean: true,
            });
            this.flash?.(`Opened ${location.path} from IBM i.`, 'ok', 4000);
            return true;
        } catch (error) {
            return this.#reportFailure('IBM i workspace open', error);
        }
    }

    async publishRemote () {
        const location = await this.#requestLocation('Publish workspace to IBM i');
        if (!location) return false;
        const current = this.workspaceSession.location;
        const sameRemote = current?.kind === WorkspaceStorageKind.IBMI_IFS &&
            current.path === location.path &&
            current.connectionProfileId === location.connectionProfileId;
        try {
            await this.service.save(this.workspaceSession, {
                location,
                expectedRevision: sameRemote ? this.workspaceSession.revision : null,
            });
            this.flash?.(`Published workspace to ${location.path}.`, 'ok', 4000);
            return true;
        } catch (error) {
            return this.#reportFailure('IBM i workspace publish', error);
        }
    }

    async synchronize () {
        const location = this.workspaceSession.location;
        if (!location || !this.service.canAccess(location)) return false;
        try {
            if (this.workspaceSession.isDirty) {
                await this.service.save(this.workspaceSession);
                this.flash?.(`Synchronized workspace to ${location.path}.`, 'ok', 4000);
                return true;
            }
            const remote = await this.service.load(location);
            if (remote.revision === this.workspaceSession.revision) {
                this.flash?.('IBM i workspace is already synchronized.', 'ok');
                return true;
            }
            this.workspaceSession.replace(remote.workspace, {
                fileName: location.fileName,
                location,
                revision: remote.revision,
                markClean: true,
            });
            this.flash?.(`Updated workspace from ${location.path}.`, 'ok', 4000);
            return true;
        } catch (error) {
            return this.#reportFailure('IBM i workspace synchronization', error);
        }
    }

    async #requestLocation (title) {
        const current = this.workspaceSession.location;
        const profile = this.connectionService.profile;
        if (!profile) return null;
        const defaultPath = current?.kind === WorkspaceStorageKind.IBMI_IFS
            ? current.path
            : `/home/${profile.username}/.ironterm/workspaces/` +
                this.workspaceSession.suggestedFileName;
        const path = await this.dialogs.prompt({
            title,
            message: 'Use an absolute path to a .itworkspace stream file in the IBM i IFS.',
            label: 'IFS path',
            value: defaultPath,
            acceptLabel: title.startsWith('Open') ? 'Open' : 'Publish',
            maxLength: 1024,
        });
        if (path == null) return null;
        try {
            return WorkspaceStorageLocation.ibmiIfs({
                path,
                connectionProfileId: profile.id,
            });
        } catch (error) {
            await this.dialogs.alert({
                title: 'Invalid IFS workspace path',
                message: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    async #confirmDiscard () {
        return !this.workspaceSession.isDirty || this.dialogs.confirm({
            title: 'Unsaved workspace',
            message: `Discard unsaved changes to ${this.workspaceSession.workspace.name}?`,
            acceptLabel: 'Discard and open',
            danger: true,
        });
    }

    #connected () {
        return this.service.port.available && this.connectionService.isConnected;
    }

    #remoteActive () {
        return this.workspaceSession.location?.kind === WorkspaceStorageKind.IBMI_IFS &&
            this.service.canAccess(this.workspaceSession.location);
    }

    #reportFailure (operation, error) {
        this.logger.error(`[ironterm] ${operation.toLowerCase()} failed:`, error);
        if (error instanceof IbmiWorkspaceRevisionConflictError) {
            void this.dialogs.alert({
                title: 'Workspace changed on IBM i',
                message: 'The remote workspace has a newer revision and was not overwritten.',
                detail: 'Reload it or publish to another IFS path. Compare and merge support will be added to the conflict workflow.',
            });
            return false;
        }
        const message = error instanceof Error ? error.message : String(error);
        this.flash?.(`${operation} failed: ${message}`, 'error', 6000);
        return false;
    }
}
