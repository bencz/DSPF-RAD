// REFFLD editor — only shown when the item carries a REFFLD keyword.
// Two-line layout: a single text input with whichever shape the REFFLD
// arg uses (<field> <file> | <lib>/<file>/<field>).

import { sectionStart, row, emptyNote } from '../dom.js';

export function renderRefFld (pane, item, ctx) {
    const sec = sectionStart(pane, 'Referenced field (REFFLD)');
    const kw  = item.keywords.find(k => k.name === 'REFFLD');
    if (!kw) {
        emptyNote(sec, 'No REFFLD keyword on this field.');
        return;
    }

    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.value       = kw.args.join(' ');
    inp.placeholder = '<field> <file>  or  <lib>/<file>/<field>';
    inp.title       = 'IBM REFFLD: which PF/LF + field this entry inherits from';
    inp.addEventListener('change', () => {
        kw.args = inp.value.trim().split(/\s+/).filter(Boolean);
        ctx.onChange?.();
    });
    sec.appendChild(row('REFFLD', inp));
}
