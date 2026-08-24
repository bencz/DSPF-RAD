import { WorkbenchCommand } from '../commands/commandIds.js';

export class WorkbenchNavigationController {
    #unregister = [];

    constructor ({ documents, commands }) {
        if (!documents) throw new TypeError('WorkbenchNavigationController requires documents.');
        if (!commands) throw new TypeError('WorkbenchNavigationController requires commands.');
        this.documents = documents;
        this.commands = commands;
    }

    start () {
        this.stop();
        this.#unregister.push(
            this.commands.register({
                id: WorkbenchCommand.VIEW_START_PAGE,
                title: 'Start Page',
                category: 'View',
                execute: () => this.documents.showStartPage(),
                isEnabled: () => !this.documents.isStartPageActive,
            }),
            this.commands.register({
                id: WorkbenchCommand.VIEW_ACTIVE_EDITOR,
                title: 'Active editor',
                category: 'View',
                execute: () => this.documents.activate(this.documents.lastActiveDocument.id),
                isEnabled: () => this.documents.isStartPageActive &&
                    this.documents.lastActiveDocument !== null,
            }),
        );
    }

    stop () {
        for (const unregister of this.#unregister.splice(0)) unregister();
    }
}
