const EXPLORER_WIDTH_STORAGE_KEY = 'ironterm.workbench.explorerWidth';
const DEFAULT_EXPLORER_WIDTH = 238;
const MIN_EXPLORER_WIDTH = 190;
const MAX_EXPLORER_WIDTH = 520;
const MIN_EDITOR_WIDTH = 320;
const KEYBOARD_STEP = 12;

export class WorkbenchAreaController {
    #abortController = null;
    #drag = null;
    #width = DEFAULT_EXPLORER_WIDTH;

    constructor ({
        area,
        explorer,
        splitter,
        storage = globalThis.localStorage,
        windowRef = globalThis.window,
    }) {
        if (!area) throw new TypeError('WorkbenchAreaController requires the workbench area.');
        if (!explorer) throw new TypeError('WorkbenchAreaController requires the Explorer region.');
        if (!splitter) throw new TypeError('WorkbenchAreaController requires a splitter.');
        this.area = area;
        this.splitter = splitter;
        this.storage = storage;
        this.window = windowRef;
    }

    start () {
        this.stop();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;
        this.splitter.addEventListener('pointerdown', event => this.#startDrag(event), { signal });
        this.splitter.addEventListener('pointermove', event => this.#moveDrag(event), { signal });
        this.splitter.addEventListener('pointerup', event => this.#finishDrag(event), { signal });
        this.splitter.addEventListener('pointercancel', event => this.#finishDrag(event), { signal });
        this.splitter.addEventListener('keydown', event => this.#resizeFromKeyboard(event), { signal });
        this.splitter.addEventListener('dblclick', () => {
            this.#applyWidth(DEFAULT_EXPLORER_WIDTH, { persist: true });
        }, { signal });
        this.window.addEventListener('resize', () => this.#applyWidth(this.#width), { signal });
        this.#applyWidth(this.#readStoredWidth());
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
        this.#drag = null;
        this.area.classList.remove('is-resizing-explorer');
    }

    #startDrag (event) {
        if (event.button !== 0) return;
        this.#drag = Object.freeze({ pointerId: event.pointerId, x: event.clientX, width: this.#width });
        this.splitter.setPointerCapture?.(event.pointerId);
        this.area.classList.add('is-resizing-explorer');
        event.preventDefault();
    }

    #moveDrag (event) {
        if (!this.#drag || event.pointerId !== this.#drag.pointerId) return;
        this.#applyWidth(this.#drag.width + event.clientX - this.#drag.x);
        event.preventDefault();
    }

    #finishDrag (event) {
        if (!this.#drag || event.pointerId !== this.#drag.pointerId) return;
        this.splitter.releasePointerCapture?.(event.pointerId);
        this.#drag = null;
        this.area.classList.remove('is-resizing-explorer');
        this.#persistWidth();
    }

    #resizeFromKeyboard (event) {
        const commands = {
            ArrowLeft: this.#width - KEYBOARD_STEP,
            ArrowRight: this.#width + KEYBOARD_STEP,
            Home: MIN_EXPLORER_WIDTH,
            End: this.#maximumWidth(),
        };
        if (!(event.key in commands)) return;
        this.#applyWidth(commands[event.key], { persist: true });
        event.preventDefault();
    }

    #applyWidth (value, { persist = false } = {}) {
        const maximum = this.#maximumWidth();
        this.#width = Math.round(Math.min(maximum, Math.max(MIN_EXPLORER_WIDTH,
            Number.isFinite(Number(value)) ? Number(value) : DEFAULT_EXPLORER_WIDTH)));
        this.area.style.setProperty('--explorer-width', `${this.#width}px`);
        this.splitter.setAttribute('aria-valuenow', String(this.#width));
        this.splitter.setAttribute('aria-valuemax', String(Math.round(maximum)));
        if (persist) this.#persistWidth();
    }

    #maximumWidth () {
        const areaWidth = this.area.getBoundingClientRect().width;
        if (areaWidth <= 0) return MAX_EXPLORER_WIDTH;
        const available = areaWidth - MIN_EDITOR_WIDTH -
            this.splitter.getBoundingClientRect().width;
        return Math.max(MIN_EXPLORER_WIDTH, Math.min(MAX_EXPLORER_WIDTH, available));
    }

    #readStoredWidth () {
        try {
            return Number(this.storage?.getItem(EXPLORER_WIDTH_STORAGE_KEY)) ||
                DEFAULT_EXPLORER_WIDTH;
        } catch {
            return DEFAULT_EXPLORER_WIDTH;
        }
    }

    #persistWidth () {
        try {
            this.storage?.setItem(EXPLORER_WIDTH_STORAGE_KEY, String(this.#width));
        } catch {
            // The layout remains usable when preference storage is unavailable.
        }
    }
}
