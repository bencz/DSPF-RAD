export class UnknownCommandError extends Error {
    constructor (commandId) {
        super(`Unknown workbench command: ${commandId}`);
        this.name = 'UnknownCommandError';
        this.commandId = commandId;
    }
}

export class CommandRegistry {
    #commands = new Map();

    register ({ id, title = id, category = 'General', execute, isEnabled = alwaysEnabled }) {
        if (!id || typeof id !== 'string') {
            throw new TypeError('A command requires a non-empty string id.');
        }
        if (typeof execute !== 'function') {
            throw new TypeError(`Command ${id} requires an execute function.`);
        }
        if (typeof isEnabled !== 'function') {
            throw new TypeError(`Command ${id} requires an isEnabled function.`);
        }
        if (this.#commands.has(id)) {
            throw new Error(`Command is already registered: ${id}`);
        }

        this.#commands.set(id, Object.freeze({ id, title, category, execute, isEnabled }));
        return () => this.unregister(id);
    }

    unregister (id) {
        return this.#commands.delete(id);
    }

    has (id) {
        return this.#commands.has(id);
    }

    canExecute (id, context) {
        const command = this.#commands.get(id);
        return command ? Boolean(command.isEnabled(context)) : false;
    }

    async execute (id, context) {
        const command = this.#commands.get(id);
        if (!command) throw new UnknownCommandError(id);
        if (!command.isEnabled(context)) {
            return Object.freeze({ executed: false, value: undefined });
        }
        const value = await command.execute(context);
        return Object.freeze({ executed: true, value });
    }

    list (context) {
        return Object.freeze([...this.#commands.values()].map(command => Object.freeze({
            id: command.id,
            title: command.title,
            category: command.category,
            enabled: Boolean(command.isEnabled(context)),
        })));
    }
}

function alwaysEnabled () {
    return true;
}
