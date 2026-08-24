import test from 'node:test';
import assert from 'node:assert/strict';

import {
    WorkbenchDialogService,
} from '../src/workbench/ui/dialogs/WorkbenchDialogService.js';

test('workbench dialog service normalizes reusable prompt, confirm, and alert requests', async () => {
    const requests = [];
    const view = {
        startCalls: 0,
        stopCalls: 0,
        start () {
            this.startCalls += 1;
        },
        stop () {
            this.stopCalls += 1;
        },
        async show (request) {
            requests.push(request);
            if (request.kind === 'prompt') return request.value;
            if (request.kind === 'confirm') return true;
            return undefined;
        },
    };
    const dialogs = new WorkbenchDialogService({ view });
    dialogs.start();

    const name = await dialogs.prompt({
        title: 'New workspace',
        message: 'Create a workspace.',
        label: 'Workspace name',
        value: 'Development',
    });
    const confirmed = await dialogs.confirm({
        message: 'Discard changes?',
        danger: true,
    });
    await dialogs.alert({ message: 'Complete.' });
    dialogs.stop();

    assert.equal(view.startCalls, 1);
    assert.equal(view.stopCalls, 1);
    assert.equal(name, 'Development');
    assert.equal(confirmed, true);
    assert.deepEqual(requests.map(request => request.kind), ['prompt', 'confirm', 'alert']);
    assert.equal(requests[0].label, 'Workspace name');
    assert.equal(requests[1].danger, true);
});

test('workbench dialog service rejects invalid prompt validators', () => {
    const dialogs = new WorkbenchDialogService({
        view: { start () {}, stop () {}, show: async () => null },
    });
    assert.throws(() => dialogs.prompt({
        message: 'Invalid validator',
        validate: 'not callable',
    }), /validation must be a function/);
});

test('workbench dialog service serializes overlapping requests', async () => {
    const started = [];
    const completions = [];
    const view = {
        start () {},
        show (request) {
            started.push(request.message);
            return new Promise(resolve => completions.push(resolve));
        },
    };
    const dialogs = new WorkbenchDialogService({ view });

    const first = dialogs.confirm({ message: 'First' });
    const second = dialogs.confirm({ message: 'Second' });
    await Promise.resolve();
    assert.deepEqual(started, ['First']);

    completions.shift()(true);
    assert.equal(await first, true);
    await Promise.resolve();
    assert.deepEqual(started, ['First', 'Second']);

    completions.shift()(false);
    assert.equal(await second, false);
});
