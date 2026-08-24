import test from 'node:test';
import assert from 'node:assert/strict';

import { SourceCodeDocumentService } from '../src/features/source-code/SourceCodeDocumentService.js';
import { SourceDocument } from '../src/features/source-code/model/SourceDocument.js';
import { WorkbenchDocumentKind } from '../src/workbench/documents/WorkbenchDocument.js';
import { WorkbenchDocumentService } from '../src/workbench/documents/WorkbenchDocumentService.js';

test('source documents publish their lifecycle and dirty state to the workbench', () => {
    const workbenchDocuments = new WorkbenchDocumentService();
    const documents = new SourceCodeDocumentService({ workbenchDocuments });
    const first = new SourceDocument({
        id: 'build',
        name: 'BUILD.CLLE',
        languageId: 'cl',
        sourceType: 'CLLE',
        text: 'PGM\nENDPGM',
    });
    const second = new SourceDocument({
        id: 'install',
        name: 'INSTALL.CLLE',
        languageId: 'cl',
    });

    documents.open(first);
    documents.open(second);
    first.replaceText('PGM\nRETURN\nENDPGM');

    const descriptor = workbenchDocuments.documents.find(
        document => document.id === 'source-code:build');
    assert.equal(descriptor.kind, WorkbenchDocumentKind.SOURCE_CODE);
    assert.equal(descriptor.isDirty, true);

    documents.activate(first.id);
    assert.equal(documents.activeDocument, first);
    documents.close(first.id);
    assert.equal(documents.activeDocument, second);
});
