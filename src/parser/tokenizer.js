// Tokenisers for the keyword area (cols 45+).
//
// tokenizeKeywords returns [{ name, args }, ...].  Args preserve embedded
// quoted strings verbatim — with surrounding quotes kept — and are
// space-separated at depth 1 inside the outer parentheses.
//
// readQuotedString peels a single 'literal' off the front of a string,
// un-escaping doubled-single-quotes per IBM convention.

export function tokenizeKeywords (text) {
    const out = [];
    let i = 0;
    const n = text.length;

    while (i < n) {
        while (i < n && /\s/.test(text[i])) i++;
        if (i >= n) break;

        // Skip anything that isn't a keyword head.
        if (!/[A-Za-z]/.test(text[i])) { i++; continue; }

        let name = '';
        while (i < n && /[A-Za-z0-9_]/.test(text[i])) name += text[i++];

        const args = [];
        if (text[i] === '(') {
            i = readArgList(text, i + 1, args);
        }

        out.push({ name: name.toUpperCase(), args });
    }
    return out;
}

// Reads arg tokens up to the matching ')'.  Returns the index just past
// the closing paren.  Tracks nested parens and quoted strings so spaces
// inside them stay glued to their arg.
function readArgList (text, startIdx, outArgs) {
    let i = startIdx;
    let depth = 1;
    let arg = '';
    let inQuote = false;
    const n = text.length;

    while (i < n && depth > 0) {
        const c = text[i];
        if (inQuote) {
            arg += c;
            if (c === "'") {
                if (text[i + 1] === "'") { arg += text[++i]; }
                else inQuote = false;
            }
            i++;
        } else if (c === "'") {
            arg += c; inQuote = true; i++;
        } else if (c === '(') {
            depth++; arg += c; i++;
        } else if (c === ')') {
            depth--;
            if (depth === 0) { i++; break; }
            arg += c; i++;
        } else if (/\s/.test(c) && depth === 1) {
            if (arg) { outArgs.push(arg); arg = ''; }
            i++;
        } else {
            arg += c; i++;
        }
    }
    if (arg) outArgs.push(arg);
    return i;
}

// Returns { text, rest }.  `text` has doubled-quotes un-escaped to a
// single quote; `rest` is whatever follows the closing quote (may include
// trailing keywords like COLOR(BLU)).
export function readQuotedString (s) {
    let i = 1;
    let out = '';
    while (i < s.length) {
        const c = s[i];
        if (c === "'") {
            if (s[i + 1] === "'") { out += "'"; i += 2; continue; }
            return { text: out, rest: s.substring(i + 1) };
        }
        out += c;
        i++;
    }
    return { text: out, rest: '' };       // unterminated
}
