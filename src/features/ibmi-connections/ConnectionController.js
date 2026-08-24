import { WorkbenchCommand } from '../../workbench/commands/commandIds.js';
import { WorkspaceProjectKind } from '../../workbench/workspace/WorkspaceProject.js';

export class ConnectionController {
    #unregister = [];

    constructor ({ service, profiles, workspaceSession, commands, flash }) {
        if (!service) throw new TypeError('ConnectionController requires a connection service.');
        if (!profiles) throw new TypeError('ConnectionController requires a profile store.');
        if (!workspaceSession) throw new TypeError('ConnectionController requires a workspace session.');
        if (!commands) throw new TypeError('ConnectionController requires a command registry.');
        this.service = service;
        this.profiles = profiles;
        this.workspaceSession = workspaceSession;
        this.commands = commands;
        this.flash = flash;
    }

    start () {
        this.stop();
        this.#unregister.push(
            this.commands.register({
                id: WorkbenchCommand.CONNECTION_CONNECT,
                title: 'Connect to IBM i',
                category: 'Connection',
                execute: () => this.connect(),
                isEnabled: () => this.service.canConnect(this.#selectedProfileId()),
            }),
            this.commands.register({
                id: WorkbenchCommand.CONNECTION_DISCONNECT,
                title: 'Disconnect from IBM i',
                category: 'Connection',
                execute: () => this.disconnect(),
                isEnabled: () => this.service.isConnected,
            }),
        );
    }

    stop () {
        for (const unregister of this.#unregister.splice(0)) unregister();
    }

    async connect () {
        const profileId = this.#selectedProfileId();
        const profile = this.profiles.get(profileId);
        if (!profile) {
            this.flash?.('Select or configure an IBM i connection profile first.', 'error');
            return false;
        }
        try {
            await this.service.connect(profile.id);
            this.profiles.activate(profile.id);
            this.flash?.(`Connected to ${profile.name}.`, 'ok');
            return true;
        } catch (error) {
            this.flash?.(`Connection to ${profile.name} failed (${error.code ?? error.name}).`,
                'error', 5000);
            return false;
        }
    }

    async disconnect () {
        const profileName = this.service.profile?.name ?? 'IBM i';
        try {
            const disconnected = await this.service.disconnect();
            if (disconnected) this.flash?.(`Disconnected from ${profileName}.`, 'ok');
            return disconnected;
        } catch (error) {
            this.flash?.(`Could not disconnect from ${profileName} (${error.code ?? error.name}).`,
                'error', 5000);
            return false;
        }
    }

    #selectedProfileId () {
        const project = this.workspaceSession.workspace.activeProject;
        if (project?.kind === WorkspaceProjectKind.IBMI && project.connectionProfileId) {
            return project.connectionProfileId;
        }
        return this.profiles.activeProfileId;
    }
}
