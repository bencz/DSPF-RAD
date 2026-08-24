import {
    HighlightStyle,
    StreamLanguage,
    syntaxHighlighting,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';

const DDS_KEYWORDS = new Set([
    'ALIAS', 'ASSUME', 'CA', 'CF', 'CHANGE', 'CHECK', 'CHOICE', 'COLHDG',
    'COLOR', 'COMP', 'CSRLOC', 'DATFMT', 'DFT', 'DSPATR', 'DSPSIZ', 'EDTCDE',
    'EDTWRD', 'ERRMSG', 'ERRMSGID', 'FONT', 'HELP', 'JFILE', 'JFLD', 'JOIN',
    'MNUBAR', 'PFILE', 'PULLDOWN', 'REFFLD', 'SFL', 'SFLCTL', 'SFLDSP',
    'SFLDSPCTL', 'SFLPAG', 'SFLSIZ', 'TEXT', 'UNIQUE', 'VALUES', 'WINDOW',
]);

const ddsLanguage = StreamLanguage.define({
    name: 'ibmi-dds',
    token (stream) {
        if (stream.sol() && isCommentLine(stream.string)) {
            stream.skipToEnd();
            return 'comment';
        }
        if (stream.sol() && stream.match(/^\d{5}/)) return 'meta';
        if (stream.eatSpace()) return null;
        if (stream.peek() === "'") return readQuotedString(stream);
        if (stream.match(/\*[A-Z0-9]+/i)) return 'atom';
        if (stream.match(/[+-]?\d+(?:\.\d+)?/)) return 'number';
        if (stream.match(/[A-Z$#@][A-Z0-9_$#@]*/i)) {
            const word = stream.current().toUpperCase();
            if (/^(?:CA|CF)\d{2}$/.test(word)) return 'keyword';
            if (DDS_KEYWORDS.has(word) || nextNonBlank(stream.string, stream.pos) === '(') {
                return 'keyword';
            }
            return stream.pos <= 29 ? 'definition(variableName)' : 'name';
        }
        const character = stream.next();
        if (character === '(' || character === ')') return 'bracket';
        if (character === '+' || character === '-' || character === '=') return 'operator';
        return null;
    },
});

function isCommentLine (line) {
    return line[6] === '*' || /^\s*\/\//.test(line);
}

function readQuotedString (stream) {
    stream.next();
    while (!stream.eol()) {
        if (stream.next() !== "'") continue;
        if (stream.peek() === "'") {
            stream.next();
            continue;
        }
        break;
    }
    return 'string';
}

function nextNonBlank (source, offset) {
    return source.slice(offset).match(/^\s*(.)/)?.[1] ?? '';
}

const ddsHighlight = HighlightStyle.define([
    { tag: tags.meta, color: '#6f7f8f' },
    { tag: tags.keyword, color: '#7fd7ff', fontWeight: 'bold' },
    { tag: tags.definition(tags.variableName), color: '#dcdcaa' },
    { tag: tags.atom, color: '#4ec9b0' },
    { tag: tags.string, color: '#ce9178' },
    { tag: tags.number, color: '#b5cea8' },
    { tag: tags.comment, color: '#6a9955', fontStyle: 'italic' },
    { tag: tags.bracket, color: '#d4d4d4' },
    { tag: tags.operator, color: '#d4d4d4' },
]);

export const ddsCodeMirrorExtensions = Object.freeze([
    ddsLanguage,
    syntaxHighlighting(ddsHighlight),
]);
