export const ConnectionAuthentication = Object.freeze({
    AGENT: 'agent',
    PRIVATE_KEY: 'private-key',
    PASSWORD: 'password',
});

const AUTHENTICATION_METHODS = new Set(Object.values(ConnectionAuthentication));
const CREDENTIAL_KEY = /(password|passphrase|private.?key|secret|token|credential)/i;
const LIBRARY_NAME = /^(?:[A-Z0-9_$#@]{1,10}|\*CURLIB)$/;

export class ConnectionProfile {
    constructor ({
        id = ConnectionProfile.createId(),
        name,
        host,
        port = 22,
        username = '',
        authentication = ConnectionAuthentication.AGENT,
        defaultLibrary = '*CURLIB',
        libraryList = [],
        ...additional
    }) {
        ConnectionProfile.assertNoCredentials(additional);
        this.id = ConnectionProfile.requiredText(id, 'Profile id');
        this.name = ConnectionProfile.requiredText(name, 'Profile name');
        this.host = ConnectionProfile.requiredText(host, 'Host');
        this.port = ConnectionProfile.validPort(port);
        this.username = String(username ?? '').trim();
        if (!AUTHENTICATION_METHODS.has(authentication)) {
            throw new Error(`Unsupported authentication method: ${authentication}`);
        }
        this.authentication = authentication;
        this.defaultLibrary = ConnectionProfile.libraryName(defaultLibrary);
        this.libraryList = Object.freeze(ConnectionProfile.libraryList(libraryList));
        Object.freeze(this);
    }

    static fromJSON (value) {
        ConnectionProfile.assertNoCredentials(value);
        return new ConnectionProfile(value);
    }

    toJSON () {
        return {
            id: this.id,
            name: this.name,
            host: this.host,
            port: this.port,
            username: this.username,
            authentication: this.authentication,
            defaultLibrary: this.defaultLibrary,
            libraryList: [...this.libraryList],
        };
    }

    static assertNoCredentials (value, path = 'profile') {
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
            if (CREDENTIAL_KEY.test(key)) {
                throw new Error(`Credentials are not allowed in connection profiles (${path}.${key}).`);
            }
            ConnectionProfile.assertNoCredentials(child, `${path}.${key}`);
        }
    }

    static libraryList (values) {
        if (!Array.isArray(values)) throw new TypeError('Library list must be an array.');
        return [...new Set(values.map(value => ConnectionProfile.libraryName(value)))]
            .filter(value => value !== '*CURLIB');
    }

    static libraryName (value) {
        const name = String(value ?? '').trim().toUpperCase() || '*CURLIB';
        if (!LIBRARY_NAME.test(name)) throw new Error(`Invalid IBM i library name: ${name}`);
        return name;
    }

    static validPort (value) {
        const port = Number(value);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new RangeError(`Invalid SSH port: ${value}`);
        }
        return port;
    }

    static requiredText (value, label) {
        const text = String(value ?? '').trim();
        if (!text) throw new TypeError(`${label} is required.`);
        return text;
    }

    static createId () {
        const uuid = globalThis.crypto?.randomUUID?.();
        return uuid ? `ibmi-${uuid}` : `ibmi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
}
