import { CompletionItem } from './CompletionItem.js';
import { LanguageCompletionContext } from './LanguageCompletionContext.js';

export class ContextualCompletionEngine {
    #providers = new Map();

    register (languageId, provider) {
        const id = String(languageId ?? '').trim().toLowerCase();
        if (!id) throw new TypeError('Completion provider language id is required.');
        if (!provider || typeof provider.provideCompletions !== 'function') {
            throw new TypeError('Completion provider must implement provideCompletions().');
        }
        const providers = this.#providers.get(id) ?? [];
        providers.push(provider);
        this.#providers.set(id, providers);
        return () => {
            const current = this.#providers.get(id) ?? [];
            const index = current.indexOf(provider);
            if (index >= 0) current.splice(index, 1);
            if (!current.length) this.#providers.delete(id);
        };
    }

    complete (request) {
        const context = request instanceof LanguageCompletionContext
            ? request
            : new LanguageCompletionContext(request);
        const providers = this.#providers.get(context.languageId) ?? [];
        const collected = providers.flatMap(provider =>
            provider.provideCompletions(context) ?? []);
        const unique = new Map();
        for (const itemLike of collected) {
            const item = itemLike instanceof CompletionItem
                ? itemLike
                : new CompletionItem(itemLike);
            const key = `${item.type}:${item.label.toUpperCase()}`;
            const existing = unique.get(key);
            if (!existing || item.boost > existing.boost) unique.set(key, item);
        }
        const prefix = context.prefix.toUpperCase();
        const items = [...unique.values()]
            .filter(item => !prefix || item.label.toUpperCase().startsWith(prefix))
            .sort((left, right) =>
                right.boost - left.boost || left.label.localeCompare(right.label));
        return Object.freeze({
            from: context.from,
            to: context.offset,
            items: Object.freeze(items),
        });
    }
}
