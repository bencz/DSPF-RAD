// Catch-all keyword editor for anything no dedicated section covers,
// plus the Items list with sort + "Hide cond" collapse.

import { sectionStart, emptyNote } from '../dom.js';
import { renderKeywordCard, renderAddKeywordButton } from '../KeywordCard.js';

export function renderKeywordsCatchAll (pane, rec, ctx) {
    const sec = sectionStart(pane, 'Keywords');
    if (rec.keywords.length === 0) emptyNote(sec, 'No record-level keywords.');
    for (const kw of rec.keywords) {
        sec.appendChild(renderKeywordCard(rec, kw, ctx.onChange));
    }
    sec.appendChild(renderAddKeywordButton(rec, ctx.onChange));
}

// Item list — useful for hidden fields and for big records like CLOCK
// where conditioned figlet items dominate.  Sort fields/sysvalues/widgets
// above constants, tag each row with kind + indicator badge, and collapse
// conditioned items to a single "+N conditioned" entry when the global
// "Hide cond" toggle is on.
export function renderItemList (pane, rec, ctx) {
    const sec = sectionStart(pane, 'Items');
    if (rec.items.length === 0) {
        emptyNote(sec, 'No items in this record.');
        return;
    }

    const hideCnd = !!ctx.document.hideConditioned;
    const sorted = rec.items.slice().sort(itemListOrder);
    const visible = hideCnd ? sorted.filter(it => !it.indicators?.length) : sorted;
    const hidden  = hideCnd ? sorted.filter(it => !!it.indicators?.length) : [];

    if (hidden.length) {
        const note = document.createElement('p');
        note.className     = 'empty';
        note.style.padding = '4px 0';
        note.textContent = `+ ${hidden.length} conditioned item${hidden.length === 1 ? '' : 's'} ` +
            `hidden (toggle "Hide cond" off to list).`;
        sec.appendChild(note);
    }

    const list = document.createElement('div');
    list.className = 'insp-itemlist';
    for (const it of visible) list.appendChild(buildItemRow(it, ctx));
    sec.appendChild(list);
}

function itemListOrder (a, b) {
    const ac = !!a.indicators?.length;
    const bc = !!b.indicators?.length;
    if (ac !== bc) return ac ? 1 : -1;                  // unconditioned first
    const kindWeight = (it) =>
        it.kind === 'field'    ? 0 :
        it.kind === 'sysvalue' ? 1 : 2;
    if (kindWeight(a) !== kindWeight(b)) return kindWeight(a) - kindWeight(b);
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
}

function buildItemRow (it, ctx) {
    const row  = document.createElement('button');
    row.className = 'insp-itemrow';
    row.type      = 'button';

    const tag = document.createElement('span');
    const tagClass = pickTagClass(it);
    tag.className = 'insp-itemrow-tag ' + tagClass;
    tag.textContent = pickTagLetter(it);
    row.appendChild(tag);

    const label = document.createElement('span');
    label.className = 'insp-itemrow-label';
    label.textContent =
        it.kind === 'constant' ? `"${(it.text || '').slice(0, 20)}"` :
        it.kind === 'sysvalue' ? `<${it.sysName || '?'}>` :
        (it.name || '(unnamed)');
    row.appendChild(label);

    const pos = document.createElement('span');
    pos.className = 'insp-itemrow-pos';
    const indMark = it.indicators?.length ? ` [${it.indicators.join(',')}]` : '';
    pos.textContent = `${it.row},${it.col}${indMark}`;
    row.appendChild(pos);

    row.addEventListener('click', () => {
        ctx.setTab?.('item');
        ctx.onSelectItem?.(it.id);
    });
    return row;
}

function pickTagClass (it) {
    if (it.kind === 'constant') return 'tag-constant';
    if (it.kind === 'sysvalue') return 'tag-sysvalue';
    if (it.usage === 'H' || it.usage === 'P') return 'tag-hidden';
    return 'tag-field';
}

function pickTagLetter (it) {
    if (it.kind === 'constant') return 'C';
    if (it.kind === 'sysvalue') return 'S';
    if (it.usage === 'H')       return 'H';
    if (it.usage === 'P')       return 'P';
    return 'F';
}
