import test from 'node:test';
import assert from 'node:assert/strict';

import { CommandRegistry } from '../src/workbench/commands/CommandRegistry.js';
import { WorkbenchCommand } from '../src/workbench/commands/commandIds.js';
import { Workspace } from '../src/workbench/workspace/Workspace.js';
import { WorkspaceController } from '../src/workbench/workspace/WorkspaceController.js';
import { WorkspaceSession } from '../src/workbench/workspace/WorkspaceSession.js';

test('workspace controller opens and saves manifests through the host bridge', async () => {
    const opened = new Workspace({ id: 'remote', name: 'Remote Sources' });
    let saved = null;
    const host = {
        supports: () => true,
        openTextFile: async () => ({
            name: 'remote.itworkspace',
            text: JSON.stringify(opened.toJSON()),
        }),
        saveTextFile: async request => { saved = request; },
    };
    const session = new WorkspaceSession({
        workspace: new Workspace({ id: 'initial', name: 'Initial' }),
    });
    const commands = new CommandRegistry();
    const controller = new WorkspaceController({
        session, commands, host, flash: () => {},
        promptRef: () => 'Unused', confirmRef: () => true,
    });
    controller.start();

    await commands.execute(WorkbenchCommand.WORKSPACE_OPEN);
    assert.equal(session.workspace.name, 'Remote Sources');
    assert.equal(session.fileName, 'remote.itworkspace');
    assert.equal(session.isDirty, false);

    session.workspace.rename('Remote Development');
    await commands.execute(WorkbenchCommand.WORKSPACE_SAVE);
    assert.equal(saved.suggestedName, 'remote.itworkspace');
    assert.equal(JSON.parse(saved.text).name, 'Remote Development');
    assert.equal(session.isDirty, false);
});

test('workspace controller keeps dirty work when discard is rejected', async () => {
    const workspace = new Workspace({ id: 'current', name: 'Current' });
    const session = new WorkspaceSession({ workspace });
    workspace.rename('Modified');
    let hostCalls = 0;
    const commands = new CommandRegistry();
    const controller = new WorkspaceController({
        session,
        commands,
        host: {
            supports: () => true,
            openTextFile: async () => { hostCalls += 1; return null; },
        },
        flash: () => {},
        promptRef: () => 'Replacement',
        confirmRef: () => false,
    });
    controller.start();

    await commands.execute(WorkbenchCommand.WORKSPACE_NEW);
    await commands.execute(WorkbenchCommand.WORKSPACE_OPEN);
    assert.equal(session.workspace, workspace);
    assert.equal(hostCalls, 0);
});
