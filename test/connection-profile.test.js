import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ConnectionAuthentication, ConnectionProfile,
} from '../src/features/ibmi-connections/model/ConnectionProfile.js';
import {
    ConnectionProfileStore,
} from '../src/features/ibmi-connections/model/ConnectionProfileStore.js';

class MemoryStorage {
    constructor () { this.values = new Map(); }
    getItem (key) { return this.values.get(key) ?? null; }
    setItem (key, value) { this.values.set(key, String(value)); }
}

test('connection profile normalizes IBM i metadata without secrets', () => {
    const profile = new ConnectionProfile({
        id: 'development',
        name: 'Development',
        host: 'ibmi.example.net',
        username: 'alex',
        authentication: ConnectionAuthentication.PRIVATE_KEY,
        defaultLibrary: 'devlib',
        libraryList: ['qgpl', 'DEVLIB', 'qgpl'],
        sourceCcsid: '37',
    });

    assert.equal(profile.defaultLibrary, 'DEVLIB');
    assert.deepEqual(profile.libraryList, ['QGPL', 'DEVLIB']);
    assert.equal(profile.sourceCcsid, '37');
    assert.equal(Object.isFrozen(profile), true);
    assert.equal(JSON.stringify(profile).includes('privateKey'), false);
});

test('connection profiles reject embedded credentials and invalid ports', () => {
    assert.throws(() => new ConnectionProfile({
        id: 'unsafe-direct', name: 'Unsafe', host: 'localhost', password: 'secret',
    }), /Credentials are not allowed/);
    assert.throws(() => ConnectionProfile.fromJSON({
        id: 'unsafe', name: 'Unsafe', host: 'localhost', password: 'secret',
    }), /Credentials are not allowed/);
    assert.throws(() => new ConnectionProfile({
        id: 'bad-port', name: 'Bad port', host: 'localhost', port: 70000,
    }), /Invalid SSH port/);
    assert.throws(() => new ConnectionProfile({
        id: 'bad-ccsid', name: 'Bad CCSID', host: 'localhost', sourceCcsid: '37) escape',
    }), /Invalid IBM i source CCSID/);
});

test('connection profile store persists metadata and active selection', () => {
    const storage = new MemoryStorage();
    const store = new ConnectionProfileStore({ storage }).load();
    store.save({ id: 'dev', name: 'Development', host: 'dev.example.net' });
    store.save({ id: 'prod', name: 'Production', host: 'prod.example.net' });
    store.activate('prod');

    const restored = new ConnectionProfileStore({ storage }).load();
    assert.deepEqual(restored.profiles.map(profile => profile.id), ['dev', 'prod']);
    assert.equal(restored.activeProfile.id, 'prod');
    restored.remove('prod');
    assert.equal(restored.activeProfile.id, 'dev');
});
