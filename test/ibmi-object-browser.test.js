import test from 'node:test';
import assert from 'node:assert/strict';

import { IbmiObjectBrowserService } from '../src/features/ibmi-objects/IbmiObjectBrowserService.js';
import { IbmiSourceMemberController } from '../src/features/ibmi-objects/IbmiSourceMemberController.js';
import { IbmiProjectLocation } from '../src/features/ibmi-objects/model/IbmiProjectLocation.js';
import { IbmiLibrarySelection } from '../src/features/ibmi-objects/model/IbmiLibrarySelection.js';
import { IbmiObjectBrowserPort } from '../src/platform/ibmi/IbmiObjectBrowserPort.js';

class TestObjectBrowserPort extends IbmiObjectBrowserPort {
    constructor () {
        super({ kind: 'test-qsys', available: true });
        this.requests = [];
    }

    async listLibraryObjects (request) {
        this.requests.push(request);
        return {
            library: request.library,
            objects: [{
                name: 'QRPGLESRC',
                objectType: 'FILE',
                isSourceFile: true,
                size: 16_384,
            }],
        };
    }

    async readSourceMember (request) {
        this.requests.push(request);
        return {
            library: request.library,
            sourceFile: request.sourceFile,
            member: request.member,
            text: '**free\nreturn;',
            revision: 'sha256:member',
        };
    }

    async listSourceMembers (request) {
        this.requests.push(request);
        return {
            library: request.library,
            sourceFile: request.sourceFile,
            members: [{ name: 'CHECKBOX', sourceType: 'DSPF' }],
        };
    }
}

test('IBM i object browsing keeps project identity and QSYS names explicit', async () => {
    const location = IbmiProjectLocation.fromProject({
        connectionProfileId: 'pub400',
        rootUri: 'ibmi://pub400/BENCZ1',
    });
    const port = new TestObjectBrowserPort();
    const service = new IbmiObjectBrowserService({
        port,
        connectionService: {
            isConnected: true,
            session: { id: 'session-1', profileId: 'pub400' },
        },
    });

    const objects = await service.listLibraryObjects(location);
    const members = await service.listSourceMembers({
        ...location,
        sourceFile: 'QDDSSRC',
    });
    const source = await service.readSourceMember({
        ...location,
        sourceFile: 'QRPGLESRC',
        member: 'PGMRADCHK',
        sourceCcsid: '37',
    });

    assert.equal(objects[0].name, 'QRPGLESRC');
    assert.equal(objects[0].isSourceFile, true);
    assert.equal(members[0].sourceType, 'DSPF');
    assert.equal(source.revision, 'sha256:member');
    assert.deepEqual(port.requests, [
        { sessionId: 'session-1', library: 'BENCZ1' },
        { sessionId: 'session-1', library: 'BENCZ1', sourceFile: 'QDDSSRC' },
        {
            sessionId: 'session-1',
            library: 'BENCZ1',
            sourceFile: 'QRPGLESRC',
            member: 'PGMRADCHK',
            sourceCcsid: '37',
        },
    ]);
    assert.throws(() => IbmiProjectLocation.fromProject({
        connectionProfileId: 'production',
        rootUri: 'ibmi://pub400/BENCZ1',
    }), /do not match/);
});

test('remote DSPF members open in the visual designer using their source type', async () => {
    const opened = [];
    const controller = new IbmiSourceMemberController({
        browser: {
            readSourceMember: async request => ({
                ...request,
                text: '     A                                      DSPSIZ(24 80 *DS3)',
                revision: 'sha256:dspf',
            }),
        },
        profiles: { get: () => ({ sourceCcsid: '*FILE' }) },
        documents: {
            documents: [],
            open: () => assert.fail('DSPF must not open in the generic source editor.'),
        },
        dspfFiles: {
            activateResource: () => false,
            openRemoteSource: async request => {
                opened.push(request);
                return true;
            },
        },
        languageServices: { languages: { resolve: () => ({ id: 'plaintext' }) } },
    });

    await controller.open({
        project: {
            id: 'project-1',
            connectionProfileId: 'pub400',
            rootUri: 'ibmi://pub400/BENCZ1',
        },
        sourceFile: 'QDDSSRC',
        member: 'CHECKBOX',
        sourceType: 'DSPF',
    });

    assert.equal(opened.length, 1);
    assert.equal(opened[0].title, 'CHECKBOX.DSPF');
});

test('remote member loading is observable and duplicate opens share one read', async () => {
    let finishRead;
    let readCount = 0;
    const opened = [];
    const controller = new IbmiSourceMemberController({
        browser: {
            readSourceMember: request => {
                readCount += 1;
                return new Promise(resolve => {
                    finishRead = () => resolve({
                        ...request,
                        text: '**free\nreturn;',
                        revision: 'sha256:rpgle',
                    });
                });
            },
        },
        profiles: { get: () => ({ sourceCcsid: '37' }) },
        documents: {
            documents: [],
            open: document => opened.push(document),
            activate: () => false,
        },
        dspfFiles: {
            activateResource: () => false,
            openRemoteSource: () => assert.fail('RPGLE must use the source editor.'),
        },
        languageServices: { languages: { resolve: () => ({ id: 'rpgle' }) } },
    });
    const request = {
        project: {
            id: 'project-1',
            connectionProfileId: 'pub400',
            rootUri: 'ibmi://pub400/BENCZ1',
        },
        sourceFile: 'QRPGLESRC',
        member: 'ORDERS',
        sourceType: 'RPGLE',
    };
    const loadingStates = [];
    controller.onDidChange(event => loadingStates.push(event.isLoading));

    const firstOpen = controller.open(request);
    const secondOpen = controller.open(request);
    assert.equal(controller.isLoading(request), true);
    assert.equal(readCount, 1);

    finishRead();
    await Promise.all([firstOpen, secondOpen]);

    assert.equal(controller.isLoading(request), false);
    assert.equal(opened.length, 1);
    assert.deepEqual(loadingStates, [true, false]);
});

test('IBM i library selection accepts multiple unique system names', () => {
    const selection = IbmiLibrarySelection.fromText('bencz1, common QGPL;COMMON');

    assert.deepEqual(selection.libraries, ['BENCZ1', 'COMMON', 'QGPL']);
    assert.throws(() => IbmiLibrarySelection.fromText('BENCZ1, ../QSYS'), /Invalid IBM i library/);
});
