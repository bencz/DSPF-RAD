import { ConnectionProfile } from './ConnectionProfile.js';

const CREDENTIAL_KEY = /(password|passphrase|private.?key|secret|token|credential)/i;

export class IbmiConnectionSession {
    constructor ({
        id,
        profileId,
        connectedAt = new Date().toISOString(),
        systemName = null,
        release = null,
        jobName = null,
        currentLibrary = null,
        libraryList = [],
        ...additional
    }) {
        IbmiConnectionSession.assertNoCredentials(additional);
        IbmiConnectionSession.assertNoCredentials({
            id, profileId, connectedAt, systemName, release, jobName,
            currentLibrary, libraryList,
        });
        this.id = IbmiConnectionSession.requiredText(id, 'Session id');
        this.profileId = IbmiConnectionSession.requiredText(profileId, 'Connection profile id');
        this.connectedAt = IbmiConnectionSession.isoTimestamp(connectedAt);
        this.systemName = IbmiConnectionSession.optionalText(systemName);
        this.release = IbmiConnectionSession.optionalText(release);
        this.jobName = IbmiConnectionSession.optionalText(jobName);
        const normalizedCurrentLibrary = IbmiConnectionSession.optionalText(currentLibrary);
        this.currentLibrary = normalizedCurrentLibrary
            ? ConnectionProfile.libraryName(normalizedCurrentLibrary)
            : null;
        if (!Array.isArray(libraryList)) throw new TypeError('Session library list must be an array.');
        this.libraryList = Object.freeze(ConnectionProfile.libraryList(libraryList));
        Object.freeze(this);
    }

    static fromConnectionResult (profile, result, connectedAt = new Date().toISOString()) {
        if (!profile) throw new TypeError('A connection profile is required.');
        IbmiConnectionSession.assertNoCredentials(result, 'connectionResult');
        return new IbmiConnectionSession({
            ...result,
            profileId: profile.id,
            connectedAt: result?.connectedAt ?? connectedAt,
            currentLibrary: result?.currentLibrary ?? profile.defaultLibrary,
            libraryList: result?.libraryList ?? profile.libraryList,
        });
    }

    describe () {
        return Object.freeze({
            id: this.id,
            profileId: this.profileId,
            connectedAt: this.connectedAt,
            systemName: this.systemName,
            release: this.release,
            jobName: this.jobName,
            currentLibrary: this.currentLibrary,
            libraryList: this.libraryList,
        });
    }

    static assertNoCredentials (value, path = 'session') {
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
            if (CREDENTIAL_KEY.test(key)) {
                throw new Error(`Credentials are not allowed in IBM i sessions (${path}.${key}).`);
            }
            IbmiConnectionSession.assertNoCredentials(child, `${path}.${key}`);
        }
    }

    static requiredText (value, label) {
        const text = String(value ?? '').trim();
        if (!text) throw new TypeError(`${label} is required.`);
        return text;
    }

    static optionalText (value) {
        const text = String(value ?? '').trim();
        return text || null;
    }

    static isoTimestamp (value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) throw new Error(`Invalid connection timestamp: ${value}`);
        return date.toISOString();
    }
}
