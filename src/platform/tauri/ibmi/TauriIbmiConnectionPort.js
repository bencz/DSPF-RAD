import { invoke } from '@tauri-apps/api/core';

import { IbmiConnectionPort } from '../../ibmi/IbmiConnectionPort.js';
import { TauriIbmiCommandError } from './TauriIbmiCommandError.js';

export class TauriIbmiConnectionPort extends IbmiConnectionPort {
    constructor ({ invokeCommand = invoke } = {}) {
        if (typeof invokeCommand !== 'function') {
            throw new TypeError('TauriIbmiConnectionPort requires an invoke function.');
        }
        super({ kind: 'tauri-ssh', available: true });
        this.invokeCommand = invokeCommand;
    }

    async connect ({ profile, secret = null }) {
        try {
            return await this.invokeCommand('ibmi_connect', {
                request: { profile, secret },
            });
        } catch (error) {
            throw TauriIbmiCommandError.from(error);
        }
    }

    async disconnect ({ sessionId }) {
        try {
            await this.invokeCommand('ibmi_disconnect', { sessionId });
        } catch (error) {
            throw TauriIbmiCommandError.from(error);
        }
    }
}
