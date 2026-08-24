import { IbmiSystemName } from './IbmiSystemName.js';

export class IbmiProjectLocation {
    constructor ({ connectionProfileId, library }) {
        this.connectionProfileId = IbmiProjectLocation.requiredText(
            connectionProfileId, 'Connection profile id');
        this.library = IbmiSystemName.normalize(library, 'library');
        Object.freeze(this);
    }

    static fromProject (project) {
        if (!project?.connectionProfileId) {
            throw new Error('IBM i projects require a connection profile.');
        }
        const rootUri = IbmiProjectLocation.requiredText(project.rootUri, 'IBM i project root URI');
        let url;
        try {
            url = new URL(rootUri);
        } catch {
            throw new Error(`Invalid IBM i project root URI: ${rootUri}`);
        }
        const segments = url.pathname.split('/').filter(Boolean);
        if (url.protocol !== 'ibmi:' || !url.hostname || segments.length !== 1 ||
            url.search || url.hash) {
            throw new Error(`Invalid IBM i project root URI: ${rootUri}`);
        }
        const profileId = decodeURIComponent(url.hostname);
        if (profileId !== project.connectionProfileId) {
            throw new Error('IBM i project URI and connection profile do not match.');
        }
        return new IbmiProjectLocation({
            connectionProfileId: profileId,
            library: decodeURIComponent(segments[0]),
        });
    }

    static create ({ connectionProfileId, library }) {
        const location = new IbmiProjectLocation({ connectionProfileId, library });
        if (!/^[a-z0-9.-]+$/i.test(location.connectionProfileId)) {
            throw new Error('Connection profile ids used in IBM i URIs must be URI host names.');
        }
        return `ibmi://${location.connectionProfileId}/${location.library}`;
    }

    static requiredText (value, label) {
        const text = String(value ?? '').trim();
        if (!text) throw new TypeError(`${label} is required.`);
        return text;
    }
}
