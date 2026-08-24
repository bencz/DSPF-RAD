import { WorkbenchCommand } from '../../workbench/commands/commandIds.js';
import {
    ConnectionAuthentication,
    ConnectionProfile,
} from './model/ConnectionProfile.js';

export class ConnectionProfileController {
    #abortController = null;
    #disposeProfiles = null;
    #unregisterCommand = null;
    #selectionResolver = null;

    constructor ({ dialog, profiles, commands, dialogs, flash }) {
        if (!dialog) throw new TypeError('ConnectionProfileController requires a dialog.');
        if (!profiles) throw new TypeError('ConnectionProfileController requires profiles.');
        if (!commands) throw new TypeError('ConnectionProfileController requires commands.');
        if (!dialogs) throw new TypeError('ConnectionProfileController requires dialogs.');
        this.dialog = dialog;
        this.profiles = profiles;
        this.commands = commands;
        this.dialogs = dialogs;
        this.flash = flash;
        this.elements = this.#collectElements();
    }

    start () {
        this.stop();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;
        this.elements.form.addEventListener('submit', event => this.#save(event), { signal });
        this.elements.list.addEventListener('change', () => {
            this.#load(this.elements.list.value);
        }, { signal });
        this.elements.authentication.addEventListener('change', () => {
            this.#renderAuthenticationNote();
        }, { signal });
        this.dialog.addEventListener('click', event => this.#handleAction(event), { signal });
        this.dialog.addEventListener('cancel', event => {
            event.preventDefault();
            this.#close();
        }, { signal });
        this.#disposeProfiles = this.profiles.onDidChange(() => this.#renderList());
        this.#unregisterCommand = this.commands.register({
            id: WorkbenchCommand.CONNECTION_MANAGE_PROFILES,
            title: 'Manage IBM i connection profiles',
            category: 'Connection',
            execute: () => this.open(),
        });
    }

    stop () {
        this.#finishSelection(null);
        this.#abortController?.abort();
        this.#abortController = null;
        this.#disposeProfiles?.();
        this.#disposeProfiles = null;
        this.#unregisterCommand?.();
        this.#unregisterCommand = null;
    }

    open () {
        this.#renderList();
        const profileId = this.profiles.activeProfileId ?? this.profiles.profiles[0]?.id ?? null;
        if (profileId) this.#load(profileId);
        else this.#newProfile();
        if (!this.dialog.open) this.dialog.showModal();
        this.elements.name.focus();
        return true;
    }

    chooseProfile () {
        this.open();
        if (this.#selectionResolver) {
            throw new Error('A connection profile selection is already pending.');
        }
        return new Promise(resolve => {
            this.#selectionResolver = resolve;
        });
    }

    #renderList () {
        const selectedId = this.elements.id.value || this.profiles.activeProfileId;
        const options = this.profiles.profiles.map(profile => {
            const option = this.dialog.ownerDocument.createElement('option');
            option.value = profile.id;
            option.textContent = `${profile.id === this.profiles.activeProfileId ? '* ' : ''}` +
                `${profile.name} — ${profile.host}`;
            return option;
        });
        this.elements.list.replaceChildren(...options);
        if (selectedId && this.profiles.get(selectedId)) this.elements.list.value = selectedId;
        this.elements.delete.disabled = !this.elements.list.value;
    }

    #load (profileId) {
        const profile = this.profiles.get(profileId);
        if (!profile) return this.#newProfile();
        this.elements.id.value = profile.id;
        this.elements.name.value = profile.name;
        this.elements.host.value = profile.host;
        this.elements.port.value = String(profile.port);
        this.elements.username.value = profile.username;
        this.elements.authentication.value = profile.authentication;
        this.#renderAuthenticationNote();
        this.elements.defaultLibrary.value = profile.defaultLibrary;
        this.elements.libraryList.value = profile.libraryList.join(', ');
        this.elements.sourceCcsid.value = profile.sourceCcsid;
        this.elements.validation.textContent = '';
        this.elements.list.value = profile.id;
        this.elements.delete.disabled = false;
        return true;
    }

    #newProfile () {
        this.elements.form.reset();
        this.elements.id.value = '';
        this.elements.port.value = '22';
        this.elements.authentication.value = ConnectionAuthentication.AGENT;
        this.#renderAuthenticationNote();
        this.elements.defaultLibrary.value = '*CURLIB';
        this.elements.sourceCcsid.value = '*FILE';
        this.elements.list.value = '';
        this.elements.validation.textContent = '';
        this.elements.delete.disabled = true;
        this.elements.name.focus();
        return true;
    }

    #save (event) {
        event.preventDefault();
        try {
            const profile = new ConnectionProfile({
                id: this.elements.id.value || undefined,
                name: this.elements.name.value,
                host: this.elements.host.value,
                port: this.elements.port.value,
                username: this.elements.username.value,
                authentication: this.elements.authentication.value,
                defaultLibrary: this.elements.defaultLibrary.value,
                libraryList: this.elements.libraryList.value
                    .split(/[\s,;]+/)
                    .map(value => value.trim())
                    .filter(Boolean),
                sourceCcsid: this.elements.sourceCcsid.value,
            });
            const saved = this.profiles.save(profile);
            this.profiles.activate(saved.id);
            this.#renderList();
            this.#load(saved.id);
            this.flash?.(`IBM i profile ${saved.name} is ready.`, 'ok');
            if (this.#selectionResolver) {
                this.#finishSelection(saved);
                this.dialog.close();
            }
        } catch (error) {
            this.elements.validation.textContent =
                error instanceof Error ? error.message : String(error);
        }
    }

    async #deleteProfile () {
        const profile = this.profiles.get(this.elements.id.value);
        if (!profile) return false;
        if (!await this.dialogs.confirm({
            title: 'Delete IBM i profile',
            message: `Delete connection profile ${profile.name}?`,
            detail: 'Workspace references will remain disconnected until another profile is mapped.',
            acceptLabel: 'Delete',
            danger: true,
        })) return false;
        this.profiles.remove(profile.id);
        this.#renderList();
        const next = this.profiles.activeProfileId ?? this.profiles.profiles[0]?.id;
        if (next) this.#load(next);
        else this.#newProfile();
        return true;
    }

    #handleAction (event) {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'new') this.#newProfile();
        else if (action === 'delete') void this.#deleteProfile();
        else if (action === 'close') this.#close();
    }

    #close () {
        this.#finishSelection(null);
        this.dialog.close();
    }

    #finishSelection (profile) {
        const resolve = this.#selectionResolver;
        this.#selectionResolver = null;
        resolve?.(profile);
    }

    #collectElements () {
        const element = id => {
            const found = this.dialog.querySelector(`#${id}`);
            if (!found) throw new Error(`Connection profile control #${id} was not rendered.`);
            return found;
        };
        return Object.freeze({
            form: element('connectionProfileForm'),
            list: element('connectionProfileList'),
            id: element('connectionProfileId'),
            name: element('connectionProfileName'),
            host: element('connectionProfileHost'),
            port: element('connectionProfilePort'),
            username: element('connectionProfileUsername'),
            authentication: element('connectionProfileAuthentication'),
            authenticationNote: element('connectionProfileAuthenticationNote'),
            defaultLibrary: element('connectionProfileDefaultLibrary'),
            libraryList: element('connectionProfileLibraryList'),
            sourceCcsid: element('connectionProfileSourceCcsid'),
            validation: element('connectionProfileValidation'),
            delete: element('connectionProfileDelete'),
        });
    }

    #renderAuthenticationNote () {
        this.elements.authenticationNote.textContent =
            this.elements.authentication.value === ConnectionAuthentication.PASSWORD
                ? 'The password is requested when connecting and is never saved in this profile.'
                : 'Load an accepted identity into your operating-system SSH Agent.';
    }
}
