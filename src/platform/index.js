import { createHostBridge } from './host/index.js';
import { UnavailableIbmiConnectionPort } from './ibmi/UnavailableIbmiConnectionPort.js';
import { UnavailableIbmiWorkspaceStoragePort } from './ibmi/UnavailableIbmiWorkspaceStoragePort.js';
import { UnavailableIbmiObjectBrowserPort } from './ibmi/UnavailableIbmiObjectBrowserPort.js';
import { DesktopWindowController } from './tauri/DesktopWindowController.js';
import { TauriIbmiConnectionPort } from './tauri/ibmi/TauriIbmiConnectionPort.js';
import {
    TauriIbmiWorkspaceStoragePort,
} from './tauri/ibmi/TauriIbmiWorkspaceStoragePort.js';
import { TauriIbmiObjectBrowserPort } from './tauri/ibmi/TauriIbmiObjectBrowserPort.js';

export function createPlatformServices (options) {
    const host = createHostBridge(options);
    const desktopRuntime = typeof globalThis.__TAURI_INTERNALS__ === 'object';
    const ibmiConnections = desktopRuntime
        ? new TauriIbmiConnectionPort()
        : new UnavailableIbmiConnectionPort({ hostKind: host.kind });
    const ibmiWorkspaceStorage = desktopRuntime
        ? new TauriIbmiWorkspaceStoragePort()
        : new UnavailableIbmiWorkspaceStoragePort({ hostKind: host.kind });
    const ibmiObjectBrowser = desktopRuntime
        ? new TauriIbmiObjectBrowserPort()
        : new UnavailableIbmiObjectBrowserPort({ hostKind: host.kind });
    const desktopWindow = new DesktopWindowController(options);
    return Object.freeze({
        host,
        ibmiConnections,
        ibmiWorkspaceStorage,
        ibmiObjectBrowser,
        desktopWindow,
    });
}
