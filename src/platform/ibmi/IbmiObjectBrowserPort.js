export class IbmiObjectBrowserUnavailableError extends Error {
    constructor (portKind) {
        super(`IBM i object browsing is not available through the ${portKind} port.`);
        this.name = 'IbmiObjectBrowserUnavailableError';
        this.code = 'IBMI_OBJECT_BROWSER_UNAVAILABLE';
        this.portKind = portKind;
    }
}

export class IbmiObjectBrowserPort {
    constructor ({ kind, available = false }) {
        if (!kind) throw new TypeError('An IBM i object browser port requires a kind.');
        this.kind = kind;
        this.available = Boolean(available);
    }

    describe () {
        return Object.freeze({ kind: this.kind, available: this.available });
    }

    async listLibraryObjects () {
        throw new IbmiObjectBrowserUnavailableError(this.kind);
    }

    async listSourceMembers () {
        throw new IbmiObjectBrowserUnavailableError(this.kind);
    }

    async readSourceMember () {
        throw new IbmiObjectBrowserUnavailableError(this.kind);
    }
}
