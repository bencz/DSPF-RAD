// Choice / push-button / menu-bar entry editor.  Renders one card per
// CHOICE / PSHBTNCHC / MNUBARCHC keyword on the field, with the right
// arg layout for each kind.

import { sectionStart, emptyNote } from '../dom.js';
import { stripQuotes, quote } from '../quoting.js';

const KINDS = {
    CHOICE:    { containers: ['SNGCHCFLD','MLTCHCFLD'], label: 'Choice list',     labelIdx: 1 },
    PSHBTNCHC: { containers: ['PSHBTNFLD','PUSHBTNFLD'], label: 'Push-button list', labelIdx: 1 },
    MNUBARCHC: { containers: [],                          label: 'Menu-bar choices', labelIdx: 2 },
};

export function renderChoiceList (pane, item, ctx) {
    if (item.kind !== 'field') return;

    const activeKind = detectActiveKind(item);
    if (!activeKind) return;
    const info = KINDS[activeKind];

    const sec = sectionStart(pane, info.label);
    renderContainerHeader(sec, item, info);
    renderChcExtras(sec, item);

    const entries = item.keywords.filter(k => k.name === activeKind);
    if (entries.length === 0) emptyNote(sec, `No ${activeKind} entries.`);
    for (const kw of entries) {
        sec.appendChild(renderEntryCard(item, kw, activeKind, info, ctx));
    }
    sec.appendChild(renderAddButton(item, activeKind, entries.length, ctx));
}

// Which CHOICE family applies based on the container keyword the item
// carries, or on the entries already present.
function detectActiveKind (item) {
    for (const [chcName, info] of Object.entries(KINDS)) {
        const hasContainer = info.containers.some(n =>
            item.keywords.some(k => k.name === n));
        const hasEntries = item.keywords.some(k => k.name === chcName);
        if (hasContainer || hasEntries) return chcName;
    }
    return null;
}

// Surface the container-level flags (*AUTOENT, *NOSLTIND, *NUMROW N,
// *NUMCOL N) so the user sees what's active without diving into "Other
// keywords".
function renderContainerHeader (sec, item, info) {
    const kw = item.keywords.find(k => info.containers.includes(k.name));
    if (!kw) return;
    const div = document.createElement('div');
    div.style.fontSize    = '11px';
    div.style.fontFamily  = 'monospace';
    div.style.color       = '#9cc';
    div.style.marginBottom = '4px';
    div.textContent = kw.name + (kw.args.length
        ? `(${kw.args.join(' ')})` : '');
    sec.appendChild(div);
}

// CHCAVAIL / CHCSLT / CHCUNAVAIL summary — they live on the field,
// parallel to CHOICE entries.
function renderChcExtras (sec, item) {
    const extras = item.keywords.filter(k =>
        k.name === 'CHCAVAIL' || k.name === 'CHCSLT' || k.name === 'CHCUNAVAIL');
    if (!extras.length) return;
    const ex = document.createElement('div');
    ex.style.fontSize    = '10px';
    ex.style.color       = '#888';
    ex.style.padding     = '2px 0 6px';
    ex.style.fontFamily  = 'monospace';
    ex.textContent = '+ ' + extras
        .map(k => `${k.name}(${k.args.join(' ')})`).join(', ');
    sec.appendChild(ex);
}

function renderEntryCard (item, kw, activeKind, info, ctx) {
    const card = document.createElement('div');
    card.className = 'insp-kw';

    const head    = document.createElement('div');
    head.className = 'insp-kw-head';

    const numInp = document.createElement('input');
    numInp.type  = 'text';
    numInp.value = kw.args[0] ?? '';
    numInp.style.maxWidth = '50px';
    numInp.title = 'Choice number';
    numInp.addEventListener('change', () => {
        kw.args[0] = numInp.value.trim();
        ctx.onChange?.();
    });

    const labelInp = document.createElement('input');
    labelInp.type        = 'text';
    labelInp.placeholder = 'label (text or &VAR;)';
    labelInp.value       = stripQuotes(kw.args[info.labelIdx] ?? '');
    labelInp.addEventListener('change', () => {
        const v = labelInp.value.trim();
        if (!v) return;
        kw.args[info.labelIdx] = v.startsWith('&') ? v : quote(v);
        ctx.onChange?.();
    });

    const rm = document.createElement('button');
    rm.textContent = '×';
    rm.className   = 'insp-kw-rm';
    rm.addEventListener('click', () => {
        item.keywords.splice(item.keywords.indexOf(kw), 1);
        ctx.onChange?.();
    });

    head.appendChild(numInp);
    head.appendChild(labelInp);
    head.appendChild(rm);
    card.appendChild(head);

    // MNUBARCHC: args[1] is the linked PULLDOWN record name.
    if (activeKind === 'MNUBARCHC') {
        const recInp = document.createElement('input');
        recInp.type        = 'text';
        recInp.placeholder = 'linked PULLDOWN record';
        recInp.value       = kw.args[1] ?? '';
        recInp.addEventListener('change', () => {
            kw.args[1] = recInp.value.trim();
            ctx.onChange?.();
        });
        card.appendChild(recInp);
    }

    // PSHBTNCHC: args[2] is the optional AID alias (CF12, ENTER, …).
    if (activeKind === 'PSHBTNCHC') {
        const actInp = document.createElement('input');
        actInp.type        = 'text';
        actInp.placeholder = 'action (e.g. CF12, ENTER) optional';
        actInp.value       = kw.args[2] ?? '';
        actInp.addEventListener('change', () => {
            const v = actInp.value.trim();
            if (v)                       kw.args[2] = v;
            else if (kw.args.length > 2) kw.args.splice(2);
            ctx.onChange?.();
        });
        card.appendChild(actInp);
    }
    return card;
}

function renderAddButton (item, activeKind, count, ctx) {
    const btn = document.createElement('button');
    btn.className   = 'insp-add-kw';
    btn.textContent = `+ Add ${activeKind}`;
    btn.addEventListener('click', () => {
        const next   = String(count + 1);
        const newKw  = activeKind === 'MNUBARCHC'
            ? { name: activeKind, args: [next, '', quote('Choice ' + next)], indicators: [] }
            : { name: activeKind, args: [next,     quote('Choice ' + next)], indicators: [] };
        item.keywords.push(newKw);
        ctx.onChange?.();
    });
    return btn;
}
