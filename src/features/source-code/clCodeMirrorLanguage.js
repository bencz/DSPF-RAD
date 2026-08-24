import {
    HighlightStyle,
    StreamLanguage,
    syntaxHighlighting,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';

const clLanguage = StreamLanguage.define({
    name: 'ibmi-cl',
    startState: () => ({
        inComment: false,
        inString: false,
        statementStart: true,
        continued: false,
    }),
    token (stream, state) {
        if (stream.sol()) {
            state.statementStart = !state.continued;
            state.continued = false;
        }
        if (state.inComment) return readComment(stream, state);
        if (state.inString) return readString(stream, state);
        if (stream.eatSpace()) return null;
        if (stream.match('/*')) {
            state.inComment = true;
            return readComment(stream, state);
        }
        if (stream.peek() === "'") {
            stream.next();
            state.inString = true;
            return readString(stream, state);
        }
        if (stream.match(/&[A-Za-z$#@][A-Za-z0-9_$#@]{0,9}/)) {
            state.statementStart = false;
            return 'variableName';
        }
        if (stream.match(/%[A-Za-z][A-Za-z0-9]*/)) return 'function(variableName)';
        if (stream.match(/\*[A-Za-z0-9]+/)) return 'atom';
        if (stream.match(/[+-]?\d+(?:[.,]\d+)?/)) return 'number';
        if (stream.match(/[A-Za-z$#@][A-Za-z0-9_$#@]{0,9}/)) {
            const word = stream.current();
            if (stream.peek() === ':') {
                stream.next();
                state.statementStart = true;
                return 'labelName';
            }
            const style = state.statementStart ? 'keyword' :
                nextNonBlank(stream.string, stream.pos) === '(' ? 'propertyName' : 'name';
            state.statementStart = false;
            return style;
        }
        const character = stream.next();
        if (character === ')' || character === '(') return 'bracket';
        if ((character === '+' || character === '-') &&
            !stream.string.slice(stream.pos).trim()) state.continued = true;
        return 'operator';
    },
});

function readComment (stream, state) {
    while (!stream.eol()) {
        if (stream.match('*/')) {
            state.inComment = false;
            return 'comment';
        }
        stream.next();
    }
    return 'comment';
}

function readString (stream, state) {
    while (!stream.eol()) {
        const character = stream.next();
        if (character !== "'") continue;
        if (stream.peek() === "'") {
            stream.next();
            continue;
        }
        state.inString = false;
        return 'string';
    }
    return 'string';
}

function nextNonBlank (source, offset) {
    return source.slice(offset).match(/^\s*(.)/)?.[1] ?? '';
}

const clHighlight = HighlightStyle.define([
    { tag: tags.keyword, color: '#7fd7ff', fontWeight: 'bold' },
    { tag: tags.propertyName, color: '#9cdcfe' },
    { tag: tags.variableName, color: '#dcdcaa' },
    { tag: tags.function(tags.variableName), color: '#c586c0' },
    { tag: tags.atom, color: '#4ec9b0' },
    { tag: tags.string, color: '#ce9178' },
    { tag: tags.number, color: '#b5cea8' },
    { tag: tags.comment, color: '#6a9955', fontStyle: 'italic' },
    { tag: tags.labelName, color: '#d7ba7d' },
    { tag: tags.bracket, color: '#d4d4d4' },
    { tag: tags.operator, color: '#d4d4d4' },
]);

export const clCodeMirrorExtensions = Object.freeze([
    clLanguage,
    syntaxHighlighting(clHighlight),
]);
