// Record name + type dropdown.  Type changes (RECORD ↔ SFL ↔ WINDOW …)
// don't move keywords around — the renderer + writer branch on type.

import { RECORD_TYPES } from '../../model/constants.js';
import { section, row } from '../dom.js';

export function renderRecordIdentity (pane, rec, ctx) {
    const nameInp = document.createElement('input');
    nameInp.type      = 'text';
    nameInp.value     = rec.name;
    nameInp.maxLength = 10;
    nameInp.addEventListener('change', () =>
        ctx.onRecordPatch({ name: nameInp.value }));

    const typeSel = document.createElement('select');
    for (const [k, info] of Object.entries(RECORD_TYPES)) {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = info.label;
        typeSel.appendChild(opt);
    }
    typeSel.value = rec.type;
    typeSel.addEventListener('change', () =>
        ctx.onRecordPatch({ type: typeSel.value }));

    section(pane, 'Identity', [
        row('Name', nameInp),
        row('Type', typeSel),
    ]);
}

export function renderRecordStats (pane, rec) {
    const stats = document.createElement('div');
    stats.className = 'insp-section';
    const h = document.createElement('h4');
    h.textContent = 'Stats';
    stats.appendChild(h);

    const line = document.createElement('div');
    line.style.color      = '#888';
    line.style.fontSize   = '11px';
    line.style.fontFamily = 'monospace';
    const itemsTxt = `${rec.items.length} item${rec.items.length === 1 ? '' : 's'}`;
    const kwsTxt   = `${rec.keywords.length} keyword${rec.keywords.length === 1 ? '' : 's'}`;
    line.textContent = `${itemsTxt} · ${kwsTxt}`;
    stats.appendChild(line);
    pane.appendChild(stats);
}
