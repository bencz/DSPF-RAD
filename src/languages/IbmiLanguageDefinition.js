export class IbmiLanguageDefinition {
    constructor ({
        id,
        label,
        memberTypes = [],
        extensions = [],
        compileCommands = [],
        family = id,
    }) {
        this.id = requiredText(id, 'Language id').toLowerCase();
        this.label = requiredText(label, 'Language label');
        this.family = requiredText(family, 'Language family').toLowerCase();
        this.memberTypes = normalizedList(memberTypes, value => value.toUpperCase());
        this.extensions = normalizedList(extensions, normalizeExtension);
        this.compileCommands = normalizedList(
            compileCommands,
            value => value.toUpperCase());
        Object.freeze(this);
    }

    matchesMemberType (sourceType) {
        return this.memberTypes.includes(String(sourceType ?? '').trim().toUpperCase());
    }

    matchesFileName (fileName) {
        const normalized = String(fileName ?? '').trim().toLowerCase();
        return this.extensions.some(extension => normalized.endsWith(extension));
    }
}

function requiredText (value, label) {
    const text = String(value ?? '').trim();
    if (!text) throw new TypeError(`${label} is required.`);
    return text;
}

function normalizedList (values, normalize) {
    if (!Array.isArray(values)) throw new TypeError('Language metadata must be an array.');
    return Object.freeze([...new Set(values.map(value => normalize(String(value).trim()))
        .filter(Boolean))]);
}

function normalizeExtension (extension) {
    const normalized = extension.toLowerCase();
    return normalized && !normalized.startsWith('.') ? `.${normalized}` : normalized;
}
