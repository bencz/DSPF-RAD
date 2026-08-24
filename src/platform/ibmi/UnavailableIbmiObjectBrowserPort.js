import { IbmiObjectBrowserPort } from './IbmiObjectBrowserPort.js';

export class UnavailableIbmiObjectBrowserPort extends IbmiObjectBrowserPort {
    constructor ({ hostKind }) {
        super({ kind: `${hostKind}-unavailable`, available: false });
    }
}
