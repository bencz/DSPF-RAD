// Helpers around the canonical keywords[] list that lives on every item
// and record.  A keyword is { name, args:[...], indicators:[...] }.
//
// Indicators are raw tokens.  '33' means "indicator 33 ON", 'N34' means
// "indicator 34 OFF".  Real DSPF source lets up to 5 per keyword; we don't
// enforce that here because the parser can drop overflow when needed.

export function normalize (kw) {
    return {
        name: kw.name,
        args: Array.isArray(kw.args)
            ? kw.args.slice()
            : (kw.args != null ? [String(kw.args)] : []),
        indicators: Array.isArray(kw.indicators) ? kw.indicators.slice() : [],
    };
}

export function ensureList (target) {
    if (!Array.isArray(target.keywords)) target.keywords = [];
    return target.keywords;
}

/** All args of every `name` keyword (deduped, in source order).  Real
 *  DSPF allows packing multiple flags into a single keyword like
 *  `DSPATR(HI UL)` as well as repeating `DSPATR(HI)` `DSPATR(UL)` on
 *  consecutive lines - both forms produce the same set here. */
export function flagsOf (target, name) {
    const out = [];
    for (const kw of target.keywords ?? []) {
        if (kw.name !== name) continue;
        for (const flag of kw.args ?? []) {
            if (flag != null && !out.includes(flag)) out.push(flag);
        }
    }
    return out;
}

/** Last `name` keyword's first arg.  For singleton keywords like COLOR,
 *  EDTCDE.  Returns null when absent.  Indicators are ignored - the
 *  runtime evaluates them; design-time treats "last wins". */
export function valueOf (target, name) {
    const list = target.keywords ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].name === name) return list[i].args[0] ?? null;
    }
    return null;
}

export function hasKeyword (target, name) {
    return (target.keywords ?? []).some(kw => kw.name === name);
}

export function findKeyword (target, predicate) {
    return (target.keywords ?? []).find(predicate);
}

export function addKeyword (target, kw) {
    ensureList(target).push(normalize(kw));
}

export function removeWhere (target, predicate) {
    const list = target.keywords;
    if (!list) return;
    for (let i = list.length - 1; i >= 0; i--) {
        if (predicate(list[i], i)) list.splice(i, 1);
    }
}

/** Toggle a flag keyword like DSPATR(HI).  Handles three layouts:
 *    1. Standalone `DSPATR(HI)` keyword - removed wholesale when off.
 *    2. Packed `DSPATR(HI UL)` keyword - just removes the matching arg
 *       and leaves any siblings (keyword deleted if it becomes empty).
 *    3. Indicator-conditioned entries (`+33 DSPATR(HI)`) - left alone so
 *       toggling here doesn't silently delete user conditioning.
 *  When enabling, we don't add a duplicate if any unconditional keyword
 *  already carries the flag (whether standalone or packed). */
export function setFlag (target, name, flag, enabled) {
    const list = ensureList(target);
    if (enabled) {
        const exists = list.some(kw =>
            kw.name === name &&
            (kw.indicators?.length ?? 0) === 0 &&
            (kw.args ?? []).includes(flag));
        if (!exists) list.push(normalize({ name, args: [flag] }));
        return;
    }
    for (let i = list.length - 1; i >= 0; i--) {
        const kw = list[i];
        if (kw.name !== name) continue;
        if ((kw.indicators?.length ?? 0) !== 0) continue;
        const idx = kw.args.indexOf(flag);
        if (idx < 0) continue;
        kw.args.splice(idx, 1);
        if (kw.args.length === 0) list.splice(i, 1);
    }
}

/** Replace the singleton value of `name`.  Removes every existing
 *  unconditional entry, then appends one when value is non-empty. */
export function setSingle (target, name, value) {
    const list = ensureList(target);
    for (let i = list.length - 1; i >= 0; i--) {
        const kw = list[i];
        if (kw.name === name && (kw.indicators?.length ?? 0) === 0) {
            list.splice(i, 1);
        }
    }
    if (value != null && value !== '') {
        list.push(normalize({ name, args: [String(value)] }));
    }
}

/** Build a keywords[] from the legacy paleta shortcut spec
 *  ({dspatr:[…], color, edtcde}).  Used by the drop handler and demo. */
export function keywordsFromShortcuts (s) {
    const out = [];
    for (const f of s.dspatr ?? []) out.push(normalize({ name: 'DSPATR', args: [f] }));
    if (s.color)  out.push(normalize({ name: 'COLOR',  args: [s.color] }));
    if (s.edtcde) out.push(normalize({ name: 'EDTCDE', args: [s.edtcde] }));
    return out;
}

/** Parse a user-typed indicator string ("33 N34", "+33 -34", "33,34")
 *  into the canonical token list ['33', 'N34', '34']. */
export function parseIndicatorTokens (s) {
    if (!s) return [];
    return s.toUpperCase().split(/[\s,]+/).filter(Boolean).map(tok => {
        if (tok.startsWith('+')) return tok.slice(1);
        if (tok.startsWith('-')) return 'N' + tok.slice(1);
        return tok;
    });
}

export function formatIndicatorTokens (arr) {
    return (arr ?? []).join(' ');
}

/** Human-readable rendering of one keyword: "DSPATR(RI)", "OVERLAY". */
export function kwString (kw) {
    if (!kw.args || kw.args.length === 0) return kw.name;
    return `${kw.name}(${kw.args.join(' ')})`;
}
