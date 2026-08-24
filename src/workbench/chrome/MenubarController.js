export class MenubarController {
    #openMenu = null;
    #abortController = null;

    constructor ({ commands, documentRef = globalThis.document, logger = globalThis.console }) {
        if (!commands) throw new TypeError('MenubarController requires a command registry.');
        this.commands = commands;
        this.document = documentRef;
        this.logger = logger;
        this.element = documentRef.getElementById('menubar');
    }

    start () {
        if (!this.element) return false;
        this.stop();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;

        for (const menu of this.element.querySelectorAll(':scope > li.menu')) {
            const title = menu.querySelector(':scope > .menu-title');
            if (!title) continue;
            title.addEventListener('click', event => {
                event.stopPropagation();
                if (menu.classList.contains('open')) this.closeAll();
                else this.open(menu);
            }, { signal });
            title.addEventListener('mouseenter', () => {
                if (this.#openMenu && this.#openMenu !== menu) this.open(menu);
            }, { signal });
        }

        this.document.addEventListener('click', event => {
            if (!this.element.contains(event.target)) this.closeAll();
        }, { signal });
        this.document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && this.#openMenu) this.closeAll();
        }, { signal });
        this.element.addEventListener('click', event => this.#dispatch(event), { signal });
        return true;
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
        this.closeAll();
    }

    open (menu) {
        if (this.#openMenu && this.#openMenu !== menu) {
            this.#openMenu.classList.remove('open');
        }
        this.#syncCommandStates(menu);
        this.#openMenu = menu;
        menu.classList.add('open');
    }

    closeAll () {
        this.#openMenu?.classList.remove('open');
        this.#openMenu = null;
    }

    #syncCommandStates (menu) {
        const items = [...menu.querySelectorAll('.menu-item[data-cmd]')];
        for (const item of items) {
            item.disabled = !this.commands.canExecute(item.dataset.cmd);
        }
    }

    #dispatch (event) {
        const item = event.target.closest('.menu-item[data-cmd]');
        if (!item || item.disabled) return;
        event.stopPropagation();
        void this.commands.execute(item.dataset.cmd).catch(error => {
            this.logger.error('[ironterm] command failed:', error);
        });
        this.closeAll();
    }
}
