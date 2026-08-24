import { IbmiSystemName } from './IbmiSystemName.js';

export class IbmiLibraryObject {
    constructor ({ name, objectType, isSourceFile = false, size = null, modifiedAt = null }) {
        this.name = IbmiSystemName.normalize(name);
        this.objectType = IbmiLibraryObject.objectType(objectType);
        this.isSourceFile = Boolean(isSourceFile);
        this.size = IbmiLibraryObject.optionalInteger(size, 'Object size');
        this.modifiedAt = IbmiLibraryObject.optionalInteger(modifiedAt, 'Modification time');
        Object.freeze(this);
    }

    static objectType (value) {
        const objectType = String(value ?? '').trim().toUpperCase();
        if (!/^[A-Z0-9]{1,10}$/.test(objectType)) {
            throw new Error(`Invalid IBM i object type: ${value}`);
        }
        return objectType;
    }

    static optionalInteger (value, label) {
        if (value == null) return null;
        const number = Number(value);
        if (!Number.isSafeInteger(number) || number < 0) {
            throw new Error(`${label} must be a non-negative integer.`);
        }
        return number;
    }
}

export class IbmiSourceMember {
    constructor ({ name, sourceType = '', size = null, modifiedAt = null }) {
        this.name = IbmiSystemName.normalize(name, 'source member');
        this.sourceType = IbmiSourceMember.sourceType(sourceType);
        this.size = IbmiLibraryObject.optionalInteger(size, 'Member size');
        this.modifiedAt = IbmiLibraryObject.optionalInteger(modifiedAt, 'Modification time');
        Object.freeze(this);
    }

    static sourceType (value) {
        const sourceType = String(value ?? '').trim().toUpperCase();
        if (sourceType && !/^[A-Z0-9_$#@]{1,10}$/.test(sourceType)) {
            throw new Error(`Invalid IBM i source type: ${value}`);
        }
        return sourceType;
    }
}
