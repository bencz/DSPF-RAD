import { ContextualCompletionEngine } from './completion/ContextualCompletionEngine.js';
import { ClCompletionProvider } from './cl/ClCompletionProvider.js';
import { createDefaultIbmiLanguageRegistry } from './createDefaultIbmiLanguageRegistry.js';

export class LanguageServices {
    constructor ({
        languages = createDefaultIbmiLanguageRegistry(),
        completions = new ContextualCompletionEngine(),
    } = {}) {
        this.languages = languages;
        this.completions = completions;
        this.#registerBuiltInProviders();
        Object.freeze(this);
    }

    #registerBuiltInProviders () {
        this.completions.register('cl', new ClCompletionProvider());
    }
}

export function createLanguageServices () {
    return new LanguageServices();
}
