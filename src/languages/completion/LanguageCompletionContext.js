export class LanguageCompletionContext {
    constructor ({ languageId, source, offset, explicit = false }) {
        this.languageId = String(languageId ?? '').trim().toLowerCase();
        this.source = String(source ?? '');
        this.offset = clampOffset(offset, this.source.length);
        this.explicit = Boolean(explicit);
        const lineStart = this.source.lastIndexOf('\n', this.offset - 1) + 1;
        const lineEndIndex = this.source.indexOf('\n', this.offset);
        const lineEnd = lineEndIndex < 0 ? this.source.length : lineEndIndex;
        this.line = this.source.slice(lineStart, lineEnd);
        this.lineOffset = this.offset - lineStart;
        this.prefix = completionPrefix(this.source.slice(0, this.offset));
        this.from = this.offset - this.prefix.length;
        Object.freeze(this);
    }
}

function clampOffset (offset, length) {
    const numeric = Number.isInteger(offset) ? offset : length;
    return Math.max(0, Math.min(numeric, length));
}

function completionPrefix (sourceBeforeCursor) {
    return sourceBeforeCursor.match(/[A-Za-z0-9_$#@&*%]*$/)?.[0] ?? '';
}
