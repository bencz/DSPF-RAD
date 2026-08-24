export class WorkspaceCacheController {
    #disposeSession = null;

    constructor ({ session, cache, logger = globalThis.console }) {
        if (!session) throw new TypeError('WorkspaceCacheController requires a session.');
        if (!cache) throw new TypeError('WorkspaceCacheController requires a cache store.');
        this.session = session;
        this.cache = cache;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#disposeSession = this.session.onDidChange(() => this.#save());
        this.#save();
    }

    stop () {
        this.#disposeSession?.();
        this.#disposeSession = null;
    }

    #save () {
        try {
            this.cache.save(this.session);
        } catch (error) {
            this.logger.error('[ironterm] workspace cache update failed:', error);
        }
    }
}
