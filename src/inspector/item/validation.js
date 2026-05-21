// Input-validation family for fields: VALUES / RANGE / COMP / CMP as
// free-form text rows, plus CHECK chips for the single-letter flags.

import { sectionStart, row } from '../dom.js';
import { removeKeyword } from '../quoting.js';

export function renderValidation (pane, item, ctx) {
    if (item.kind !== 'field') return;
    const sec = sectionStart(pane, 'Validation');
    addFreeFormRow(sec, item, ctx, 'VALUES', "'A' 'B' 'C'");
    addFreeFormRow(sec, item, ctx, 'RANGE',  '1 99');
    addFreeFormRow(sec, item, ctx, 'COMP',   'GT 0');
    addFreeFormRow(sec, item, ctx, 'CMP',    'EQ 5');
}

export function renderCheck (pane, item, ctx) {
    if (item.kind !== 'field') return;
    const sec  = sectionStart(pane, 'Input checks (CHECK)');
    let   kw   = item.keywords.find(k => k.name === 'CHECK');
    const cur  = new Set((kw?.args ?? []).map(a => String(a).toUpperCase()));

    const flags = [
        ['LC',  'to lowercase'],
        ['ME',  'mandatory entry'],
        ['MF',  'mandatory fill'],
        ['M10', 'mod-10'],
        ['M11', 'mod-11'],
        ['RB',  'right-blank'],
        ['RZ',  'right-zero'],
        ['AB',  'no-blanks alpha'],
        ['VN',  'valid name'],
    ];

    const chips = document.createElement('div');
    chips.className = 'insp-chips';
    for (const [f, tip] of flags) {
        const chip = document.createElement('span');
        chip.className = 'insp-chip' + (cur.has(f) ? ' on' : '');
        chip.textContent = f;
        chip.title = tip;
        chip.addEventListener('click', () => {
            if (!kw) {
                kw = { name: 'CHECK', args: [], indicators: [] };
                item.keywords.push(kw);
            }
            const i = kw.args.findIndex(a => String(a).toUpperCase() === f);
            if (i >= 0) kw.args.splice(i, 1);
            else        kw.args.push(f);
            if (kw.args.length === 0) removeKeyword(item, 'CHECK');
            ctx.onChange?.();
        });
        chips.appendChild(chip);
    }
    sec.appendChild(chips);
}

function addFreeFormRow (sec, item, ctx, name, placeholder) {
    const kw  = item.keywords.find(k => k.name === name);
    const inp = document.createElement('input');
    inp.type  = 'text';
    inp.value = (kw?.args ?? []).join(' ');
    inp.placeholder = placeholder;
    inp.addEventListener('change', () => {
        const args = inp.value.trim().split(/\s+/).filter(Boolean);
        removeKeyword(item, name);
        if (args.length) item.keywords.push({ name, args, indicators: [] });
        ctx.onChange?.();
    });
    sec.appendChild(row(name, inp));
}
