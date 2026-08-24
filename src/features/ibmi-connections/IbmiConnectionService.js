import { IbmiConnectionUnavailableError } from '../../platform/ibmi/IbmiConnectionPort.js';
import { IbmiConnectionSession } from './model/IbmiConnectionSession.js';

export const IbmiConnectionState = Object.freeze({
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTING: 'disconnecting',
    FAILED: 'failed',
});

export class IbmiConnectionStateError extends Error {
    constructor (message, state) {
        super(message);
        this.name = 'IbmiConnectionStateError';
        this.code = 'IBMI_CONNECTION_STATE';
        this.state = state;
    }
}

export class IbmiConnectionService {
    #listeners = new Set();

    constructor ({ profiles, port, clock = () => new Date().toISOString() }) {
        if (!profiles) throw new TypeError('IbmiConnectionService requires a profile store.');
        if (!port) throw new TypeError('IbmiConnectionService requires a connection port.');
        if (typeof clock !== 'function') throw new TypeError('Connection clock must be a function.');
        this.profiles = profiles;
        this.port = port;
        this.clock = clock;
        this.state = IbmiConnectionState.DISCONNECTED;
        this.profileId = null;
        this.session = null;
        this.error = null;
    }

    get profile () {
        return this.profiles.get(this.profileId) ?? null;
    }

    get isConnected () {
        return this.state === IbmiConnectionState.CONNECTED && this.session !== null;
    }

    canConnect (profileId = this.profiles.activeProfileId) {
        return this.port.available && Boolean(this.profiles.get(profileId)) &&
            (this.state === IbmiConnectionState.DISCONNECTED ||
             this.state === IbmiConnectionState.FAILED);
    }

    async connect (profileId = this.profiles.activeProfileId) {
        const profile = this.profiles.get(profileId);
        if (!profile) throw new Error(`Unknown connection profile: ${profileId ?? 'none'}`);
        if (!this.port.available) throw new IbmiConnectionUnavailableError(this.port.kind);
        if (this.state === IbmiConnectionState.CONNECTING ||
            this.state === IbmiConnectionState.DISCONNECTING) {
            throw new IbmiConnectionStateError(
                `Cannot connect while connection state is ${this.state}.`, this.state);
        }
        if (this.isConnected) {
            if (this.profileId === profile.id) return this.session;
            throw new IbmiConnectionStateError(
                'Disconnect the active IBM i session before connecting another profile.',
                this.state);
        }

        this.profileId = profile.id;
        this.session = null;
        this.error = null;
        this.#transition(IbmiConnectionState.CONNECTING);
        try {
            const result = await this.port.connect({ profile: profile.toJSON() });
            this.session = IbmiConnectionSession.fromConnectionResult(
                profile, result, this.clock());
            this.#transition(IbmiConnectionState.CONNECTED);
            return this.session;
        } catch (error) {
            this.session = null;
            this.error = error;
            this.#transition(IbmiConnectionState.FAILED);
            throw error;
        }
    }

    async disconnect () {
        if (!this.session) {
            if (this.state === IbmiConnectionState.FAILED) this.resetFailure();
            return false;
        }
        if (this.state !== IbmiConnectionState.CONNECTED) {
            throw new IbmiConnectionStateError(
                `Cannot disconnect while connection state is ${this.state}.`, this.state);
        }

        const session = this.session;
        this.error = null;
        this.#transition(IbmiConnectionState.DISCONNECTING);
        try {
            await this.port.disconnect({ sessionId: session.id });
            this.session = null;
            this.profileId = null;
            this.#transition(IbmiConnectionState.DISCONNECTED);
            return true;
        } catch (error) {
            this.error = error;
            this.#transition(IbmiConnectionState.CONNECTED);
            throw error;
        }
    }

    resetFailure () {
        if (this.state !== IbmiConnectionState.FAILED) return false;
        this.error = null;
        this.profileId = null;
        this.#transition(IbmiConnectionState.DISCONNECTED);
        return true;
    }

    onDidChange (listener) {
        if (typeof listener !== 'function') throw new TypeError('Connection listener must be a function.');
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    describe () {
        return Object.freeze({
            state: this.state,
            profileId: this.profileId,
            session: this.session?.describe() ?? null,
            port: this.port.describe(),
        });
    }

    #transition (state) {
        const previousState = this.state;
        this.state = state;
        const event = Object.freeze({
            previousState,
            state,
            profileId: this.profileId,
            session: this.session,
            service: this,
        });
        for (const listener of this.#listeners) listener(event);
    }
}
