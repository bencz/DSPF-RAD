import { invoke } from '@tauri-apps/api/core';

import {
    IbmiWorkspaceRevisionConflictError,
    IbmiWorkspaceStoragePort,
} from '../../ibmi/IbmiWorkspaceStoragePort.js';
import { TauriIbmiCommandError } from './TauriIbmiCommandError.js';

export class TauriIbmiWorkspaceStoragePort extends IbmiWorkspaceStoragePort {
    constructor ({ invokeCommand = invoke } = {}) {
        if (typeof invokeCommand !== 'function') {
            throw new TypeError('TauriIbmiWorkspaceStoragePort requires an invoke function.');
        }
        super({ kind: 'tauri-sftp', available: true });
        this.invokeCommand = invokeCommand;
    }

    async readWorkspace (request) {
        try {
            return await this.invokeCommand('ibmi_workspace_read', { request });
        } catch (error) {
            throw TauriIbmiCommandError.from(error);
        }
    }

    async writeWorkspace (request) {
        try {
            return await this.invokeCommand('ibmi_workspace_write', { request });
        } catch (error) {
            const commandError = TauriIbmiCommandError.from(error);
            if (commandError.code === 'IBMI_WORKSPACE_REVISION_CONFLICT') {
                throw new IbmiWorkspaceRevisionConflictError({
                    path: commandError.detail?.path ?? request.path,
                    expectedRevision: commandError.detail?.expectedRevision ??
                        request.expectedRevision ?? null,
                    actualRevision: commandError.detail?.actualRevision ?? null,
                });
            }
            throw commandError;
        }
    }
}
