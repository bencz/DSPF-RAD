const DEFAULT_TITLE = 'IronTerm Studio';

export class WorkbenchDialogService {
    #queue = Promise.resolve();

    constructor ({ view }) {
        if (!view) throw new TypeError('WorkbenchDialogService requires a dialog view.');
        this.view = view;
    }

    start () {
        this.view.start();
    }

    stop () {
        this.view.stop();
    }

    prompt ({
        title = DEFAULT_TITLE,
        message,
        label = 'Value',
        value = '',
        placeholder = '',
        maxLength = 255,
        acceptLabel = 'OK',
        cancelLabel = 'Cancel',
        validate = acceptValue,
    }) {
        if (typeof validate !== 'function') {
            throw new TypeError('Dialog prompt validation must be a function.');
        }
        return this.#enqueue({
            kind: 'prompt',
            icon: '›_',
            title,
            message: String(message ?? ''),
            detail: '',
            label,
            value: String(value ?? ''),
            placeholder,
            maxLength,
            acceptLabel,
            cancelLabel,
            danger: false,
            validate,
        });
    }

    confirm ({
        title = DEFAULT_TITLE,
        message,
        detail = '',
        acceptLabel = 'OK',
        cancelLabel = 'Cancel',
        danger = false,
    }) {
        return this.#enqueue({
            kind: 'confirm',
            icon: danger ? '!' : '?',
            title,
            message: String(message ?? ''),
            detail: String(detail ?? ''),
            label: '',
            value: '',
            placeholder: '',
            maxLength: 0,
            acceptLabel,
            cancelLabel,
            danger,
            validate: acceptValue,
        });
    }

    async alert ({
        title = DEFAULT_TITLE,
        message,
        detail = '',
        acceptLabel = 'OK',
    }) {
        await this.#enqueue({
            kind: 'alert',
            icon: 'i',
            title,
            message: String(message ?? ''),
            detail: String(detail ?? ''),
            label: '',
            value: '',
            placeholder: '',
            maxLength: 0,
            acceptLabel,
            cancelLabel: '',
            danger: false,
            validate: acceptValue,
        });
    }

    #enqueue (specification) {
        const operation = this.#queue.then(() => this.view.show(Object.freeze(specification)));
        this.#queue = operation.catch(() => undefined);
        return operation;
    }
}

function acceptValue () {
    return '';
}
