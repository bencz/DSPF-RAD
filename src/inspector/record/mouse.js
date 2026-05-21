// Read-only summaries: mouse buttons (MOUBTN ... actions) and the
// MNUBARDSP reference.  Editing both is rare so we just show the wiring.

import { sectionStart } from '../dom.js';

const MOUSE_LABELS = {
    '*ULD': 'single click', '*ULP': 'double click',
    '*LLD': 'long press',   '*LLP': 'long double',
    '*MLD': 'middle click', '*MLP': 'middle double',
    '*RLD': 'right click',  '*RLP': 'right double',
};

export function renderMouseButtons (pane, rec) {
    const moubtns = rec.keywords.filter(k => k.name === 'MOUBTN');
    if (moubtns.length === 0) return;

    const sec = sectionStart(pane, 'Mouse buttons');
    for (const kw of moubtns) {
        const div = document.createElement('div');
        div.style.fontFamily = 'monospace';
        div.style.fontSize   = '11px';
        div.style.color      = '#c8c';
        div.style.padding    = '2px 0';
        const action = kw.args[0] ?? '?';
        const target = kw.args[1] ?? '?';
        div.textContent = `${action} (${MOUSE_LABELS[action] ?? '?'}) → ${target}`;
        sec.appendChild(div);
    }
}

export function renderMnubarDsp (pane, rec) {
    const kw = rec.keywords.find(k => k.name === 'MNUBARDSP');
    if (!kw) return;

    const sec = sectionStart(pane, 'Menu-bar reference');
    const txt = document.createElement('div');
    txt.style.fontFamily = 'monospace';
    txt.style.fontSize   = '11px';
    txt.style.color      = '#cc6';
    txt.textContent = `MNUBARDSP(${kw.args.join(' ')})`;
    sec.appendChild(txt);

    const explain = document.createElement('p');
    explain.className     = 'empty';
    explain.style.padding = '4px 0';
    explain.textContent = `Menu bar record: ${kw.args[0] || '?'}.  ` +
        `Active choice → ${kw.args[1] || '?'};  active pulldown → ${kw.args[2] || '?'}.`;
    sec.appendChild(explain);
}
