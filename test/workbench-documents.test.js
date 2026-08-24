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
    assert.equal(documents.activeDocument, null);
    assert.equal(documents.lastActiveDocument.id, 'first');
    documents.close('first');
    assert.equal(documents.lastActiveDocument, null);
});

test('closing the active editor activates another open workbench document', () => {
    const documents = new WorkbenchDocumentService();
    documents.open(documentDescriptor('designer', 'DISPLAY'));
    documents.open(documentDescriptor('source', 'PROGRAM'));

    documents.close('source');

    assert.equal(documents.activeDocument.id, 'designer');
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

test('DSPF coordinator keeps multiple resources open and restores each design session', () => {
    const model = new DspfDocument();
    const documents = new WorkbenchDocumentService();
    const coordinator = new DspfDocumentCoordinator({
        documentModel: model,
        workbenchDocuments: documents,
    });
    coordinator.start();

    const first = new DspfDocument();
    first.sourceName = 'FIRST';
    first.resetHistory({ markClean: true });
    coordinator.open({
        documentModel: first,
        title: 'FIRST.DSPF',
        resourceUri: 'ibmi://dev/LIB/QDDSSRC/FIRST',
        readOnly: true,
    });
    model.renameRecord(0, 'FIRSTREC');

    const second = new DspfDocument();
    second.sourceName = 'SECOND';
    second.renameRecord(0, 'SECONDREC');
    second.resetHistory({ markClean: true });
    coordinator.open({
        documentModel: second,
        title: 'SECOND.DSPF',
        resourceUri: 'ibmi://dev/LIB/QDDSSRC/SECOND',
        readOnly: true,
    });

    assert.equal(documents.documents.length, 2);
    assert.equal(model.sourceName, 'SECOND');
    assert.equal(model.activeRecord.name, 'SECONDREC');
    assert.equal(coordinator.activateResource('ibmi://dev/LIB/QDDSSRC/FIRST'), true);
    assert.equal(model.sourceName, 'FIRST');
    assert.equal(model.activeRecord.name, 'FIRSTREC');
    assert.equal(model.canUndo, true);
    assert.equal(coordinator.activateResource('ibmi://dev/LIB/QDDSSRC/FIRST'), true);
    assert.equal(documents.documents.length, 2);

    coordinator.stop();
});
