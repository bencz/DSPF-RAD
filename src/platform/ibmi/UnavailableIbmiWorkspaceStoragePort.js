import { IbmiWorkspaceStoragePort } from './IbmiWorkspaceStoragePort.js';

export class UnavailableIbmiWorkspaceStoragePort extends IbmiWorkspaceStoragePort {
    constructor ({ hostKind = 'browser' } = {}) {
        super({ kind: `${hostKind}-unavailable`, available: false });
    }
}
