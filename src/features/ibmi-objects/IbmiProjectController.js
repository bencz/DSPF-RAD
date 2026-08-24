import { WorkbenchCommand } from '../../workbench/commands/commandIds.js';
import { WorkspaceProjectKind } from '../../workbench/workspace/WorkspaceProject.js';
import { IbmiLibrarySelection } from './model/IbmiLibrarySelection.js';
import { IbmiProjectLocation } from './model/IbmiProjectLocation.js';

export class IbmiProjectController {
    #unregister = [];

    constructor ({ workspaceSession, profiles, commands, dialogs, flash }) {
        if (!workspaceSession) throw new TypeError('IbmiProjectController requires a workspace.');
        if (!profiles) throw new TypeError('IbmiProjectController requires connection profiles.');
        if (!commands) throw new TypeError('IbmiProjectController requires commands.');
        if (!dialogs) throw new TypeError('IbmiProjectController requires dialogs.');
        this.workspaceSession = workspaceSession;
        this.profiles = profiles;
        this.commands = commands;
        this.dialogs = dialogs;
        this.flash = flash;
    }

    start () {
        this.stop();
        this.#unregister.push(this.commands.register({
            id: WorkbenchCommand.PROJECT_ATTACH_IBMI_LIBRARY,
            title: 'Attach IBM i libraries',
            category: 'Project',
            execute: () => this.attachLibraries(),
            isEnabled: () => Boolean(this.profiles.activeProfile),
        }));
    }

    stop () {
        for (const unregister of this.#unregister.splice(0)) unregister();
    }

    async attachLibraries () {
        const profile = this.profiles.activeProfile;
        if (!profile) {
            this.flash?.('Configure and select an IBM i connection profile first.', 'error');
            return false;
        }
        const value = await this.dialogs.prompt({
            title: 'Attach IBM i libraries',
            message: `Add one or more ILE libraries from ${profile.name} to this workspace.`,
            label: 'Libraries (comma or space separated)',
            value: IbmiLibrarySelection.suggestedText(profile),
            placeholder: 'BENCZ1, COMMON, QGPL',
            maxLength: 512,
            acceptLabel: 'Attach',
            validate: candidate => {
                try {
                    IbmiLibrarySelection.fromText(candidate);
                    return '';
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            },
        });
        if (value == null) return false;
        const selection = IbmiLibrarySelection.fromText(value);
        const existingUris = new Set(this.workspaceSession.workspace.projects
            .filter(project => project.kind === WorkspaceProjectKind.IBMI)
            .map(project => project.rootUri));
        const libraries = selection.libraries.filter(library =>
            !existingUris.has(IbmiProjectLocation.create({
                connectionProfileId: profile.id,
                library,
            })));
        if (!libraries.length) {
            this.flash?.('All selected IBM i libraries are already attached.', 'error');
            return false;
        }
        let activeProject = null;
        for (const library of libraries) {
            activeProject = this.workspaceSession.workspace.addProject({
                name: library,
                kind: WorkspaceProjectKind.IBMI,
                rootUri: IbmiProjectLocation.create({
                    connectionProfileId: profile.id,
                    library,
                }),
                connectionProfileId: profile.id,
            });
        }
        this.workspaceSession.workspace.activateProject(activeProject.id);
        const skipped = selection.libraries.length - libraries.length;
        this.flash?.(
            `Attached ${libraries.length} IBM i ${libraries.length === 1 ? 'library' : 'libraries'}` +
            `${skipped ? `; ${skipped} already attached` : ''}.`,
            'ok',
        );
        return true;
    }
}
