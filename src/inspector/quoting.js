// IBM-style 'literal' helpers + a generic "remove all keywords named X"
// utility used by every section that does single-shot keyword writes.

export function stripQuotes (s) {
    if (!s) return '';
    const t = String(s).trim();
    if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
        return t.substring(1, t.length - 1).replace(/''/g, "'");
    }
    return t;
}

export function quote (s) {
    return s == null ? '' : `'${String(s).replace(/'/g, "''")}'`;
}

// Strip every keyword named `name` from target.keywords; returns count.
export function removeKeyword (target, name) {
    let n = 0;
    for (let i = target.keywords.length - 1; i >= 0; i--) {
        if (target.keywords[i].name === name) {
            target.keywords.splice(i, 1);
            n++;
        }
    }
    return n;
}
