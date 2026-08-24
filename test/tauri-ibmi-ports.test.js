import test from 'node:test';
import assert from 'node:assert/strict';

import { IbmiWorkspaceRevisionConflictError } from '../src/platform/ibmi/IbmiWorkspaceStoragePort.js';
import { TauriIbmiConnectionPort } from '../src/platform/tauri/ibmi/TauriIbmiConnectionPort.js';
import { TauriIbmiObjectBrowserPort } from '../src/platform/tauri/ibmi/TauriIbmiObjectBrowserPort.js';
import { TauriIbmiWorkspaceStoragePort } from '../src/platform/tauri/ibmi/TauriIbmiWorkspaceStoragePort.js';

test('Tauri IBM i ports preserve the focused connection and workspace contracts', async () => {
    const calls = [];
    const invokeCommand = async (command, payload) => {
        calls.push({ command, payload });
        if (command === 'ibmi_connect') return { id: 'session-1' };
        if (command === 'ibmi_workspace_read') {
            return { text: '{}', revision: 'sha256:read' };
        }
        if (command === 'ibmi_library_objects') {
            return { library: 'BENCZ1', objects: [] };
        }
        if (command === 'ibmi_source_member_read') {
            return { text: '', revision: 'sha256:member' };
        }
        return null;
    };
    const connections = new TauriIbmiConnectionPort({ invokeCommand });
    const workspaces = new TauriIbmiWorkspaceStoragePort({ invokeCommand });
    const objects = new TauriIbmiObjectBrowserPort({ invokeCommand });
    const profile = { id: 'development', host: 'ibmi.example.test' };

    const connected = await connections.connect({ profile });
    const read = await workspaces.readWorkspace({
        sessionId: connected.id,
        path: '/home/DEV/orders.itworkspace',
    });
    await objects.listLibraryObjects({ sessionId: connected.id, library: 'BENCZ1' });
    await objects.readSourceMember({
        sessionId: connected.id,
        library: 'BENCZ1',
        sourceFile: 'QRPGLESRC',
        member: 'PGMRADCHK',
        sourceCcsid: '37',
    });
    await connections.disconnect({ sessionId: connected.id });

    assert.equal(read.revision, 'sha256:read');
    assert.deepEqual(calls, [
        {
            command: 'ibmi_connect',
            payload: { request: { profile, secret: null } },
        },
        {
            command: 'ibmi_workspace_read',
            payload: {
                request: {
                    sessionId: 'session-1',
                    path: '/home/DEV/orders.itworkspace',
                },
            },
        },
        {
            command: 'ibmi_library_objects',
            payload: {
                request: {
                    sessionId: 'session-1',
                    library: 'BENCZ1',
                },
            },
        },
        {
            command: 'ibmi_source_member_read',
            payload: {
                request: {
                    sessionId: 'session-1',
                    library: 'BENCZ1',
                    sourceFile: 'QRPGLESRC',
                    member: 'PGMRADCHK',
                    sourceCcsid: '37',
                },
            },
        },
        { command: 'ibmi_disconnect', payload: { sessionId: 'session-1' } },
    ]);
});

test('Tauri workspace port exposes remote revision conflicts as a domain error', async () => {
    const port = new TauriIbmiWorkspaceStoragePort({
        invokeCommand: async () => {
            throw {
                code: 'IBMI_WORKSPACE_REVISION_CONFLICT',
                message: 'changed remotely',
                path: '/home/DEV/orders.itworkspace',
                expectedRevision: 'sha256:old',
                actualRevision: 'sha256:new',
            };
        },
    });

    await assert.rejects(port.writeWorkspace({
        sessionId: 'session-1',
        path: '/home/DEV/orders.itworkspace',
        text: '{}',
        expectedRevision: 'sha256:old',
    }), error => error instanceof IbmiWorkspaceRevisionConflictError &&
        error.actualRevision === 'sha256:new');
});
