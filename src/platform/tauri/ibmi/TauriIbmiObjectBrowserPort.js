import { invoke } from '@tauri-apps/api/core';

import { IbmiObjectBrowserPort } from '../../ibmi/IbmiObjectBrowserPort.js';
import { TauriIbmiCommandError } from './TauriIbmiCommandError.js';

export class TauriIbmiObjectBrowserPort extends IbmiObjectBrowserPort {
    constructor ({ invokeCommand = invoke } = {}) {
        if (typeof invokeCommand !== 'function') {
            throw new TypeError('TauriIbmiObjectBrowserPort requires an invoke function.');
        }
        super({ kind: 'tauri-qsys-library', available: true });
        this.invokeCommand = invokeCommand;
    }

    async listLibraryObjects (request) {
        try {
            return await this.invokeCommand('ibmi_library_objects', { request });
        } catch (error) {
            throw TauriIbmiCommandError.from(error);
        }
    }

    async listSourceMembers (request) {
        try {
            return await this.invokeCommand('ibmi_source_members', { request });
        } catch (error) {
            throw TauriIbmiCommandError.from(error);
        }
    }

    async readSourceMember (request) {
        try {
            return await this.invokeCommand('ibmi_source_member_read', { request });
        } catch (error) {
            throw TauriIbmiCommandError.from(error);
        }
    }
}
