const STORAGE_KEY = 'dspf-rad:col-marker';

export class ColumnMarkerPreferenceController {
    #abortController = null;

    constructor ({ sourceEditor, toggleElement, storage = globalThis.localStorage }) {
        this.sourceEditor = sourceEditor;
        this.toggleElement = toggleElement;
        this.storage = storage;
    }

    start () {
        this.stop();
        const initial = this.#read();
        this.sourceEditor.setCursorColumnMarker(initial);
        this.toggleElement?.classList.toggle('on', initial);
        if (!this.toggleElement) return;

        this.#abortController = new AbortController();
        this.toggleElement.addEventListener('click', () => this.#toggle(), {
            signal: this.#abortController.signal,
        });
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
    }

    #toggle () {
        const enabled = !this.toggleElement.classList.contains('on');
        this.toggleElement.classList.toggle('on', enabled);
        this.sourceEditor.setCursorColumnMarker(enabled);
        try { this.storage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); }
        catch (_) { /* private mode storage may throw */ }
    }

    #read () {
        try { return this.storage.getItem(STORAGE_KEY) === 'on'; }
        catch (_) { return false; }
    }
}
