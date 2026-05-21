// Lightweight readers over an item's keywords[].  Shared by the renderers
// and the metrics module so both stay in sync on what each ENPTUI shape
// looks like.

export function hasKeyword (it, name) {
    return (it.keywords ?? []).some(kw => kw.name === name);
}

export function readNumericKeyword (target, name) {
    const kw = (target.keywords ?? []).find(k => k.name === name);
    if (!kw) return null;
    const n = parseInt(kw.args?.[0], 10);
    return Number.isFinite(n) ? n : null;
}

// CHOICE(num 'label') entries on SNGCHCFLD / MLTCHCFLD fields.
export function choicesOf (it) {
    const out = [];
    for (const kw of it.keywords ?? []) {
        if (kw.name === 'CHOICE') {
            out.push({
                num:   kw.args[0],
                label: unquoteArg(kw.args.slice(1).join(' ')),
            });
        }
    }
    return out;
}

// MNUBARCHC(num pulldownRec 'label') entries on a MNUBAR field.
export function mnubarChoicesOf (it) {
    const out = [];
    for (const kw of it.keywords ?? []) {
        if (kw.name === 'MNUBARCHC') {
            out.push({
                num:    kw.args[0],
                record: kw.args[1],
                label:  unquoteArg(kw.args.slice(2).join(' ')),
            });
        }
    }
    return out;
}

// PSHBTNCHC(num 'label' [action]) entries.  IBM's canonical spelling is
// PSHBTN*; we accept PUSHBTN* too.  Action (CFnn/CAnn/ENTER) is read but
// not rendered.
export function pushbtnChoicesOf (it) {
    const out = [];
    for (const kw of it.keywords ?? []) {
        if (kw.name === 'PUSHBTNCHC' || kw.name === 'PSHBTNCHC') {
            out.push({
                num:    kw.args?.[0],
                label:  unquoteArg(kw.args?.[1] ?? ''),
                action: kw.args?.[2] ?? null,
            });
        }
    }
    return out;
}

export function hasPushbtnField (it) {
    return (it.keywords ?? []).some(kw =>
        kw.name === 'PUSHBTNFLD' || kw.name === 'PSHBTNFLD');
}

// `*NUMROW N` / `*NUMCOL N` directives inside SNGCHCFLD / MLTCHCFLD args.
// Zero means "no grid, stack vertically".
export function getNumRow (it) { return readNumDirective(it, 'NUMROW'); }
export function getNumCol (it) { return readNumDirective(it, 'NUMCOL'); }

function readNumDirective (it, tag) {
    const re = new RegExp(`\\*${tag}\\s+(\\d+)`, 'i');
    for (const kw of it.keywords ?? []) {
        if (kw.name !== 'SNGCHCFLD' && kw.name !== 'MLTCHCFLD') continue;
        const all = (kw.args ?? []).join(' ');
        const m   = all.match(re);
        if (m) return parseInt(m[1], 10);
    }
    return 0;
}

// CNTFLD(N) carries the wrap width for continued fields.  Returns null
// when the keyword is absent or its arg is bad.
export function cntfldWidth (it) {
    const kw = (it.keywords ?? []).find(k => k.name === 'CNTFLD');
    if (!kw) return null;
    const n = parseInt(kw.args[0], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

// Strip surrounding single-quotes per IBM convention; also unwrap a bare
// `&VAR;` reference to `<VAR>` for readable previews.
export function unquoteArg (s) {
    if (!s) return '';
    const t = s.trim();
    if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
        return t.substring(1, t.length - 1).replace(/''/g, "'");
    }
    const m = t.match(/^&([A-Z0-9_]+);?$/i);
    if (m) return `<${m[1].toUpperCase()}>`;
    return t;
}
