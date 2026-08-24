import test from 'node:test';
import assert from 'node:assert/strict';

import { DspfDocumentCoordinator } from '../src/features/dspf-designer/DspfDocumentCoordinator.js';
import { DspfDocument } from '../src/model/DspfDocument.js';
import {
    WorkbenchDocument,
    WorkbenchDocumentKind,
} from '../src/workbench/documents/WorkbenchDocument.js';
import { WorkbenchDocumentService } from '../src/workbench/documents/WorkbenchDocumentService.js';

function documentDescriptor (id, title) {
    return {
        id,
        title,
        kind: WorkbenchDocumentKind.DSPF_DESIGNER,
        resourceUri: `dspf:${title}`,
    };
}

test('workbench documents preserve immutable descriptors and active-editor history', () => {
    const documents = new WorkbenchDocumentService();
    const events = [];
    documents.onDidChange(event => events.push(event.type));

    const first = documents.open(documentDescriptor('first', 'FIRST'));
    documents.open(documentDescriptor('second', 'SECOND'));
    documents.activate('first');
    documents.showStartPage();

    assert.equal(first instanceof WorkbenchDocument, true);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(documents.activeDocument, null);
    assert.equal(documents.lastActiveDocument.id, 'first');

    const updated = documents.update('first', { title: 'RENAMED', isDirty: true });
    assert.notEqual(updated, first);
    assert.equal(updated.title, 'RENAMED');
    assert.equal(updated.isDirty, true);
    assert.deepEqual(events, [
        'document.opened',
        'document.opened',
        'document.activated',
        'startPage.activated',
        'document.updated',
    ]);
});

test('closing the last active document selects a valid return target', () => {
    const documents = new WorkbenchDocumentService();
    documents.open(documentDescriptor('first', 'FIRST'));
    documents.open(documentDescriptor('second', 'SECOND'));
    documents.showStartPage();

    documents.close('second');
    assert.equal(documents.lastActiveDocument.id, 'first');
    documents.close('first');
    assert.equal(documents.lastActiveDocument, null);
});

test('DSPF coordinator exposes designer state as a workbench document', () => {
    const model = new DspfDocument();
    const documents = new WorkbenchDocumentService();
    const coordinator = new DspfDocumentCoordinator({
        documentModel: model,
        workbenchDocuments: documents,
    });
    coordinator.start();

    coordinator.open();
    assert.equal(documents.activeDocument.title, 'DSPFILE.DSPF');
    assert.equal(documents.activeDocument.isDirty, false);

    model.sourceName = 'ORDENTRY';
    model.renameRecord(0, 'SCREEN1');
    assert.equal(documents.activeDocument.title, 'ORDENTRY.DSPF');
    assert.equal(documents.activeDocument.resourceUri, 'dspf:ORDENTRY');
    assert.equal(documents.activeDocument.isDirty, true);

    coordinator.stop();
});
