import test from 'node:test';
import assert from 'node:assert/strict';

import { IbmiWorkspaceService } from '../src/features/ibmi-workspaces/IbmiWorkspaceService.js';
import { IbmiWorkspaceStoragePort } from '../src/platform/ibmi/IbmiWorkspaceStoragePort.js';
import { Workspace } from '../src/workbench/workspace/Workspace.js';
import { WorkspaceSession } from '../src/workbench/workspace/WorkspaceSession.js';
import { WorkspaceCacheStore } from '../src/workbench/workspace/persistence/WorkspaceCacheStore.js';
import { WorkspaceStorageLocation } from '../src/workbench/workspace/persistence/WorkspaceStorageLocation.js';

class MemoryStorage {
    #values = new Map();

    getItem (key) {
        return this.#values.get(key) ?? null;
    }

    setItem (key, value) {
        this.#values.set(key, String(value));
    }
}

class WorkspacePort extends IbmiWorkspaceStoragePort {
    constructor () {
        super({ kind: 'test-ibmi', available: true });
        this.lastWrite = null;
    }

    async readWorkspace () {
        return {
            text: JSON.stringify(new Workspace({
                id: 'remote-workspace',
                name: 'Remote development',
            }).toJSON()),
            revision: 'remote-r3',
        };
    }

    async writeWorkspace (request) {
        this.lastWrite = request;
        return { revision: 'remote-r2' };
    }
}

test('workspace cache restores dirty offline state and its remote IFS origin', () => {
    const storage = new MemoryStorage();
    const cache = new WorkspaceCacheStore({
        storage,
        key: 'workspace-cache',
        clock: () => '2026-08-24T12:00:00.000Z',
        logger: { error () {} },
    });
    const location = WorkspaceStorageLocation.ibmiIfs({
        path: '/home/DEV/.ironterm/orders.itworkspace',
        connectionProfileId: 'development',
    });
    const workspace = new Workspace({ id: 'orders', name: 'Orders' });
    const session = new WorkspaceSession({
        workspace,
        fileName: location.fileName,
        location,
        revision: 'remote-r1',
    });
    workspace.rename('Orders maintenance');

    cache.save(session);
    const restored = cache.load();

    assert.equal(restored.workspace.name, 'Orders maintenance');
    assert.equal(restored.location.path, location.path);
    assert.equal(restored.revision, 'remote-r1');
    assert.equal(restored.isDirty, true);

    const unsafe = JSON.parse(storage.getItem('workspace-cache'));
    unsafe.password = 'must-not-enter-the-cache';
    storage.setItem('workspace-cache', JSON.stringify(unsafe));
    assert.equal(cache.load(), null);
});

test('IBM i workspace saves use optimistic revisions and update the session boundary', async () => {
    const port = new WorkspacePort();
    const connectionService = {
        isConnected: true,
        session: { id: 'session-1', profileId: 'development' },
    };
    const service = new IbmiWorkspaceService({
        connectionService,
        port,
        clock: () => '2026-08-24T12:00:00.000Z',
    });
    const location = WorkspaceStorageLocation.ibmiIfs({
        path: '/home/DEV/.ironterm/orders.itworkspace',
        connectionProfileId: 'development',
    });
    const workspace = new Workspace({ id: 'orders', name: 'Orders' });
    const session = new WorkspaceSession({
        workspace,
        fileName: location.fileName,
        location,
        revision: 'remote-r1',
    });
    workspace.rename('Orders maintenance');

    const saved = await service.save(session);
    const loaded = await service.load(location);

    assert.equal(port.lastWrite.expectedRevision, 'remote-r1');
    assert.equal(JSON.parse(port.lastWrite.text).name, 'Orders maintenance');
    assert.equal(saved.revision, 'remote-r2');
    assert.equal(session.revision, 'remote-r2');
    assert.equal(session.isDirty, false);
    assert.equal(loaded.workspace.name, 'Remote development');
    assert.equal(loaded.revision, 'remote-r3');
});

test('remote workspace locations require safe absolute IFS paths', () => {
    assert.throws(() => WorkspaceStorageLocation.ibmiIfs({
        path: '../orders.itworkspace',
        connectionProfileId: 'development',
    }), /must be absolute/);
});
