import { IbmiSystemName } from './IbmiSystemName.js';

export class IbmiLibrarySelection {
    constructor (values) {
        if (!Array.isArray(values)) {
            throw new TypeError('IBM i library selection must be an array.');
        }
        const libraries = values
            .map(value => String(value ?? '').trim())
            .filter(Boolean)
            .map(value => IbmiSystemName.normalize(value, 'library'));
        this.libraries = Object.freeze([...new Set(libraries)]);
        if (!this.libraries.length) {
            throw new TypeError('Enter at least one concrete IBM i library name.');
        }
        Object.freeze(this);
    }

    static fromText (value) {
        const entries = String(value ?? '').split(/[\s,;]+/);
        return new IbmiLibrarySelection(entries);
    }

    static suggestedText (profile) {
        if (!profile) return '';
        const values = [profile.defaultLibrary, ...(profile.libraryList ?? [])]
            .filter(value => value && value !== '*CURLIB');
        return [...new Set(values)].join(', ');
    }
}
