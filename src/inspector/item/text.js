// Convenience sections for the three "single text-arg" keywords on
// items: TEXT (description), DFTVAL (default), EDTWRD (edit pattern,
// fields only).

import { section, row } from '../dom.js';
import { stripQuotes, quote, removeKeyword } from '../quoting.js';

export function renderTextDesc (pane, item, ctx) {
    const kw  = item.keywords.find(k => k.name === 'TEXT');
    const inp = makeInput(stripQuotes(kw?.args?.[0] ?? ''),
        "field description (TEXT('...'))");
    inp.addEventListener('change', () => {
        const v = inp.value.trim();
        removeKeyword(item, 'TEXT');
        if (v) item.keywords.push({ name: 'TEXT', args: [quote(v)], indicators: [] });
        ctx.onChange?.();
    });
    section(pane, 'Description (TEXT)', [row('Text', inp)]);
}

export function renderDftVal (pane, item, ctx) {
    const kw  = item.keywords.find(k => k.name === 'DFTVAL');
    const inp = makeInput(stripQuotes(kw?.args?.[0] ?? ''),
        'default display value');
    inp.addEventListener('change', () => {
        // DFTVAL preserves whitespace-only values — IBM allows '   ' as a
        // valid default — so we only skip when the raw input is empty.
        const v = inp.value;
        removeKeyword(item, 'DFTVAL');
        if (v !== '') {
            item.keywords.push({ name: 'DFTVAL', args: [quote(v)], indicators: [] });
        }
        ctx.onChange?.();
    });
    section(pane, 'Default value (DFTVAL)', [row('Value', inp)]);
}

export function renderEditWord (pane, item, ctx) {
    if (item.kind !== 'field') return;
    const kw  = item.keywords.find(k => k.name === 'EDTWRD');
    const inp = makeInput(stripQuotes(kw?.args?.[0] ?? ''),
        "e.g.  '  /  /  '  for date");
    inp.title = 'Edit word pattern (EDTWRD)';
    inp.addEventListener('change', () => {
        const v = inp.value;
        removeKeyword(item, 'EDTWRD');
        if (v !== '') {
            item.keywords.push({ name: 'EDTWRD', args: [quote(v)], indicators: [] });
        }
        ctx.onChange?.();
    });
    section(pane, 'Edit word (EDTWRD)', [row('Pattern', inp)]);
}

function makeInput (value, placeholder) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value;
    inp.placeholder = placeholder;
    return inp;
}
