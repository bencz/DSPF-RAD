import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CommandRegistry, UnknownCommandError,
} from '../src/workbench/commands/CommandRegistry.js';

test('command registry executes registered commands and returns their value', async () => {
    const registry = new CommandRegistry();
    registry.register({
        id: 'test.run', title: 'Run test', category: 'Test',
        execute: async context => context.value * 2,
    });

    assert.deepEqual(await registry.execute('test.run', { value: 21 }), {
        executed: true, value: 42,
    });
    assert.deepEqual(registry.list(), [{
        id: 'test.run', title: 'Run test', category: 'Test', enabled: true,
    }]);
});

test('disabled commands are reported without invoking their handler', async () => {
    const registry = new CommandRegistry();
    let calls = 0;
    registry.register({
        id: 'test.disabled',
        execute: () => { calls += 1; },
        isEnabled: context => context?.allowed === true,
    });

    assert.equal(registry.canExecute('test.disabled'), false);
    assert.deepEqual(await registry.execute('test.disabled'), {
        executed: false, value: undefined,
    });
    assert.equal(calls, 0);
    assert.equal(registry.canExecute('test.disabled', { allowed: true }), true);
});

test('command ids are unique and unknown commands produce a structured error', async () => {
    const registry = new CommandRegistry();
    registry.register({ id: 'test.once', execute: () => {} });

    assert.throws(
        () => registry.register({ id: 'test.once', execute: () => {} }),
        /already registered/);
    await assert.rejects(registry.execute('test.missing'), error => {
        assert.equal(error instanceof UnknownCommandError, true);
        assert.equal(error.commandId, 'test.missing');
        return true;
    });
});
