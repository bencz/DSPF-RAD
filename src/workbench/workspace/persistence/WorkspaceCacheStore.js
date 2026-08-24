import { Workspace } from '../Workspace.js';
import { WorkspaceStorageLocation } from './WorkspaceStorageLocation.js';

export const WORKSPACE_CACHE_FORMAT = 'IRONTERM-WORKSPACE-CACHE';
export const WORKSPACE_CACHE_VERSION = 1;

const DEFAULT_CACHE_KEY = 'ironterm.workspace.last-session.v1';
const CREDENTIAL_KEY = /(password|passphrase|private.?key|secret|token|credential)/i;

export class WorkspaceCacheStore {
    constructor ({
        storage,
        key = DEFAULT_CACHE_KEY,
        clock = () => new Date().toISOString(),
        logger = globalThis.console,
    }) {
        if (!storage) throw new TypeError('WorkspaceCacheStore requires storage.');
        if (typeof clock !== 'function') throw new TypeError('Workspace cache clock must be a function.');
        this.storage = storage;
        this.key = key;
        this.clock = clock;
        this.logger = logger;
    }

    load () {
        const text = this.storage.getItem(this.key);
        if (!text) return null;
        try {
            const value = JSON.parse(text);
            assertNoCredentials(value);
            if (value?.format !== WORKSPACE_CACHE_FORMAT ||
                value.version !== WORKSPACE_CACHE_VERSION) {
                throw new Error('Unsupported workspace cache format.');
            }
            return Object.freeze({
                workspace: Workspace.fromJSON(value.workspace),
                location: WorkspaceStorageLocation.fromJSON(value.location),
                revision: optionalText(value.revision),
                fileName: optionalText(value.fileName),
                isDirty: Boolean(value.isDirty),
                cachedAt: isoTimestamp(value.cachedAt),
            });
        } catch (error) {
            this.logger.error('[ironterm] workspace cache could not be restored:', error);
            return null;
        }
    }

    save (session) {
        const value = {
            format: WORKSPACE_CACHE_FORMAT,
            version: WORKSPACE_CACHE_VERSION,
            cachedAt: isoTimestamp(this.clock()),
            fileName: session.fileName,
            location: session.location?.toJSON() ?? null,
            revision: session.revision,
            isDirty: session.isDirty,
            workspace: session.workspace.toJSON(),
        };
        this.storage.setItem(this.key, JSON.stringify(value));
        return Object.freeze({ ...value });
    }
}

function assertNoCredentials (value, path = 'workspaceCache') {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
        if (CREDENTIAL_KEY.test(key)) {
            throw new Error(`Credentials are not allowed in workspace cache (${path}.${key}).`);
        }
        assertNoCredentials(child, `${path}.${key}`);
    }
}

function optionalText (value) {
    const text = String(value ?? '').trim();
    return text || null;
}

function isoTimestamp (value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid workspace cache timestamp: ${value}`);
    return date.toISOString();
}
