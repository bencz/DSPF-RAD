import { BrowserHostBridge } from './BrowserHostBridge.js';
import { TauriHostBridge } from './TauriHostBridge.js';

export { HostBridge, UnsupportedHostOperationError } from './HostBridge.js';
export { BrowserHostBridge } from './BrowserHostBridge.js';
export { TauriHostBridge } from './TauriHostBridge.js';
export { HostCapability } from './capabilities.js';

export function createHostBridge (options) {
    return typeof globalThis.__TAURI_INTERNALS__ === 'object'
        ? new TauriHostBridge(options)
        : new BrowserHostBridge(options);
}
