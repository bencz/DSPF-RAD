// Help-panel references.  Title + area (HLPTITLE + HLPARA) are
// editable; the rest are listed read-only.

import { sectionStart, row } from '../dom.js';
import { stripQuotes, quote, removeKeyword } from '../quoting.js';

const HLP_NAMES = [
    'HELP','HLPPNLGRP','HLPRCD','HLPARA','HLPID','HLPDOC',
    'HLPTITLE','HLPSCHIDX','HLPSEQ','HLPFULL','HLPCMDKEY',
];

export function renderHelp (pane, rec, ctx) {
    const present = rec.keywords.filter(k => HLP_NAMES.includes(k.name));
    if (!present.length) return;

    const sec = sectionStart(pane, 'Help references');
    renderHlpTitle(sec, rec, ctx);
    renderHlpArea(sec, rec, ctx);
    renderRemainingReadOnly(sec, present);
}

function renderHlpTitle (sec, rec, ctx) {
    const titleKw = rec.keywords.find(k => k.name === 'HLPTITLE');
    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.placeholder = 'help panel title';
    inp.value       = stripQuotes(titleKw?.args?.[0] ?? '');
    inp.addEventListener('change', () => {
        removeKeyword(rec, 'HLPTITLE');
        const v = inp.value.trim();
        if (v) {
            rec.keywords.push({
                name: 'HLPTITLE', args: [quote(v)], indicators: [],
            });
        }
        ctx.onChange?.();
    });
    sec.appendChild(row('HLPTITLE', inp));
}

function renderHlpArea (sec, rec, ctx) {
    const haKw   = rec.keywords.find(k => k.name === 'HLPARA');
    const haArgs = haKw?.args ?? [];

    const grid = document.createElement('div');
    grid.style.display              = 'grid';
    grid.style.gridTemplateColumns  = 'repeat(4, 1fr)';
    grid.style.gap                  = '4px';
    const inputs = [];
    const placeholders = ['r','c','rows','cols'];

    for (let i = 0; i < 4; i++) {
        const inp = document.createElement('input');
        inp.type        = 'number';
        inp.min         = 1;
        inp.placeholder = placeholders[i];
        inp.value       = haArgs[i] ?? '';
        inp.addEventListener('change', () => {
            const vals = inputs.map(x => x.value.trim()).filter(Boolean);
            removeKeyword(rec, 'HLPARA');
            if (vals.length) {
                rec.keywords.push({ name: 'HLPARA', args: vals, indicators: [] });
            }
            ctx.onChange?.();
        });
        inputs.push(inp);
        grid.appendChild(inp);
    }
    sec.appendChild(row('HLPARA', grid));
}

function renderRemainingReadOnly (sec, present) {
    const other = present.filter(k => k.name !== 'HLPTITLE' && k.name !== 'HLPARA');
    if (!other.length) return;

    const list = document.createElement('div');
    list.style.marginTop = '4px';
    for (const kw of other) {
        const div = document.createElement('div');
        div.style.fontFamily = 'monospace';
        div.style.fontSize   = '11px';
        div.style.color      = '#9cc';
        div.style.padding    = '1px 0';
        div.textContent = `${kw.name}(${kw.args.join(' ')})`;
        list.appendChild(div);
    }
    sec.appendChild(list);
}
