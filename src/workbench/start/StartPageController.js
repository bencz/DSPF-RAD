import { WorkbenchCommand } from '../commands/commandIds.js';

export class StartPageController {
    #abortController = null;
    #disposeDocuments = null;
    #disposeWorkspace = null;
    #disposeConnection = null;

    constructor ({
        element,
        commands,
        documents,
        workspaceSession,
        connectionService,
        host,
        logger = globalThis.console,
    }) {
        if (!element) throw new TypeError('StartPageController requires an element.');
        if (!commands) throw new TypeError('StartPageController requires commands.');
        if (!documents) throw new TypeError('StartPageController requires documents.');
        this.element = element;
        this.commands = commands;
        this.documents = documents;
        this.workspaceSession = workspaceSession;
        this.connectionService = connectionService;
        this.host = host;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#abortController = new AbortController();
        this.element.addEventListener('click', event => this.#dispatch(event), {
            signal: this.#abortController.signal,
        });
        this.#disposeDocuments = this.documents.onDidChange(() => this.render());
        this.#disposeWorkspace = this.workspaceSession?.onDidChange(() => this.render());
        this.#disposeConnection = this.connectionService?.onDidChange(() => this.render());
        this.render();
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
        this.#disposeDocuments?.();
        this.#disposeWorkspace?.();
        this.#disposeConnection?.();
        this.#disposeDocuments = null;
        this.#disposeWorkspace = null;
        this.#disposeConnection = null;
    }

    render () {
        const returnButton = this.element.querySelector('[data-role="return-editor"]');
        if (returnButton) returnButton.hidden = this.documents.documents.length === 0;
        const workspaceName = this.element.querySelector('[data-role="workspace-name"]');
        if (workspaceName) workspaceName.textContent = this.workspaceSession?.workspace.name ?? 'No workspace';
        const runtime = this.element.querySelector('[data-role="runtime"]');
        if (runtime) runtime.textContent = this.host?.kind === 'browser' ? 'Browser · offline ready' : this.host?.kind;
        const connection = this.element.querySelector('[data-role="connection"]');
        if (connection) connection.textContent = this.connectionService?.state ?? 'unavailable';
        const profile = this.element.querySelector('[data-role="profile"]');
        if (profile) {
            const activeProfile = this.connectionService?.profile ??
                this.connectionService?.profiles?.activeProfile;
            profile.textContent = activeProfile
                ? `${activeProfile.name} · ${activeProfile.host}`
                : 'not configured';
        }
        const library = this.element.querySelector('[data-role="library"]');
        if (library) {
            const projects = this.workspaceSession?.workspace.projects
                .filter(project => project.kind === 'ibmi') ?? [];
            library.textContent = projects.length === 1
                ? projects[0].name
                : projects.length ? `${projects.length} attached` : 'not attached';
            library.title = projects.map(project => project.name).join(', ');
        }
        this.#syncCommandStates();
    }

    #syncCommandStates () {
        for (const button of this.element.querySelectorAll('button[data-command]')) {
            button.disabled = !this.commands.canExecute(button.dataset.command);
        }
    }

    #dispatch (event) {
        const button = event.target.closest('button[data-command]');
        if (!button || button.disabled) return;
        void this.commands.execute(button.dataset.command).catch(error => {
            this.logger.error(`[ironterm] start page command ${button.dataset.command} failed:`, error);
        });
    }
}
