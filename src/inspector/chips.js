// Reusable chip widgets: presence chips (toggle whether a bare keyword is
// on the target) and indicator inputs (text field that round-trips the
// canonical token list).

import { parseIndicatorTokens, formatIndicatorTokens } from '../model/keywords.js';

// One chip per name in `names`.  Clicking adds/removes a bare keyword on
// target.  Optional `titles` map provides per-chip tooltips.
export function renderPresenceChips (sec, target, names, titles = {}, onChange) {
    const chips = document.createElement('div');
    chips.className = 'insp-chips';
    for (const name of names) {
        const on = target.keywords.some(k => k.name === name);
        const chip = document.createElement('span');
        chip.className = 'insp-chip' + (on ? ' on' : '');
        chip.textContent = name;
        if (titles[name]) chip.title = titles[name];
        chip.addEventListener('click', () => {
            const idx = target.keywords.findIndex(k => k.name === name);
            if (idx >= 0) target.keywords.splice(idx, 1);
            else          target.keywords.push({ name, args: [], indicators: [] });
            onChange?.();
        });
        chips.appendChild(chip);
    }
    sec.appendChild(chips);
}

// Free-form text input parsing/formatting indicator tokens ('33 N34').
export function indicatorsInput (currentArr, onChange) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = formatIndicatorTokens(currentArr);
    inp.placeholder = 'e.g. 33 N34';
    inp.title = 'Indicators — examples: "33" (when 33 on), "N80" (when 80 off), "33 N34" (both)';
    inp.className = 'insp-ind';
    inp.addEventListener('change', () => onChange(parseIndicatorTokens(inp.value)));
    return inp;
}
