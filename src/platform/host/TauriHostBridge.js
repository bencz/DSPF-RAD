import { BrowserHostBridge } from './BrowserHostBridge.js';

// Local text selection still uses the webview's safe file controls. Native IBM
// i capabilities are exposed through focused Tauri ports, not this bridge.
export class TauriHostBridge extends BrowserHostBridge {
    constructor (options) {
        super(options);
        this.kind = 'tauri';
    }
}
