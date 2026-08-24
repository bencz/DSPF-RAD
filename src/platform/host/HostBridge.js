export class UnsupportedHostOperationError extends Error {
    constructor (operation, hostKind) {
        super(`${operation} is not supported by the ${hostKind} host.`);
        this.name = 'UnsupportedHostOperationError';
        this.operation = operation;
        this.hostKind = hostKind;
    }
}

// Boundary between the workbench and environment-specific capabilities.
// Domain modules must never import a concrete host implementation.
export class HostBridge {
    constructor ({ kind, capabilities = [] }) {
        if (!kind) throw new TypeError('A host bridge requires a kind.');
        this.kind = kind;
        this._capabilities = new Set(capabilities);
    }

    get capabilities () { return Object.freeze([...this._capabilities]); }
    supports (capability) { return this._capabilities.has(capability); }

    describe () {
        return Object.freeze({ kind: this.kind, capabilities: this.capabilities });
    }

    async openTextFile () { this.unsupported('openTextFile'); }
    async saveTextFile () { this.unsupported('saveTextFile'); }

    unsupported (operation) {
        throw new UnsupportedHostOperationError(operation, this.kind);
    }
}
