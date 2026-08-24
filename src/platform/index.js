import { createHostBridge } from './host/index.js';
import { UnavailableIbmiConnectionPort } from './ibmi/UnavailableIbmiConnectionPort.js';
import { DesktopWindowController } from './tauri/DesktopWindowController.js';

export function createPlatformServices (options) {
    const host = createHostBridge(options);
    const ibmiConnections = new UnavailableIbmiConnectionPort({ hostKind: host.kind });
    const desktopWindow = new DesktopWindowController(options);
    return Object.freeze({ host, ibmiConnections, desktopWindow });
}
