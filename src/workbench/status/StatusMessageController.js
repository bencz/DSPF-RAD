export class StatusMessageController {
    constructor ({ element, windowRef = globalThis.window }) {
        if (!element) throw new TypeError('StatusMessageController requires an element.');
        this.element = element;
        this.window = windowRef;
        this.timer = null;
        this.show = this.show.bind(this);
    }

    show (text, className = '', duration = 2500) {
        if (this.timer) this.window.clearTimeout(this.timer);
        this.element.textContent = text;
        this.element.className = className;
        this.timer = className ? this.window.setTimeout(() => this.clear(), duration) : null;
    }

    clear () {
        if (this.timer) this.window.clearTimeout(this.timer);
        this.timer = null;
        this.element.textContent = 'ready';
        this.element.className = '';
    }
}
