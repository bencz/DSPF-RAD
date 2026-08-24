import { IbmiLanguageDefinition } from './IbmiLanguageDefinition.js';

export class IbmiLanguageRegistry {
    #definitions = new Map();
    #memberTypes = new Map();

    register (definitionLike) {
        const definition = definitionLike instanceof IbmiLanguageDefinition
            ? definitionLike
            : new IbmiLanguageDefinition(definitionLike);
        if (this.#definitions.has(definition.id)) {
            throw new Error(`IBM i language is already registered: ${definition.id}`);
        }
        for (const sourceType of definition.memberTypes) {
            if (this.#memberTypes.has(sourceType)) {
                throw new Error(`IBM i source type is already registered: ${sourceType}`);
            }
        }
        this.#definitions.set(definition.id, definition);
        for (const sourceType of definition.memberTypes) {
            this.#memberTypes.set(sourceType, definition.id);
        }
        return () => this.unregister(definition.id);
    }

    unregister (languageId) {
        const definition = this.get(languageId);
        if (!definition) return false;
        this.#definitions.delete(definition.id);
        for (const sourceType of definition.memberTypes) this.#memberTypes.delete(sourceType);
        return true;
    }

    get (languageId) {
        return this.#definitions.get(String(languageId ?? '').trim().toLowerCase()) ?? null;
    }

    resolve ({ sourceType = '', fileName = '' } = {}) {
        const languageId = this.#memberTypes.get(String(sourceType).trim().toUpperCase());
        if (languageId) return this.get(languageId);
        for (const definition of this.#definitions.values()) {
            if (definition.matchesFileName(fileName)) return definition;
        }
        return this.get('plaintext');
    }

    list () {
        return Object.freeze([...this.#definitions.values()]);
    }
}
