// CA/CF/HELP/HOME/ROLLUP/… function-key editor.  One card per existing
// AID keyword with indicator + description inputs, plus a + button.

import { sectionStart, emptyNote } from '../dom.js';
import { stripQuotes } from '../quoting.js';

const AID_RE = /^(C[AF]\d{1,2}|HELP|HOME|ROLLUP|ROLLDOWN|PAGEUP|PAGEDOWN|ALTPAGEUP|ALTPAGEDWN|ALTHELP|PRINT|CLEAR|RETKEY|MNUCNL)$/;

export function renderFunctionKeys (pane, rec, ctx) {
    const sec  = sectionStart(pane, 'Function keys');
    const aids = rec.keywords.filter(k => AID_RE.test(k.name));
    if (aids.length === 0) emptyNote(sec, 'No function keys.');

    for (const kw of aids) sec.appendChild(buildAidCard(rec, kw, ctx));

    const add = document.createElement('button');
    add.className   = 'insp-add-kw';
    add.textContent = '+ Add function key';
    add.addEventListener('click', () => {
        const name = prompt(
            'Function key name (e.g. CA03, CF12, HELP, ROLLUP):',
            'CA03');
        if (!name) return;
        rec.keywords.push({
            name: name.toUpperCase().trim(),
            args: [],
            indicators: [],
        });
        ctx.onChange?.();
    });
    sec.appendChild(add);
}

function buildAidCard (rec, kw, ctx) {
    const card = document.createElement('div');
    card.className = 'insp-kw';

    const head = document.createElement('div');
    head.className = 'insp-kw-head';

    const nameLbl = document.createElement('input');
    nameLbl.type  = 'text';
    nameLbl.value = kw.name;
    nameLbl.addEventListener('change', () => {
        kw.name = nameLbl.value.toUpperCase().slice(0, 10);
        ctx.onChange?.();
    });
    const rm = document.createElement('button');
    rm.textContent = '×';
    rm.className   = 'insp-kw-rm';
    rm.addEventListener('click', () => {
        rec.keywords.splice(rec.keywords.indexOf(kw), 1);
        ctx.onChange?.();
    });
    head.appendChild(nameLbl);
    head.appendChild(rm);
    card.appendChild(head);

    // Args row: indicator# + description in a 2-col grid.
    const grid = document.createElement('div');
    grid.style.display             = 'grid';
    grid.style.gridTemplateColumns = '60px 1fr';
    grid.style.gap                 = '4px';

    const indInp = document.createElement('input');
    indInp.type        = 'text';
    indInp.placeholder = 'ind';
    indInp.value       = kw.args[0] ?? '';
    indInp.addEventListener('change', () => {
        kw.args[0] = indInp.value.trim();
        // Drop trailing empty slots so the writer doesn't emit them.
        kw.args = kw.args.filter((v, i) => v !== '' || i > 0);
        ctx.onChange?.();
    });

    const descInp = document.createElement('input');
    descInp.type        = 'text';
    descInp.placeholder = 'description';
    descInp.value       = stripQuotes(kw.args[1] ?? '');
    descInp.addEventListener('change', () => {
        const v = descInp.value.trim();
        if (v) kw.args[1] = `'${v.replace(/'/g, "''")}'`;
        else if (kw.args.length > 1) kw.args.splice(1, kw.args.length - 1);
        ctx.onChange?.();
    });

    grid.appendChild(indInp);
    grid.appendChild(descInp);
    card.appendChild(grid);
    return card;
}
