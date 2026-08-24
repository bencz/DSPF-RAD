import { IbmiConnectionState } from '../../features/ibmi-connections/IbmiConnectionService.js';

export class ConnectionStatusController {
    #disposeConnection = null;
    #disposeProfiles = null;

    constructor ({ element, service, profiles }) {
        if (!element) throw new TypeError('ConnectionStatusController requires an element.');
        if (!service) throw new TypeError('ConnectionStatusController requires a connection service.');
        if (!profiles) throw new TypeError('ConnectionStatusController requires a profile store.');
        this.element = element;
        this.service = service;
        this.profiles = profiles;
    }

    start () {
        this.stop();
        this.#disposeConnection = this.service.onDidChange(() => this.render());
        this.#disposeProfiles = this.profiles.onDidChange(() => this.render());
        this.render();
    }

    stop () {
        this.#disposeConnection?.();
        this.#disposeProfiles?.();
        this.#disposeConnection = null;
        this.#disposeProfiles = null;
    }

    render () {
        const profile = this.service.profile ?? this.profiles.activeProfile;
        const labels = {
            [IbmiConnectionState.CONNECTING]: 'IBM i · Connecting',
            [IbmiConnectionState.CONNECTED]: `IBM i · ${this.service.session?.systemName ?? profile?.name ?? 'Connected'}`,
            [IbmiConnectionState.DISCONNECTING]: 'IBM i · Disconnecting',
            [IbmiConnectionState.FAILED]: 'IBM i · Failed',
            [IbmiConnectionState.DISCONNECTED]: this.service.port.available
                ? 'IBM i · Offline'
                : 'IBM i · Unavailable',
        };
        this.element.textContent = labels[this.service.state];
        this.element.dataset.state = this.service.state;
        this.element.title = this.#title(profile);
    }

    #title (profile) {
        const lines = [
            `IBM i connection state: ${this.service.state}`,
            `Connection port: ${this.service.port.kind}`,
        ];
        if (profile) lines.push(`Profile: ${profile.name} (${profile.host}:${profile.port})`);
        if (this.service.session?.jobName) lines.push(`Server job: ${this.service.session.jobName}`);
        if (this.service.session?.currentLibrary) {
            lines.push(`Current library: ${this.service.session.currentLibrary}`);
        }
        if (!this.service.port.available) {
            lines.push('Remote connections require an implemented desktop adapter.');
        }
        return lines.join('\n');
    }
}
