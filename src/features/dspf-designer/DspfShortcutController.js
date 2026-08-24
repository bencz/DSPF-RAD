import { WorkbenchCommand } from '../../workbench/commands/commandIds.js';

export class DspfShortcutController {
    #abortController = null;

    constructor ({ commands, designer, palette, documentRef = globalThis.document, logger = globalThis.console }) {
        this.commands = commands;
        this.designer = designer;
        this.palette = palette;
        this.document = documentRef;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#abortController = new AbortController();
        this.document.addEventListener('keydown', event => this.#handleKey(event), {
            signal: this.#abortController.signal,
        });
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
    }

    #handleKey (event) {
        if (event.key === 'Escape' && this.palette.getArmedSpec()) {
            this.palette.clearArmed();
            this.document.getElementById('grid').classList.remove('canvas-armed');
        }
        if (!event.ctrlKey && !event.metaKey) return;

        const key = event.key.toLowerCase();
        const directCommand = {
            s: WorkbenchCommand.FILE_SAVE,
            o: WorkbenchCommand.FILE_OPEN,
            n: WorkbenchCommand.FILE_NEW,
        }[key];
        if (directCommand) {
            event.preventDefault();
            this.#run(directCommand);
            return;
        }
        if (this.#isTextEditingTarget(event.target)) return;

        if (key === 'f') this.#execute(event, WorkbenchCommand.EDIT_FIND);
        else if (key === 'z') this.#execute(event, event.shiftKey
            ? WorkbenchCommand.EDIT_REDO : WorkbenchCommand.EDIT_UNDO);
        else if (key === 'y') this.#execute(event, WorkbenchCommand.EDIT_REDO);
        else if (key === 'c' && this.designer.selectedIds.size) {
            this.#execute(event, WorkbenchCommand.EDIT_COPY_ITEMS);
        } else if (key === 'v') this.#execute(event, WorkbenchCommand.EDIT_PASTE_ITEMS);
        else if (key === 'd' && this.designer.selectedIds.size) {
            this.#execute(event, WorkbenchCommand.EDIT_DUPLICATE_ITEMS);
        } else if (key === 'a' && this.document.activeElement === this.designer.canvas) {
            event.preventDefault();
            this.designer.selectAll();
        }
    }

    #execute (event, commandId) {
        event.preventDefault();
        this.#run(commandId);
    }

    #run (commandId) {
        void this.commands.execute(commandId).catch(error => {
            this.logger.error(`[ironterm] command ${commandId} failed:`, error);
        });
    }

    #isTextEditingTarget (target) {
        return !!target?.closest?.(
            'input, textarea, select, [contenteditable="true"], .cm-editor');
    }
}
