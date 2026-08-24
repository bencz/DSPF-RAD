import { getCurrentWindow } from '@tauri-apps/api/window';

export class DesktopWindowController {
    #abortController = null;
    #appWindow = null;

    constructor ({
        documentRef = globalThis.document,
        runtimeCheck = () => typeof globalThis.__TAURI_INTERNALS__ === 'object',
        windowFactory = getCurrentWindow,
        logger = globalThis.console,
    } = {}) {
        if (typeof runtimeCheck !== 'function') throw new TypeError('Runtime check must be a function.');
        if (typeof windowFactory !== 'function') throw new TypeError('Window factory must be a function.');
        this.document = documentRef;
        this.runtimeCheck = runtimeCheck;
        this.windowFactory = windowFactory;
        this.logger = logger;
    }

    get available () {
        return this.runtimeCheck();
    }

    start () {
        this.stop();
        if (!this.available) return false;

        const titlebar = this.document.getElementById('appTitlebar');
        const controls = this.document.getElementById('desktopWindowControls');
        const minimize = this.document.getElementById('windowMinimize');
        const maximize = this.document.getElementById('windowMaximize');
        const close = this.document.getElementById('windowClose');
        if (!titlebar || !controls || !minimize || !maximize || !close) {
            throw new Error('Desktop window chrome is incomplete.');
        }

        this.#appWindow = this.windowFactory();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;
        controls.hidden = false;
        this.document.documentElement.classList.add('tauri-desktop');

        minimize.addEventListener('click', () => this.#invoke('minimize'), { signal });
        maximize.addEventListener('click', () => this.#invoke('toggleMaximize'), { signal });
        close.addEventListener('click', () => this.#invoke('close'), { signal });
        titlebar.addEventListener('mousedown', event => this.#beginWindowGesture(event), { signal });
        return true;
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
        this.#appWindow = null;
        const controls = this.document?.getElementById?.('desktopWindowControls');
        if (controls) controls.hidden = true;
        this.document?.documentElement?.classList?.remove('tauri-desktop');
    }

    #beginWindowGesture (event) {
        if (event.button !== 0 || event.target?.closest?.('#desktopWindowControls')) return;
        if (event.detail === 2) this.#invoke('toggleMaximize');
        else this.#invoke('startDragging');
    }

    #invoke (operation) {
        const method = this.#appWindow?.[operation];
        if (typeof method !== 'function') {
            throw new Error(`Desktop window operation is unavailable: ${operation}`);
        }
        void Promise.resolve(method.call(this.#appWindow)).catch(error => {
            this.logger.error(`[ironterm] desktop window ${operation} failed:`, error);
        });
    }
}
