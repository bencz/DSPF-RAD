import { ConnectionProfile } from './ConnectionProfile.js';

export const CONNECTION_PROFILE_FORMAT = 'IRONTERM-CONNECTION-PROFILES';
export const CONNECTION_PROFILE_VERSION = 1;

const STORAGE_KEY = 'ironterm:connection-profiles:v1';

export class ConnectionProfileStore {
    #profiles = new Map();
    #listeners = new Set();

    constructor ({ storage = globalThis.localStorage, logger = globalThis.console } = {}) {
        this.storage = storage;
        this.logger = logger;
        this.activeProfileId = null;
    }

    load () {
        try {
            const text = this.storage.getItem(STORAGE_KEY);
            if (!text) return this;
            const data = JSON.parse(text);
            if (data.format !== CONNECTION_PROFILE_FORMAT || data.version !== CONNECTION_PROFILE_VERSION) {
                throw new Error('Unsupported connection profile store format.');
            }
            const profiles = (data.profiles ?? []).map(ConnectionProfile.fromJSON);
            this.#profiles = new Map(profiles.map(profile => [profile.id, profile]));
            this.activeProfileId = this.#profiles.has(data.activeProfileId)
                ? data.activeProfileId
                : profiles[0]?.id ?? null;
        } catch (error) {
            this.logger.warn('[ironterm] connection profiles could not be loaded:', error);
            this.#profiles.clear();
            this.activeProfileId = null;
        }
        return this;
    }

    get profiles () {
        return Object.freeze([...this.#profiles.values()]);
    }

    get activeProfile () {
        return this.#profiles.get(this.activeProfileId) ?? null;
    }

    get (profileId) {
        return this.#profiles.get(profileId) ?? null;
    }

    save (profileData) {
        const profile = profileData instanceof ConnectionProfile
            ? profileData
            : ConnectionProfile.fromJSON(profileData);
        this.#profiles.set(profile.id, profile);
        if (!this.activeProfileId) this.activeProfileId = profile.id;
        this.#persist();
        this.#emit('profile.saved', profile);
        return profile;
    }

    remove (profileId) {
        const profile = this.#profiles.get(profileId);
        if (!profile) return false;
        this.#profiles.delete(profileId);
        if (this.activeProfileId === profileId) {
            this.activeProfileId = this.profiles[0]?.id ?? null;
        }
        this.#persist();
        this.#emit('profile.removed', profile);
        return true;
    }

    activate (profileId) {
        if (!this.#profiles.has(profileId)) throw new Error(`Unknown connection profile: ${profileId}`);
        if (this.activeProfileId === profileId) return false;
        this.activeProfileId = profileId;
        this.#persist();
        this.#emit('profile.activated', this.activeProfile);
        return true;
    }

    onDidChange (listener) {
        if (typeof listener !== 'function') throw new TypeError('Profile store listener must be a function.');
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    toJSON () {
        return {
            format: CONNECTION_PROFILE_FORMAT,
            version: CONNECTION_PROFILE_VERSION,
            activeProfileId: this.activeProfileId,
            profiles: this.profiles.map(profile => profile.toJSON()),
        };
    }

    #persist () {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(this.toJSON()));
    }

    #emit (type, profile) {
        const event = Object.freeze({ type, profile, store: this });
        for (const listener of this.#listeners) listener(event);
    }
}
