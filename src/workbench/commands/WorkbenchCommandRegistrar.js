import { WorkbenchCommand } from './commandIds.js';

// Transitional adapters let the new command system coexist with feature
// controllers that are still bound to toolbar buttons. Each feature can later
// register its command directly without changing menus or keyboard shortcuts.
const DOM_COMMANDS = Object.freeze([
    [WorkbenchCommand.FILE_NEW, 'newDoc', 'New DSPF', 'File'],
    [WorkbenchCommand.FILE_OPEN, 'openDoc', 'Open DSPF', 'File'],
    [WorkbenchCommand.FILE_SAVE, 'saveDoc', 'Save DSPF', 'File'],
    [WorkbenchCommand.PROJECT_OPEN, 'openProject', 'Open RAD project', 'Project'],
    [WorkbenchCommand.PROJECT_SAVE, 'saveProject', 'Save RAD project', 'Project'],
    [WorkbenchCommand.EDIT_UNDO, 'undoDoc', 'Undo', 'Edit'],
    [WorkbenchCommand.EDIT_REDO, 'redoDoc', 'Redo', 'Edit'],
    [WorkbenchCommand.EDIT_FIND, 'findDesign', 'Find in design', 'Edit'],
    [WorkbenchCommand.EDIT_COPY_ITEMS, 'copyItems', 'Copy items', 'Edit'],
    [WorkbenchCommand.EDIT_PASTE_ITEMS, 'pasteItems', 'Paste items', 'Edit'],
    [WorkbenchCommand.EDIT_DUPLICATE_ITEMS, 'duplicateItems', 'Duplicate items', 'Edit'],
    [WorkbenchCommand.RECORD_ADD, 'addRecord', 'Add record', 'Record'],
    [WorkbenchCommand.RECORD_ADD_SUBFILE, 'addSubfile', 'Add subfile pair', 'Record'],
    [WorkbenchCommand.RECORD_DUPLICATE, 'cloneRecord', 'Duplicate record', 'Record'],
    [WorkbenchCommand.RECORD_RENAME, 'renameRecord', 'Rename record', 'Record'],
    [WorkbenchCommand.RECORD_MOVE_UP, 'recordUp', 'Move record up', 'Record'],
    [WorkbenchCommand.RECORD_MOVE_DOWN, 'recordDown', 'Move record down', 'Record'],
    [WorkbenchCommand.RECORD_DELETE, 'deleteRecord', 'Delete record', 'Record'],
    [WorkbenchCommand.GENERATE_RPGLE, 'genRpgle', 'Generate RPGLE', 'Generate'],
    [WorkbenchCommand.GENERATE_COBOL, 'genCobol', 'Generate COBOL', 'Generate'],
    [WorkbenchCommand.REGENERATE_RPGLE, 'regenRpgle', 'Regenerate RPGLE', 'Generate'],
    [WorkbenchCommand.REGENERATE_COBOL, 'regenCobol', 'Regenerate COBOL', 'Generate'],
    [WorkbenchCommand.DEBUG_COPY_MODEL, 'exportJson', 'Copy model as JSON', 'Debug'],
]);

export class WorkbenchCommandRegistrar {
    #unregister = [];

    constructor ({
        registry, product, documentRef = globalThis.document, alertRef = globalThis.alert,
    }) {
        if (!registry) throw new TypeError('WorkbenchCommandRegistrar requires a registry.');
        if (!product) throw new TypeError('WorkbenchCommandRegistrar requires product metadata.');
        this.registry = registry;
        this.product = product;
        this.document = documentRef;
        this.alert = alertRef;
    }

    start () {
        this.stop();
        for (const [id, elementId, title, category] of DOM_COMMANDS) {
            const element = this.document.getElementById(elementId);
            if (!element) continue;
            this.#unregister.push(this.registry.register({
                id, title, category,
                execute: () => element.click(),
                isEnabled: () => !element.disabled,
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
