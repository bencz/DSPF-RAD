// Item-level indicators row, the "Other keywords" catch-all card list,
// and the Delete action.  These three are the always-present bottom
// sections of the Item tab.

import { sectionStart, emptyNote, row } from '../dom.js';
import { indicatorsInput } from '../chips.js';
import { renderKeywordCard, renderAddKeywordButton } from '../KeywordCard.js';

const ITEM_PRIMARY_KW = new Set(['DSPATR', 'COLOR', 'EDTCDE']);

export function renderConditioning (pane, item, ctx) {
    const sec = sectionStart(pane, 'Conditioning');
    sec.appendChild(row('Indicators',
        indicatorsInput(item.indicators, arr => {
            item.indicators = arr;
            ctx.onChange?.();
        })));
}

export function renderOtherKeywords (pane, item, ctx) {
    const sec = sectionStart(pane, 'Other keywords');
    const others = item.keywords.filter(kw => !ITEM_PRIMARY_KW.has(kw.name));
    if (others.length === 0) emptyNote(sec, 'No other keywords.');
    for (const kw of others) {
        sec.appendChild(renderKeywordCard(item, kw, ctx.onChange));
    }
    sec.appendChild(renderAddKeywordButton(item, ctx.onChange));
}

export function renderItemActions (pane, item, ctx) {
    const actions = document.createElement('div');
    actions.className = 'insp-actions';
    const del = document.createElement('button');
    del.className   = 'danger';
    del.textContent = 'Delete';
    del.title       = 'Remove this item (Del / Backspace)';
    del.addEventListener('click', () => ctx.onItemDelete(item.id));
    actions.appendChild(del);
    pane.appendChild(actions);
}
