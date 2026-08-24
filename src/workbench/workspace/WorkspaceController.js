import { HostCapability } from '../../platform/host/capabilities.js';
import { WorkbenchCommand } from '../commands/commandIds.js';
import { Workspace } from './Workspace.js';
import { WorkspaceStorageLocation } from './persistence/WorkspaceStorageLocation.js';

export class WorkspaceController {
    #unregister = [];

    constructor ({
        session,
        commands,
        host,
        flash,
        dialogs,
        logger = globalThis.console,
    }) {
        if (!session) throw new TypeError('WorkspaceController requires a session.');
        if (!commands) throw new TypeError('WorkspaceController requires a command registry.');
        if (!host) throw new TypeError('WorkspaceController requires a host bridge.');
        if (!dialogs) throw new TypeError('WorkspaceController requires dialogs.');
        this.session = session;
        this.commands = commands;
        this.host = host;
        this.flash = flash;
        this.dialogs = dialogs;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#unregister.push(
            this.commands.register({
                id: WorkbenchCommand.WORKSPACE_NEW,
                title: 'New workspace',
                category: 'Project',
                execute: () => this.newWorkspace(),
            }),
            this.commands.register({
                id: WorkbenchCommand.WORKSPACE_OPEN,
                title: 'Open workspace',
                category: 'Project',
                execute: () => this.openWorkspace(),
                isEnabled: () => this.host.supports(HostCapability.OPEN_LOCAL_TEXT),
            }),
            this.commands.register({
                id: WorkbenchCommand.WORKSPACE_SAVE,
                title: 'Save workspace',
                category: 'Project',
                execute: () => this.saveWorkspace(),
                isEnabled: () => this.host.supports(HostCapability.SAVE_LOCAL_TEXT),
            }),
        );
    }

    stop () {
        for (const unregister of this.#unregister.splice(0)) unregister();
    }

    async newWorkspace () {
        if (!await this.#confirmDiscard()) return false;
        const name = await this.dialogs.prompt({
            title: 'New workspace',
            message: 'Create a workspace for local and IBM i projects.',
            label: 'Workspace name',
            value: 'Untitled Workspace',
            acceptLabel: 'Create',
            maxLength: 80,
        });
        if (name == null) return false;
        const workspaceName = name.trim() || 'Untitled Workspace';
        this.session.replace(Workspace.createScratch({ workspaceName }), {
            fileName: null,
            markClean: false,
        });
        this.flash?.(`Created workspace ${workspaceName}.`, 'ok');
        return true;
    }

    async openWorkspace () {
        if (!await this.#confirmDiscard()) return false;
        try {
            const file = await this.host.openTextFile({ accept: '.itworkspace,.json' });
            if (!file) return false;
            const workspace = Workspace.fromJSON(JSON.parse(file.text));
            this.session.replace(workspace, {
                fileName: file.name,
                location: WorkspaceStorageLocation.localFile(file.name),
                revision: null,
                markClean: true,
            });
            this.flash?.(`Opened workspace ${workspace.name}.`, 'ok');
            return true;
        } catch (error) {
            this.logger.error('[ironterm] workspace open failed:', error);
            this.flash?.(`Workspace open failed: ${error.message}`, 'error', 5000);
            return false;
        }
    }

    async saveWorkspace () {
        try {
            const name = this.session.suggestedFileName;
            await this.host.saveTextFile({
                suggestedName: name,
                text: JSON.stringify(this.session.workspace.toJSON(), null, 2) + '\n',
                mime: 'application/json;charset=utf-8',
            });
            this.session.markClean(name, {
                location: WorkspaceStorageLocation.localFile(name),
                revision: null,
            });
            this.flash?.(`Saved workspace ${name}.`, 'ok');
            return true;
        } catch (error) {
            this.logger.error('[ironterm] workspace save failed:', error);
            this.flash?.(`Workspace save failed: ${error.message}`, 'error', 5000);
            return false;
        }
    }

    async #confirmDiscard () {
        return !this.session.isDirty || this.dialogs.confirm({
            title: 'Unsaved workspace',
            message: `Discard unsaved changes to workspace ${this.session.workspace.name}?`,
            acceptLabel: 'Discard',
            danger: true,
        });
    }
}
