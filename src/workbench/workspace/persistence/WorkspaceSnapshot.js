import { Workspace } from '../Workspace.js';
import { WorkspaceStorageLocation } from './WorkspaceStorageLocation.js';

export class WorkspaceSnapshot {
    constructor ({ workspace, location = null, revision = null, capturedAt = null }) {
        if (!(workspace instanceof Workspace)) {
            throw new TypeError('WorkspaceSnapshot requires a Workspace instance.');
        }
        this.workspace = workspace;
        this.location = WorkspaceStorageLocation.fromJSON(location);
        this.revision = optionalText(revision);
        this.capturedAt = capturedAt ? isoTimestamp(capturedAt) : null;
        Object.freeze(this);
    }

    describe () {
        return Object.freeze({
            workspaceId: this.workspace.id,
            location: this.location?.toJSON() ?? null,
            revision: this.revision,
            capturedAt: this.capturedAt,
        });
    }
}

function optionalText (value) {
    const text = String(value ?? '').trim();
    return text || null;
}

function isoTimestamp (value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid snapshot timestamp: ${value}`);
    return date.toISOString();
}
