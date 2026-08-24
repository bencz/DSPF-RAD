import test from 'node:test';
import assert from 'node:assert/strict';

import { SourceDocument } from '../src/features/source-code/model/SourceDocument.js';

test('source document tracks text versions, dirty state, and save boundaries', () => {
    const document = new SourceDocument({
        id: 'local:build.clle',
        name: 'BUILD.CLLE',
        languageId: 'cl',
        sourceType: 'clle',
        text: 'PGM\nENDPGM',
        resourceUri: 'file:///build.clle',
        projectId: 'project-build',
    });
    const events = [];
    document.onDidChange(event => events.push(event.type));

    assert.equal(document.isDirty, false);
    assert.equal(document.describe().projectId, 'project-build');
    assert.equal(document.replaceText('PGM\nRETURN\nENDPGM'), true);
    assert.equal(document.version, 2);
    assert.equal(document.isDirty, true);
    assert.equal(document.markClean(), true);
    assert.equal(document.isDirty, false);
    assert.deepEqual(events, ['document.changed', 'document.saved']);
});

test('source document supports intentionally dirty new documents', () => {
    const document = new SourceDocument({
        id: 'untitled:1',
        name: 'UNTITLED.CLLE',
        languageId: 'cl',
        markClean: false,
    });

    assert.equal(document.isDirty, true);
    assert.equal(Object.isFrozen(document.describe()), true);
});
