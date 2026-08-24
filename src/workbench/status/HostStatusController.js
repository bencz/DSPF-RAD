// Presents the active runtime host in the workbench status bar. IBM i session
// state is rendered independently by ConnectionStatusController.
export class HostStatusController {
    constructor ({ element, host }) {
        if (!element) throw new TypeError('HostStatusController requires an element.');
        if (!host) throw new TypeError('HostStatusController requires a host bridge.');
        this.element = element;
        this.host = host;
    }

    render () {
        const { kind, capabilities } = this.host.describe();
        this.element.textContent = kind === 'browser' ? 'Local · Browser' : `Local · ${kind}`;
        this.element.title = `Runtime host: ${kind}\nCapabilities: ${capabilities.join(', ')}`;
    }
}
