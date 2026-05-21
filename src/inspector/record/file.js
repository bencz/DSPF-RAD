// File-level sections — only rendered on records[0] since DSPF puts
// doc-level keywords there after parse.  Two groupings: presence chips
// for boolean toggles (PRINT/ERRSFL/...), plus a misc section for
// MSGLOC / DSPMOD / SETOF / etc.

import { sectionStart, row } from '../dom.js';
import { renderPresenceChips } from '../chips.js';
import { removeKeyword } from '../quoting.js';

const FILE_OPTION_NAMES = [
    'PRINT','ERRSFL','INDARA','MOUBTN','VLDCMDKEY','MAXDEV',
    'USRRSTDSP','NORSTCSR','REF',
];

const FILE_OPTION_TIPS = {
    INDARA: 'Indicators live in a separate data structure (the program ' +
            'reads/writes them directly).  When set, the runtime DOES NOT ' +
            'use response indicators — the design-time preview still shows ' +
            'conditioned items, but at runtime visibility is controlled in code.',
};

const FILE_MISC_INTERESTING = ['MSGLOC','DSPMOD','SETOF','MAXDEV','UBUFFER'];

export function renderFileOptions (pane, rec, ctx) {
    const sec = sectionStart(pane, 'File-level options');
    renderPresenceChips(sec, rec, FILE_OPTION_NAMES, FILE_OPTION_TIPS, ctx.onChange);

    if (rec.keywords.some(k => k.name === 'INDARA')) {
        const warn = document.createElement('p');
        warn.style.fontSize   = '10px';
        warn.style.color      = '#cc6';
        warn.style.padding    = '4px 0';
        warn.style.fontStyle  = 'italic';
        warn.textContent = '⚠ INDARA on: indicators are program-controlled.  ' +
            'Conditioned items still preview but runtime visibility depends on ' +
            'data structure values.';
        sec.appendChild(warn);
    }

    // DSPSIZ summary (read-only).
    const dsp = rec.keywords.find(k => k.name === 'DSPSIZ');
    if (dsp) {
        const info = document.createElement('div');
        info.style.fontFamily = 'monospace';
        info.style.fontSize   = '11px';
        info.style.color      = '#6cf';
        info.style.marginTop  = '4px';
        info.textContent = `DSPSIZ(${dsp.args.join(' ')})`;
        sec.appendChild(info);
    }
}

export function renderFileMisc (pane, rec, ctx) {
    const present = rec.keywords.filter(k => FILE_MISC_INTERESTING.includes(k.name));
    if (!present.length) return;

    const sec = sectionStart(pane, 'File-level misc');
    renderMsgLoc(sec, rec, ctx);
    renderDspMod(sec, rec, ctx);
    renderSetofSummary(sec, rec);
}

function renderMsgLoc (sec, rec, ctx) {
    const mlKw = rec.keywords.find(k => k.name === 'MSGLOC');
    const inp  = document.createElement('input');
    inp.type        = 'number';
    inp.min         = 1;
    inp.max         = 27;
    inp.value       = parseInt(mlKw?.args?.[0], 10) || '';
    inp.placeholder = 'msg line row';
    inp.addEventListener('change', () => {
        removeKeyword(rec, 'MSGLOC');
        const v = parseInt(inp.value, 10);
        if (Number.isFinite(v)) {
            rec.keywords.push({ name: 'MSGLOC', args: [String(v)], indicators: [] });
        }
        ctx.onChange?.();
    });
    sec.appendChild(row('MSGLOC', inp));
}

function renderDspMod (sec, rec, ctx) {
    const dmKw = rec.keywords.find(k => k.name === 'DSPMOD');
    const sel  = document.createElement('select');
    for (const o of ['', '*DS3', '*DS4']) {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o || '(none)';
        sel.appendChild(opt);
    }
    sel.value = dmKw?.args?.[0] ?? '';
    sel.addEventListener('change', () => {
        removeKeyword(rec, 'DSPMOD');
        if (sel.value) {
            rec.keywords.push({
                name: 'DSPMOD', args: [sel.value], indicators: [],
            });
        }
        ctx.onChange?.();
    });
    sec.appendChild(row('DSPMOD', sel));
}

// SETOF is read-only — its (N 'desc') shape is rare enough that an editor
// would add UI weight no real screen needs.
function renderSetofSummary (sec, rec) {
    const setofs = rec.keywords.filter(k => k.name === 'SETOF');
    if (!setofs.length) return;

    const lab = document.createElement('div');
    lab.style.fontFamily = 'monospace';
    lab.style.fontSize   = '11px';
    lab.style.color      = '#cc6';
    lab.style.marginTop  = '4px';
    lab.textContent = `SETOF: ${setofs.map(k => k.args.join(' ')).join('; ')}`;
    sec.appendChild(lab);
}
