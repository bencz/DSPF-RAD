// Width / height in grid cells for items.  The renderer + hit-tester
// both ask here so they agree on each item's footprint.

import { SYS_WIDTH } from './theme.js';
import {
    hasKeyword, choicesOf, mnubarChoicesOf, pushbtnChoicesOf,
    getNumRow, getNumCol, cntfldWidth,
} from './keywordReaders.js';

// Returns the rendered width, honouring a `_effectiveLength` clamp the
// renderer pre-computes on REFFLD fields that share a row with a sibling.
export function itemWidth (it) {
    if (it._effectiveLength != null && it.kind === 'field') {
        return Math.max(1, it._effectiveLength);
    }
    return naturalItemWidth(it);
}

export function itemHeight (it) {
    if (it.kind !== 'field') return 1;
    if (hasKeyword(it, 'SNGCHCFLD') || hasKeyword(it, 'MLTCHCFLD')) {
        const c = choicesOf(it);
        if (!c.length) return 1;
        const numRow = getNumRow(it);
        if (numRow > 0 && c.length > numRow) return numRow;
        const numCol = getNumCol(it);
        if (numCol > 0 && c.length > numCol) return Math.ceil(c.length / numCol);
        return c.length;
    }
    const cnt = cntfldWidth(it);
    if (cnt) return Math.max(1, Math.ceil((it.length ?? cnt) / cnt));
    return 1;
}

// REFFLD fields can come in without an explicit length.  Walk same-row
// siblings to find the next start column and clamp our width to fit;
// also bound by the grid edge.
export function effectiveLength (it, siblings, maxCol = null) {
    const natural = Math.max(1, it.length ?? 1);
    if (it.kind !== 'field' || !it._lengthInferred || !siblings) return natural;

    let bound = natural;
    let nextCol = null;
    for (const other of siblings) {
        if (other === it) continue;
        if (other.row !== it.row) continue;
        if (other.col <= it.col) continue;
        if (nextCol == null || other.col < nextCol) nextCol = other.col;
    }
    if (nextCol != null) bound = Math.min(bound, nextCol - it.col);
    if (maxCol  != null) bound = Math.min(bound, maxCol - it.col + 1);
    return Math.max(1, bound);
}

function naturalItemWidth (it) {
    if (it.kind === 'constant') return Math.max(1, (it.text ?? '').length);
    if (it.kind === 'sysvalue') {
        const name = it.sysName || 'DATE';
        return SYS_WIDTH[name] ?? Math.max(name.length, 8);
    }
    if (it.kind === 'field') {
        if (hasKeyword(it, 'SNGCHCFLD') || hasKeyword(it, 'MLTCHCFLD')) {
            return choiceFieldWidth(it);
        }
        const mb = mnubarChoicesOf(it);
        if (mb.length) return mb.reduce((s, c) => s + c.label.length + 1, 0);

        const pb = pushbtnChoicesOf(it);
        if (pb.length) {
            return Math.max(
                it.length ?? 1,
                pb.reduce((s, c) => s + c.label.length + 3, 0));
        }
        const cnt = cntfldWidth(it);
        if (cnt) return cnt;
    }
    return Math.max(1, it.length ?? 1);
}

function choiceFieldWidth (it) {
    const c = choicesOf(it);
    if (!c.length) return Math.max(1, it.length ?? 1);
    const widest = Math.max(...c.map(x => x.label.length + 2));
    const numRow = getNumRow(it);
    if (numRow > 0 && c.length > numRow) {
        const cols = Math.ceil(c.length / numRow);
        return (widest + 1) * cols;
    }
    return widest;
}

// ---- date / time placeholders --------------------------------------------

// DATFMT → display placeholder.  Fields are stored as 4-digit years; the
// format selects the runtime appearance.
export function datePlaceholder (fmt) {
    switch (String(fmt).toUpperCase()) {
        case '*ISO': case '*JIS': return 'YYYY-MM-DD';
        case '*USA':              return 'MM/DD/YYYY';
        case '*EUR':              return 'DD.MM.YYYY';
        case '*JUL':              return 'YY/DDD';
        case '*YMD':              return 'YY/MM/DD';
        case '*MDY':              return 'MM/DD/YY';
        case '*DMY':              return 'DD/MM/YY';
        case '*JOB':              return '<job-fmt>';
        default:                  return null;
    }
}

export function timePlaceholder (fmt) {
    switch (String(fmt).toUpperCase()) {
        case '*HMS': case '*ISO': case '*EUR': case '*JIS': return 'HH.MM.SS';
        case '*USA':                                          return 'HH:MM AM';
        default:                                               return null;
    }
}

// Display text for an item.  Exported for the inspector + tests.
export function itemDisplayText (it) {
    if (it.kind === 'constant') return it.text ?? '';
    if (it.kind === 'sysvalue') return (it.sysName || 'DATE');
    const len = Math.max(1, it.length ?? 1);
    const label = (it.name || '').slice(0, len);
    if (label.length === 0)   return '_'.repeat(len);
    if (label.length === len) return label;
    return label + '_'.repeat(len - label.length);
}
