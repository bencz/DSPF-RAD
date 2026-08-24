import { WorkbenchCommand } from './commandIds.js';
import { WorkbenchDocumentKind } from '../documents/WorkbenchDocument.js';

// Transitional adapters let the new command system coexist with feature
// controllers that are still bound to toolbar buttons. Each feature can later
// register its command directly without changing menus or keyboard shortcuts.
const DOM_COMMANDS = Object.freeze([
    command(WorkbenchCommand.EDIT_UNDO, 'undoDoc', 'Undo', 'Edit'),
    command(WorkbenchCommand.EDIT_REDO, 'redoDoc', 'Redo', 'Edit'),
    command(WorkbenchCommand.EDIT_FIND, 'findDesign', 'Find in design', 'Edit'),
    command(WorkbenchCommand.EDIT_COPY_ITEMS, 'copyItems', 'Copy items', 'Edit'),
    command(WorkbenchCommand.EDIT_PASTE_ITEMS, 'pasteItems', 'Paste items', 'Edit'),
    command(WorkbenchCommand.EDIT_DUPLICATE_ITEMS, 'duplicateItems', 'Duplicate items', 'Edit'),
    command(WorkbenchCommand.RECORD_ADD, 'addRecord', 'Add record', 'Record'),
    command(WorkbenchCommand.RECORD_ADD_SUBFILE, 'addSubfile', 'Add subfile pair', 'Record'),
    command(WorkbenchCommand.RECORD_DUPLICATE, 'cloneRecord', 'Duplicate record', 'Record'),
    command(WorkbenchCommand.RECORD_RENAME, 'renameRecord', 'Rename record', 'Record'),
    command(WorkbenchCommand.RECORD_MOVE_UP, 'recordUp', 'Move record up', 'Record'),
    command(WorkbenchCommand.RECORD_MOVE_DOWN, 'recordDown', 'Move record down', 'Record'),
    command(WorkbenchCommand.RECORD_DELETE, 'deleteRecord', 'Delete record', 'Record'),
]);

export class WorkbenchCommandRegistrar {
    #unregister = [];

    constructor ({
        registry,
        product,
        documents,
        documentRef = globalThis.document,
        alertRef = globalThis.alert,
    }) {
        if (!registry) throw new TypeError('WorkbenchCommandRegistrar requires a registry.');
        if (!product) throw new TypeError('WorkbenchCommandRegistrar requires product metadata.');
        if (!documents) throw new TypeError('WorkbenchCommandRegistrar requires documents.');
        this.registry = registry;
        this.product = product;
        this.documents = documents;
        this.document = documentRef;
        this.alert = alertRef;
    }

    start () {
        this.stop();
        for (const { id, elementId, title, category, documentKind } of DOM_COMMANDS) {
            const element = this.document.getElementById(elementId);
            if (!element) continue;
            this.#unregister.push(this.registry.register({
                id, title, category,
                execute: () => element.click(),
                isEnabled: () => !element.disabled &&
                    this.documents.activeDocument?.kind === documentKind,
            }));
        }

        this.#unregister.push(this.registry.register({
            id: WorkbenchCommand.HELP_ABOUT,
            title: `About ${this.product.name}`,
            category: 'Help',
            execute: () => this.#showAbout(),
        }));
    }

    stop () {
        for (const unregister of this.#unregister.splice(0)) unregister();
    }

    #showAbout () {
        this.alert(
            `${this.product.name} ${this.product.version}\n` +
            `${this.product.description}\n\n` +
            'Offline-first integrated development environment for IBM i.\n\n' +
            'Author: Alexandre Bencz\n' +
            'UI direction: Visual Studio 6 / Win98 workbench');
    }
}

function command (id, elementId, title, category) {
    return Object.freeze({
        id,
        elementId,
        title,
        category,
        documentKind: WorkbenchDocumentKind.DSPF_DESIGNER,
    });
}
