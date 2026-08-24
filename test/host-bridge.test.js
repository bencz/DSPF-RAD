import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BrowserHostBridge,
    HostBridge,
    HostCapability,
    UnsupportedHostOperationError,
} from '../src/platform/host/index.js';

test('host bridge exposes a read-only capability snapshot', () => {
    const host = new HostBridge({
        kind: 'test',
        capabilities: [HostCapability.RUN_CL],
    });

    const description = host.describe();
    assert.equal(description.kind, 'test');
    assert.deepEqual(description.capabilities, [HostCapability.RUN_CL]);
    assert.equal(host.supports(HostCapability.RUN_CL), true);
    assert.equal(host.supports(HostCapability.REMOTE_SSH), false);
    assert.equal(Object.isFrozen(description), true);
    assert.equal(Object.isFrozen(description.capabilities), true);
});

test('unsupported operations fail with a structured error', async () => {
    const host = new HostBridge({ kind: 'test' });

    await assert.rejects(host.runCl('DSPJOB'), error => {
        assert.equal(error instanceof UnsupportedHostOperationError, true);
        assert.equal(error.operation, 'runCl');
        assert.equal(error.hostKind, 'test');
        return true;
    });
});

test('browser host advertises only local file operations', () => {
    const host = new BrowserHostBridge({ documentRef: {}, urlRef: {} });

    assert.deepEqual(host.capabilities, [
        HostCapability.OPEN_LOCAL_TEXT,
        HostCapability.SAVE_LOCAL_TEXT,
    ]);
    assert.equal(host.supports(HostCapability.REMOTE_SSH), false);
});
