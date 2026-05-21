// Column-aware DSPF stream tokeniser + highlight style.  Tokens are
// scoped by source column so highlighting matches what the compiler sees.

import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const dspfStreamLang = StreamLanguage.define({
    name: 'dspf',
    startState: () => ({ inString: false }),
    token (stream, state) {
        // Reset string state at SOL — the writer never wraps strings
        // across lines, so a fresh line is always outside a literal.
        if (stream.sol()) state.inString = false;
        const col = stream.pos + 1;          // 1-indexed column

        if (state.inString) return readInsideString(stream, state);

        // Sequence number area (cols 1-5).  An '*' in col 1 is a rare but
        // legal whole-line comment.
        if (col >= 1 && col <= 5) return tokenSeqArea(stream, col);

        // Form-type at col 6: 'A' for DSPF lines, '*' for comments.
        if (col === 6) return tokenFormType(stream);
        if (col === 7) { stream.next(); return null; }

        // Indicator slots (cols 8-16: three 3-char chunks).
        if (col >= 8 && col <= 16) {
            const ch = stream.next();
            return /[A-Za-z0-9]/.test(ch) ? 'atom' : null;
        }

        // Metadata cols 17-44: name / refFlag / length / type / decimals /
        // usage / row / col.
        if (col >= 17 && col <= 44) return tokenMetadata(stream);

        // Keyword area col 45+.
        if (col >= 45) return tokenKeywordArea(stream, state);

        stream.next();
        return null;
    },
});

function readInsideString (stream, state) {
    while (!stream.eol()) {
        const ch = stream.next();
        if (ch === "'") {
            if (stream.peek() === "'") { stream.next(); continue; }   // ''-escape
            state.inString = false;
            return 'string';
        }
    }
    return 'string';
}

function tokenSeqArea (stream, col) {
    if (col === 1 && stream.peek() === '*') {
        stream.skipToEnd();
        return 'comment';
    }
    stream.next();
    return 'lineComment';
}

function tokenFormType (stream) {
    const ch = stream.next();
    if (ch === '*') { stream.skipToEnd(); return 'comment'; }
    if (ch === 'A' || ch === 'a') return 'meta';
    return null;
}

function tokenMetadata (stream) {
    if (stream.match(/[A-Za-z][A-Za-z0-9_]*/)) return 'variableName';
    if (stream.match(/[0-9]+/))                return 'number';
    stream.next();
    return null;
}

function tokenKeywordArea (stream, state) {
    const ch = stream.peek();
    if (ch === "'") {
        stream.next();
        state.inString = true;
        return readInsideString(stream, state);
    }
    if (/[A-Za-z]/.test(ch)) {
        stream.eatWhile(/[A-Za-z0-9_]/);
        return 'keyword';
    }
    if (/[0-9]/.test(ch)) {
        stream.eatWhile(/[0-9.\-+]/);
        return 'number';
    }
    if (ch === '(' || ch === ')') { stream.next(); return 'bracket'; }
    // '+' / '-' at line tail = continuation marker.
    if (ch === '+' || ch === '-') { stream.next(); return 'meta'; }
    stream.next();
    return null;
}

const dspfHighlight = HighlightStyle.define([
    { tag: tags.keyword,      color: '#6f6', fontWeight: 'bold' },
    { tag: tags.string,       color: '#ffd866' },
    { tag: tags.atom,         color: '#cc6' },
    { tag: tags.number,       color: '#3dd' },
    { tag: tags.variableName, color: '#9cf' },
    { tag: tags.meta,         color: '#888' },
    { tag: tags.lineComment,  color: '#2a4a2a' },
    { tag: tags.comment,      color: '#555', fontStyle: 'italic' },
    { tag: tags.bracket,      color: '#888' },
]);

export const dspfLanguageExtensions = [
    dspfStreamLang,
    syntaxHighlighting(dspfHighlight),
];
