import { WorkbenchCommand } from '../../workbench/commands/commandIds.js';
import { WorkspaceProjectKind } from '../../workbench/workspace/WorkspaceProject.js';
import { ConnectionAuthentication } from './model/ConnectionProfile.js';

export class ConnectionController {
    #unregister = [];

    constructor ({
        service,
        profiles,
        profileController,
        workspaceSession,
        commands,
        dialogs,
        flash,
    }) {
        if (!service) throw new TypeError('ConnectionController requires a connection service.');
        if (!profiles) throw new TypeError('ConnectionController requires a profile store.');
        if (!profileController) {
            throw new TypeError('ConnectionController requires a profile controller.');
        }
        if (!workspaceSession) throw new TypeError('ConnectionController requires a workspace session.');
        if (!commands) throw new TypeError('ConnectionController requires a command registry.');
        if (!dialogs) throw new TypeError('ConnectionController requires dialogs.');
        this.service = service;
        this.profiles = profiles;
        this.profileController = profileController;
        this.workspaceSession = workspaceSession;
        this.commands = commands;
        this.dialogs = dialogs;
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
                isEnabled: () => this.service.canStartConnection(),
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
        let profile = this.profiles.get(profileId);
        if (!profile) {
            profile = await this.profileController.chooseProfile();
            if (!profile) return false;
        }
        let secret = null;
        try {
            if (profile.authentication === ConnectionAuthentication.PASSWORD) {
                secret = await this.dialogs.secret({
                    title: `Connect to ${profile.name}`,
                    message: `Enter the password for ${profile.username}@${profile.host}.`,
                    label: 'IBM i password',
                });
                if (secret == null) return false;
            }
            await this.service.connect(profile.id, { secret });
            this.profiles.activate(profile.id);
            this.flash?.(`Connected to ${profile.name}.`, 'ok');
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.flash?.(`Connection to ${profile.name} failed: ${message}`,
                'error', 7000);
            return false;
        } finally {
            secret = null;
        }
    }

    async disconnect () {
        const profileName = this.service.profile?.name ?? 'IBM i';
        try {
            const disconnected = await this.service.disconnect();
            if (disconnected) this.flash?.(`Disconnected from ${profileName}.`, 'ok');
            return disconnected;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.flash?.(`Could not disconnect from ${profileName}: ${message}`,
                'error', 7000);
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
