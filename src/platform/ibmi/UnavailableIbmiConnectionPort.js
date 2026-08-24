import { IbmiConnectionPort } from './IbmiConnectionPort.js';

export class UnavailableIbmiConnectionPort extends IbmiConnectionPort {
    constructor ({ hostKind = 'browser' } = {}) {
        super({ kind: `${hostKind}-unavailable`, available: false });
    }
}
