// Reusable keyword editor card — the "Other keywords" rows on the Item
// tab and the catch-all keyword list on the Record tab both use this.

import { addKeyword, removeWhere } from '../model/keywords.js';
import { indicatorsInput } from './chips.js';

export function renderKeywordCard (target, kw, onChange) {
    const card = document.createElement('div');
    card.className = 'insp-kw';

    card.appendChild(buildHead(target, kw, onChange));
    card.appendChild(buildArgs(kw, onChange));

    const ind = indicatorsInput(kw.indicators, arr => {
        kw.indicators = arr;
        onChange?.();
    });
    ind.classList.add('insp-kw-ind');
    card.appendChild(ind);

    return card;
}

export function renderAddKeywordButton (target, onChange) {
    const btn = document.createElement('button');
    btn.className = 'insp-add-kw';
    btn.textContent = '+ Add keyword';
    btn.addEventListener('click', () => {
        const name = prompt('Keyword name (e.g. OVERLAY, REFFLD, SFLPAG):', '');
        if (!name) return;
        addKeyword(target, { name: name.toUpperCase().trim(), args: [], indicators: [] });
        onChange?.();
    });
    return btn;
}

function buildHead (target, kw, onChange) {
    const head = document.createElement('div');
    head.className = 'insp-kw-head';

    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.value = kw.name;
    nameInp.placeholder = 'NAME';
    nameInp.title = 'Keyword name';
    nameInp.addEventListener('change', () => {
        kw.name = nameInp.value.toUpperCase().slice(0, 10);
        onChange?.();
    });
    head.appendChild(nameInp);

    const rm = document.createElement('button');
    rm.textContent = '×';
    rm.className = 'insp-kw-rm';
    rm.title = 'Remove keyword';
    rm.addEventListener('click', () => {
        removeWhere(target, k => k === kw);
        onChange?.();
    });
    head.appendChild(rm);
    return head;
}

function buildArgs (kw, onChange) {
    const argsInp = document.createElement('input');
    argsInp.type = 'text';
    argsInp.value = kw.args.join(' ');
    argsInp.placeholder = 'args';
    argsInp.title = 'Keyword arguments (space-separated)';
    argsInp.addEventListener('change', () => {
        kw.args = argsInp.value.trim().split(/\s+/).filter(Boolean);
        onChange?.();
    });
    return argsInp;
}
