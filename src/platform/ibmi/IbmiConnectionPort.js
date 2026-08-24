export class IbmiConnectionUnavailableError extends Error {
    constructor (portKind) {
        super(`IBM i connections are not available through the ${portKind} port.`);
        this.name = 'IbmiConnectionUnavailableError';
        this.code = 'IBMI_CONNECTION_UNAVAILABLE';
        this.portKind = portKind;
    }
}

// Focused platform boundary for opening and closing IBM i sessions. Transport,
// SSH implementation, and credential retrieval remain private to the concrete
// desktop adapter.
export class IbmiConnectionPort {
    constructor ({ kind, available = false }) {
        if (!kind) throw new TypeError('An IBM i connection port requires a kind.');
        this.kind = kind;
        this.available = Boolean(available);
    }

    describe () {
        return Object.freeze({ kind: this.kind, available: this.available });
    }

    async connect () {
        throw new IbmiConnectionUnavailableError(this.kind);
    }

    async disconnect () {
        throw new IbmiConnectionUnavailableError(this.kind);
    }
}
