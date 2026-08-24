import dialogMarkup from './workbench-dialog.html?raw';
import { HtmlTemplateView } from '../../views/HtmlTemplateView.js';

export class WorkbenchDialogView extends HtmlTemplateView {
    #pending = null;
    #abortController = null;

    constructor ({
        documentRef = globalThis.document,
        windowRef = globalThis.window,
    } = {}) {
        super({ documentRef, markup: dialogMarkup });
        this.window = windowRef;
        this.elements = null;
    }

    start (host = this.document.body) {
        if (this.elements) return;
        host.append(this.createFragment());
        this.elements = this.#collectElements();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;
        this.elements.form.addEventListener('submit', event => this.#accept(event), { signal });
        this.elements.cancel.addEventListener('click', () => this.#cancel(), { signal });
        this.elements.close.addEventListener('click', () => this.#cancel(), { signal });
        this.elements.dialog.addEventListener('cancel', event => {
            event.preventDefault();
            this.#cancel();
        }, { signal });
        this.elements.dialog.addEventListener('click', event => {
            if (event.target === this.elements.dialog) this.#cancel();
        }, { signal });
    }

    stop () {
        if (this.#pending) this.#cancel();
        this.#abortController?.abort();
        this.#abortController = null;
        this.elements?.dialog.remove();
        this.elements = null;
    }

    show (specification) {
        if (!this.elements) this.start();
        if (this.#pending) throw new Error('WorkbenchDialogView already has an active dialog.');
        this.#render(specification);

        return new Promise(resolve => {
            this.#pending = { resolve, specification };
            if (typeof this.elements.dialog.showModal === 'function') {
                this.elements.dialog.showModal();
            } else {
                this.elements.dialog.setAttribute('open', '');
            }
            this.window.requestAnimationFrame(() => this.#focusInitialControl());
        });
    }

    #collectElements () {
        const dialog = this.document.querySelector('.workbench-dialog');
        if (!dialog) throw new Error('Workbench dialog template was not rendered.');
        const required = role => {
            const element = dialog.querySelector(`[data-role="${role}"]`);
            if (!element) throw new Error(`Missing workbench dialog role: ${role}`);
            return element;
        };
        return {
            dialog,
            form: dialog.querySelector('form'),
            title: this.document.getElementById('workbenchDialogTitle'),
            icon: required('icon'),
            message: required('message'),
            detail: required('detail'),
            field: required('field'),
            label: required('label'),
            input: required('input'),
            error: required('error'),
            cancel: required('cancel'),
            accept: required('accept'),
            close: required('close'),
        };
    }

    #render (specification) {
        const { elements } = this;
        elements.dialog.dataset.kind = specification.kind;
        elements.title.textContent = specification.title;
        elements.icon.textContent = specification.icon;
        elements.message.textContent = specification.message;
        elements.detail.textContent = specification.detail;
        elements.detail.hidden = !specification.detail;
        elements.field.hidden = specification.kind !== 'prompt';
        elements.label.textContent = specification.label;
        elements.input.value = specification.value;
        elements.input.placeholder = specification.placeholder;
        elements.input.maxLength = specification.maxLength;
        elements.cancel.textContent = specification.cancelLabel;
        elements.cancel.hidden = specification.kind === 'alert';
        elements.accept.textContent = specification.acceptLabel;
        elements.accept.classList.toggle('danger', specification.danger);
        this.#showError('');
    }

    #focusInitialControl () {
        const { specification } = this.#pending ?? {};
        if (!specification) return;
        if (specification.kind === 'prompt') {
            this.elements.input.focus();
            this.elements.input.select();
            return;
        }
        this.elements.accept.focus();
    }

    #accept (event) {
        event.preventDefault();
        const pending = this.#pending;
        if (!pending) return;
        if (pending.specification.kind === 'prompt') {
            const value = this.elements.input.value;
            const error = pending.specification.validate(value);
            if (error) {
                this.#showError(error);
                this.elements.input.focus();
                return;
            }
            this.#finish(value);
            return;
        }
        this.#finish(pending.specification.kind === 'confirm' ? true : undefined);
    }

    #cancel () {
        const kind = this.#pending?.specification.kind;
        this.#finish(kind === 'confirm' ? false : null);
    }

    #finish (result) {
        const pending = this.#pending;
        if (!pending) return;
        this.#pending = null;
        if (typeof this.elements.dialog.close === 'function') this.elements.dialog.close();
        else this.elements.dialog.removeAttribute('open');
        pending.resolve(result);
    }

    #showError (message) {
        this.elements.error.textContent = message;
        this.elements.error.hidden = !message;
    }
}
