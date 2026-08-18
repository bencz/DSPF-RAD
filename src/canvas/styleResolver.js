// Shared style / text / layout resolution for the DSPF renderers.
//
// Single source of truth consumed by BOTH painting layers so they cannot
// drift apart:
//   - legacy canvas renderer (drawField.js / GridCanvas.js)
//   - React preview renderer (react-app/src/preview/*)
//
// resolveItemStyle + renderItemText were extracted verbatim from
// drawField.js (T-01).  computeLayout adds the width/height/span math the
// CSS-Grid renderer needs, including the REFFLD `effectiveLength` clamp
// the canvas draw loop used to do as a side effect.  itemSignature is the
// content-based identity used for React keys + selection remap (D-10).

import { COLOR_CSS, DEFAULT_COLOR } from '../Attributes.js';
import { flagsOf, valueOf } from '../model/keywords.js';
import { hasKeyword } from './keywordReaders.js';
import {
    datePlaceholder, timePlaceholder,
    itemWidth, itemHeight, effectiveLength,
} from './metrics.js';
import { getEntryDefaults } from './entryDefaults.js';

// Resolve flags + colour by folding in record-level entry defaults (only
// for entry usages I and B; output fields stay independent).
export function resolveItemStyle (it, parentRec, doc) {
    const isEntry  = it.usage === 'I' || it.usage === 'B';
    const defaults = isEntry
        ? getEntryDefaults(parentRec, doc)
        : { flags: [], color: null };
    const own   = flagsOf(it, 'DSPATR');
    const flags = own.length ? own : defaults.flags;
    const color = valueOf(it, 'COLOR') ?? defaults.color;

    return {
        flags, color,
        colour:   COLOR_CSS[color || DEFAULT_COLOR] || COLOR_CSS.GRN,
        isHi:     flags.includes('HI'),
        isRi:     flags.includes('RI'),
        isUl:     flags.includes('UL'),
        isNd:     flags.includes('ND'),
        isBl:     flags.includes('BL') || hasKeyword(it, 'BLINK'),
        isPr:     flags.includes('PR'),
        isHidden: it.usage === 'H',
    };
}

// Display text for a field: name padded with underscores, or a date/time
// placeholder for L/T data types.  Same output the canvas paints.
export function renderItemText (it) {
    const len = Math.max(1, it._effectiveLength ?? it.length ?? 1);
    if (it.dataType === 'L') {
        return (datePlaceholder(valueOf(it, 'DATFMT')) ?? '_'.repeat(len)).slice(0, len);
    }
    if (it.dataType === 'T') {
        return (timePlaceholder(valueOf(it, 'TIMFMT')) ?? '_'.repeat(len)).slice(0, len);
    }
    const label = (it.name || '').slice(0, len);
    if (label.length === 0)   return '_'.repeat(len);
    if (label.length === len) return label;
    return label + '_'.repeat(len - label.length);
}

// Footprint of an item in grid cells, plus the CSS-Grid span values.
// `record` and `doc` are optional so callers without them (single-item
// tests) still get natural widths.
export function computeLayout (item, record = null, doc = null) {
    let effective = null;
    if (item.kind === 'field' && record) {
        effective = effectiveLength(item, record.items, doc?.cols ?? null);
    }
    const withLen = effective != null
        ? { ...item, _effectiveLength: effective }
        : item;

    const width  = itemWidth(withLen);
    const height = itemHeight(withLen);

    const cols    = doc?.cols ?? null;
    const spanCol = cols != null
        ? Math.max(1, Math.min(width, cols - item.col + 1))
        : Math.max(1, width);
    const spanRow = Math.max(1, height);

    return { effectiveLength: effective, width, height, spanCol, spanRow };
}

// Content signature for React keys + selection remap across parses (D-10).
// Covers position, identity, usage and a keywords summary so indicator-
// conditioned siblings at the same (row, col) stay distinct.
export function itemSignature (item) {
    const kw = (item.keywords ?? [])
        .map((k) => `${k.name}(${(k.args ?? []).join(',')})${(k.indicators ?? []).join('')}`)
        .join('|');
    return [
        item.kind,
        item.row, item.col,
        item.name ?? '',
        item.text ?? '',
        item.usage ?? '',
        item.dataType ?? '',
        item.length ?? '',
        item.decimals ?? '',
        item.sysName ?? '',
        kw,
    ].join('::');
}
