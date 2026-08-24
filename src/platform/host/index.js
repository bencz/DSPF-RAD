import { BrowserHostBridge } from './BrowserHostBridge.js';

export { HostBridge, UnsupportedHostOperationError } from './HostBridge.js';
export { BrowserHostBridge } from './BrowserHostBridge.js';
export { HostCapability } from './capabilities.js';

export function createHostBridge (options) {
    // TauriHostBridge will be selected here once the desktop shell lands.
    return new BrowserHostBridge(options);
}
