// WINDOW-record helpers: parse the geometry, the border colour, the title
// placement modifiers, and compute the offset to apply to items living
// inside the window (their coords are window-relative).

import { COLOR_CSS } from '../Attributes.js';
import { RECORD_BORDER } from './theme.js';
import { unquoteArg } from './keywordReaders.js';

// Parse a WINDOW(...) record-level keyword into a placement spec.  Three
// shapes per IBM DSPF:
//   WINDOW(top left rows cols [option])           - explicit position
//   WINDOW(*DFT rows cols [option])               - runtime picks position
//   WINDOW(*REL top left rows cols [option])      - relative to caller
// Any arg may also be a `&FIELD;` reference (program supplies the value
// at runtime).  In that case we substitute a sensible placeholder and
// flag the spec so the renderer can show "var-pos" next to the chrome.
export function parseWindowSpec (record) {
    if (record.type !== 'WINDOW') return null;
    const win = record.keywords?.find(kw => kw.name === 'WINDOW');
    if (!win || !win.args?.length) return null;

    const a = win.args;
    const parse = (arg, fallback) => {
        if (typeof arg !== 'string') return { value: fallback, isVar: false };
        const t = arg.trim();
        if (/^&[A-Z0-9_]+;?$/i.test(t)) {
            return { value: fallback, isVar: true, varName: t.replace(/[&;]/g, '') };
        }
        const n = parseInt(t, 10);
        return Number.isFinite(n)
            ? { value: n, isVar: false }
            : { value: fallback, isVar: false, invalid: true };
    };

    let topR, leftR, rowsR, colsR;
    let isAutoPos = false;

    if (a[0] === '*DFT') {
        rowsR = parse(a[1], 10);
        colsR = parse(a[2], 40);
        topR  = { value: 4, isVar: false };
        leftR = { value: 8, isVar: false };
        isAutoPos = true;
    } else if (a[0] === '*REL') {
        topR  = parse(a[1], 4);
        leftR = parse(a[2], 8);
        rowsR = parse(a[3], 10);
        colsR = parse(a[4], 40);
    } else {
        topR  = parse(a[0], 4);
        leftR = parse(a[1], 8);
        rowsR = parse(a[2], 10);
        colsR = parse(a[3], 40);
    }

    // Any `&var;` flips us into auto-position mode so the designer knows
    // the preview is just a guess.
    const hasVar = [topR, leftR, rowsR, colsR].some(r => r.isVar);
    if (hasVar) isAutoPos = true;

    return {
        top:  topR.value,
        left: leftR.value,
        rows: rowsR.value,
        cols: colsR.value,
        isAutoPos,
        hasVar,
        varNames: {
            top:  topR.varName  ?? null,
            left: leftR.varName ?? null,
            rows: rowsR.varName ?? null,
            cols: colsR.varName ?? null,
        },
    };
}

// Offset applied to items inside a WINDOW record at draw time.  Returns
// null for non-window records.
export function recordOffset (record) {
    const spec = parseWindowSpec(record);
    if (!spec) return null;
    return { rowOffset: spec.top - 1, colOffset: spec.left - 1 };
}

// WDWBORDER(*COLOR XXX) → CSS colour.  Falls back to the default purple.
export function getWindowBorderColor (record) {
    const kw = record.keywords?.find(k => k.name === 'WDWBORDER');
    if (!kw) return RECORD_BORDER.WINDOW;
    const all = (kw.args ?? []).join(' ');
    const m = all.match(/\*COLOR\s+([A-Z]+)/i);
    if (m) {
        const c = m[1].toUpperCase();
        return COLOR_CSS[c] ?? RECORD_BORDER.WINDOW;
    }
    return RECORD_BORDER.WINDOW;
}

// WDWTITLE placement modifiers: vertical (`*TOP` / `*BOTTOM`) and
// horizontal (`*LEFT` / `*CENTER` / `*RIGHT`), any order.  IBM defaults:
// TOP + CENTER.
export function getWindowTitlePos (titleKw) {
    let vertical   = 'top';
    let horizontal = 'center';
    for (const arg of (titleKw.args ?? []).slice(1)) {
        const t = String(arg).toUpperCase();
        if      (t === '*BOTTOM') vertical   = 'bottom';
        else if (t === '*TOP')    vertical   = 'top';
        else if (t === '*LEFT')   horizontal = 'left';
        else if (t === '*CENTER') horizontal = 'center';
        else if (t === '*RIGHT')  horizontal = 'right';
    }
    return { vertical, horizontal };
}

// WDWTITLE's text arg can be a literal, a `&FIELD;` ref, or wrapped in
// `(*TEXT ...)`.  Returns a friendly preview string.
export function extractTitleText (raw) {
    if (!raw) return '';
    let t = String(raw).trim();
    if (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1).trim();
    if (t.startsWith('*TEXT')) t = t.slice(5).trim();
    if (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1).trim();
    const m = t.match(/^&([A-Z0-9_]+);?$/);
    if (m) return `<${m[1]}>`;
    return unquoteArg(t);
}
