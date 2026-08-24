import test from 'node:test';
import assert from 'node:assert/strict';

import { ConnectionController } from '../src/features/ibmi-connections/ConnectionController.js';
import {
    IbmiConnectionService,
    IbmiConnectionState,
} from '../src/features/ibmi-connections/IbmiConnectionService.js';
import { ConnectionProfileStore } from '../src/features/ibmi-connections/model/ConnectionProfileStore.js';
import { IbmiConnectionSession } from '../src/features/ibmi-connections/model/IbmiConnectionSession.js';
import { IbmiConnectionPort } from '../src/platform/ibmi/IbmiConnectionPort.js';
import { UnavailableIbmiConnectionPort } from '../src/platform/ibmi/UnavailableIbmiConnectionPort.js';
import { CommandRegistry } from '../src/workbench/commands/CommandRegistry.js';
import { WorkbenchCommand } from '../src/workbench/commands/commandIds.js';
import { Workspace, WorkspaceProjectKind } from '../src/workbench/workspace/Workspace.js';
import { WorkspaceSession } from '../src/workbench/workspace/WorkspaceSession.js';

class MemoryStorage {
    constructor () { this.values = new Map(); }
    getItem (key) { return this.values.get(key) ?? null; }
    setItem (key, value) { this.values.set(key, String(value)); }
}

class TestConnectionPort extends IbmiConnectionPort {
    constructor () {
        super({ kind: 'test-ssh', available: true });
        this.connectRequests = [];
        this.disconnectRequests = [];
    }

    async connect (request) {
        this.connectRequests.push(request);
        return {
            id: 'session-1',
            systemName: 'DEV400',
            release: 'V7R5M0',
            jobName: '123456/ALEX/QPADEV0001',
            currentLibrary: 'DEVLIB',
            libraryList: ['DEVLIB', 'QGPL'],
        };
    }

    async disconnect (request) {
        this.disconnectRequests.push(request);
    }
}

function createProfiles () {
    const profiles = new ConnectionProfileStore({ storage: new MemoryStorage() }).load();
    profiles.save({
        id: 'development',
        name: 'Development',
        host: 'dev.example.net',
        username: 'alex',
        defaultLibrary: 'DEVLIB',
    });
    profiles.save({
        id: 'production',
        name: 'Production',
        host: 'prod.example.net',
        username: 'alex',
    });
    return profiles;
}

test('connection service owns the explicit IBM i session lifecycle', async () => {
    const profiles = createProfiles();
    const port = new TestConnectionPort();
    const service = new IbmiConnectionService({
        profiles,
        port,
        clock: () => '2026-08-24T12:00:00.000Z',
    });
    const states = [];
    service.onDidChange(event => states.push(event.state));

    const session = await service.connect('development');
    assert.equal(session instanceof IbmiConnectionSession, true);
    assert.equal(service.isConnected, true);
    assert.equal(session.systemName, 'DEV400');
    assert.equal(session.connectedAt, '2026-08-24T12:00:00.000Z');
    assert.deepEqual(port.connectRequests[0], {
        profile: profiles.get('development').toJSON(),
    });

    await service.disconnect();
    assert.equal(service.state, IbmiConnectionState.DISCONNECTED);
    assert.deepEqual(port.disconnectRequests, [{ sessionId: 'session-1' }]);
    assert.deepEqual(states, [
        IbmiConnectionState.CONNECTING,
        IbmiConnectionState.CONNECTED,
        IbmiConnectionState.DISCONNECTING,
        IbmiConnectionState.DISCONNECTED,
    ]);
});

test('unavailable connection ports fail before creating a session', async () => {
    const service = new IbmiConnectionService({
        profiles: createProfiles(),
        port: new UnavailableIbmiConnectionPort({ hostKind: 'browser' }),
    });

    assert.equal(service.canConnect('development'), false);
    await assert.rejects(service.connect('development'), error => {
        assert.equal(error.code, 'IBMI_CONNECTION_UNAVAILABLE');
        return true;
    });
    assert.equal(service.state, IbmiConnectionState.DISCONNECTED);
    assert.equal(service.session, null);
});

test('session results reject credentials returned by an adapter', () => {
    const profile = createProfiles().get('development');
    assert.throws(() => new IbmiConnectionSession({
        id: 'unsafe-direct', profileId: profile.id, token: 'secret',
    }), /Credentials are not allowed/);
    assert.throws(() => IbmiConnectionSession.fromConnectionResult(profile, {
        id: 'unsafe-session',
        password: 'must-not-cross-the-platform-boundary',
    }), /Credentials are not allowed/);
});

test('connection controller resolves the active IBM i project profile', async () => {
    const profiles = createProfiles();
    profiles.activate('production');
    const service = new IbmiConnectionService({ profiles, port: new TestConnectionPort() });
    const workspace = new Workspace({
        id: 'workspace',
        name: 'Development workspace',
        projects: [{
            id: 'remote-project',
            name: 'DEVLIB',
            kind: WorkspaceProjectKind.IBMI,
            rootUri: 'ibmi://development/DEVLIB',
            connectionProfileId: 'development',
        }],
    });
    const commands = new CommandRegistry();
    const messages = [];
    const controller = new ConnectionController({
        service,
        profiles,
        workspaceSession: new WorkspaceSession({ workspace }),
        commands,
        flash: message => messages.push(message),
    });
    controller.start();

    assert.equal(commands.canExecute(WorkbenchCommand.CONNECTION_CONNECT), true);
    await commands.execute(WorkbenchCommand.CONNECTION_CONNECT);
    assert.equal(service.profileId, 'development');
    assert.equal(profiles.activeProfileId, 'development');
    assert.deepEqual(messages, ['Connected to Development.']);
    assert.equal(commands.canExecute(WorkbenchCommand.CONNECTION_DISCONNECT), true);
});
