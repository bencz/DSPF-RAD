import { HostBridge } from './HostBridge.js';
import { HostCapability } from './capabilities.js';

export class BrowserHostBridge extends HostBridge {
    constructor ({ documentRef = globalThis.document, urlRef = globalThis.URL } = {}) {
        super({
            kind: 'browser',
            capabilities: [
                HostCapability.OPEN_LOCAL_TEXT,
                HostCapability.SAVE_LOCAL_TEXT,
            ],
        });
        this.document = documentRef;
        this.url = urlRef;
    }

    async openTextFile ({ accept = '' } = {}) {
        const file = await this.#selectFile(accept);
        return file ? { name: file.name, text: await file.text() } : null;
    }

    async saveTextFile ({ suggestedName, text, mime = 'text/plain;charset=utf-8' }) {
        if (!suggestedName) throw new TypeError('saveTextFile requires suggestedName.');
        const blob = new Blob([String(text ?? '')], { type: mime });
        const objectUrl = this.url.createObjectURL(blob);
        const anchor = this.document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = suggestedName;
        this.document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => this.url.revokeObjectURL(objectUrl), 5000);
        return { name: suggestedName };
    }

    #selectFile (accept) {
        return new Promise(resolve => {
            const input = this.document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.hidden = true;
            this.document.body.appendChild(input);
            let settled = false;
            const finish = file => {
                if (settled) return;
                settled = true;
                input.remove();
                resolve(file ?? null);
            };
            input.addEventListener('change', () => finish(input.files?.[0]), { once: true });
            input.addEventListener('cancel', () => finish(null), { once: true });
            input.click();
        });
    }
}
