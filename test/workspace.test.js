import test from 'node:test';
import assert from 'node:assert/strict';

import {
    Workspace, WorkspaceProjectKind, WORKSPACE_FORMAT, WORKSPACE_VERSION,
} from '../src/workbench/workspace/Workspace.js';
import { WorkspaceProject } from '../src/workbench/workspace/WorkspaceProject.js';
import { WorkspaceSession } from '../src/workbench/workspace/WorkspaceSession.js';

test('workspace manages projects and preserves the active project', () => {
    const workspace = new Workspace({
        id: 'workspace-1',
        name: 'Order Entry',
        projects: [{ id: 'local-1', name: 'Local sources', kind: 'local' }],
    });
    const events = [];
    workspace.onDidChange(event => events.push(event.type));

    workspace.addProject({
        id: 'ibmi-1',
        name: 'DEVLIB',
        kind: WorkspaceProjectKind.IBMI,
        rootUri: 'ibmi://dev/DEVLIB',
        connectionProfileId: 'development',
    });
    workspace.activateProject('ibmi-1');
    workspace.renameProject('ibmi-1', 'Development library');
    workspace.removeProject('local-1');

    assert.equal(workspace.activeProject.name, 'Development library');
    assert.equal(workspace.activeProject instanceof WorkspaceProject, true);
    assert.deepEqual(events, [
        'project.added', 'project.activated', 'project.renamed', 'project.removed',
    ]);
});

test('workspace project is immutable and controls IBM i profile references', () => {
    const project = new WorkspaceProject({
        id: 'remote',
        name: 'Development',
        kind: WorkspaceProjectKind.IBMI,
        rootUri: 'ibmi://development/DEVLIB',
    });
    const connected = project.withConnectionProfile('development');

    assert.equal(Object.isFrozen(project), true);
    assert.equal(project.connectionProfileId, null);
    assert.equal(connected.connectionProfileId, 'development');
    assert.deepEqual(WorkspaceProject.fromJSON(connected.toJSON()).toJSON(), connected.toJSON());
});

test('workspace manifest round-trips through its versioned format', () => {
    const source = new Workspace({
        id: 'workspace-1',
        name: 'Accounting',
        projects: [{ id: 'project-1', name: 'Sources', kind: 'local', rootUri: 'file:///src' }],
        activeProjectId: 'project-1',
    });

    const json = source.toJSON();
    assert.equal(json.format, WORKSPACE_FORMAT);
    assert.equal(json.version, WORKSPACE_VERSION);
    assert.deepEqual(Workspace.fromJSON(json).toJSON(), json);
});

test('workspace manifests reject credentials and invalid profile placement', () => {
    assert.throws(() => new Workspace({
        id: 'unsafe-direct', name: 'Unsafe', password: 'do-not-store-this',
    }), /Credentials are not allowed/);
    assert.throws(() => Workspace.fromJSON({
        format: WORKSPACE_FORMAT,
        version: WORKSPACE_VERSION,
        id: 'unsafe',
        name: 'Unsafe',
        password: 'do-not-store-this',
        projects: [],
    }), /Credentials are not allowed/);

    assert.throws(() => new Workspace({
        projects: [{
            id: 'local-1', name: 'Local', kind: 'local', connectionProfileId: 'dev',
        }],
    }), /Only IBM i projects/);
});

test('workspace session tracks modifications, filenames, and replacement', () => {
    const first = new Workspace({ id: 'first', name: 'Order Entry' });
    const session = new WorkspaceSession({ workspace: first });
    const events = [];
    session.onDidChange(event => events.push(event.type));

    first.rename('Order Maintenance');
    assert.equal(session.isDirty, true);
    assert.equal(session.suggestedFileName, 'order-maintenance.itworkspace');

    session.markClean('orders.itworkspace');
    assert.equal(session.isDirty, false);
    assert.equal(session.suggestedFileName, 'orders.itworkspace');

    const second = new Workspace({ id: 'second', name: 'Accounting' });
    session.replace(second, { markClean: false });
    first.rename('Detached workspace');
    assert.equal(session.workspace, second);
    assert.equal(session.isDirty, true);
    assert.deepEqual(events, [
        'workspace.renamed', 'workspace.saved', 'workspace.replaced',
    ]);
});
