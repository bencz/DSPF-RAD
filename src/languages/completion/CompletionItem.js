const COMPLETION_TYPES = new Set([
    'command', 'keyword', 'value', 'variable', 'function', 'snippet',
]);

export class CompletionItem {
    constructor ({ label, type, detail = '', insertText = label, boost = 0 }) {
        this.label = requiredText(label, 'Completion label');
        if (!COMPLETION_TYPES.has(type)) {
            throw new Error(`Unsupported completion type: ${type}`);
        }
        this.type = type;
        this.detail = String(detail ?? '').trim();
        this.insertText = String(insertText ?? this.label);
        this.boost = Number.isFinite(boost) ? boost : 0;
        Object.freeze(this);
    }
}

function requiredText (value, label) {
    const text = String(value ?? '').trim();
    if (!text) throw new TypeError(`${label} is required.`);
    return text;
}
