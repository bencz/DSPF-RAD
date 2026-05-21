// Three small chip-based sections that group together: record options,
// entry-field defaults (CHGINPDFT), and cursor-binding refs (RTNCSRLOC /
// CSRLOC).

import { sectionStart, row } from '../dom.js';
import { renderPresenceChips } from '../chips.js';
import { removeKeyword } from '../quoting.js';

const RECORD_OPTION_NAMES = [
    'OVERLAY','PUTOVR','OVRDTA','OVRATR','KEEP','ASSUME','FRCDTA','CLRL',
    'BLINK','INVITE','RMVWDW','USRRSTDSP','LOCK','PROTECT','MSGALARM',
    'FLDCSRPRG','DUP',
];

const RECORD_OPTION_TIPS = {
    OVERLAY:   'Keep previous record on screen',
    PUTOVR:    'Override previous output behaviour',
    OVRDTA:    'Override data (with PUTOVR)',
    OVRATR:    'Override attributes (with PUTOVR)',
    KEEP:      'Do not erase when overlaid',
    ASSUME:    'Assume record visible from previous step',
    FRCDTA:    'Force data to be sent immediately',
    CLRL:      'Clear lines',
    BLINK:     'Sound the alarm/blink',
    INVITE:    'Invite operation (multi-user)',
    RMVWDW:    'Removable window (close handle in chrome)',
    USRRSTDSP: 'Program controls display restore',
    LOCK:      'Lock subfile from scrolling',
    PROTECT:   'Protect record from user input',
    MSGALARM:  'Sound alarm with message',
    FLDCSRPRG: 'Field cursor progression handler',
    DUP:       'Enable DUP key for fields',
};

export function renderRecordOptions (pane, rec, ctx) {
    const sec = sectionStart(pane, 'Record options');
    renderPresenceChips(sec, rec, RECORD_OPTION_NAMES, RECORD_OPTION_TIPS, ctx.onChange);
}

export function renderEntryDefaults (pane, rec, ctx) {
    const sec = sectionStart(pane, 'Entry-field defaults');
    let ip = rec.keywords.find(k => k.name === 'CHGINPDFT');
    const flags = ['HI','UL','RI','BL','ND','PR'];
    const cur = new Set((ip?.args ?? []).map(a => String(a).toUpperCase()));

    const chips = document.createElement('div');
    chips.className = 'insp-chips';
    for (const f of flags) {
        const chip = document.createElement('span');
        chip.className   = 'insp-chip' + (cur.has(f) ? ' on' : '');
        chip.textContent = f;
        chip.title       = 'Default DSPATR for entry fields in this record';
        chip.addEventListener('click', () => {
            if (!ip) {
                ip = { name: 'CHGINPDFT', args: [], indicators: [] };
                rec.keywords.push(ip);
            }
            const i = ip.args.findIndex(a => String(a).toUpperCase() === f);
            if (i >= 0) ip.args.splice(i, 1);
            else        ip.args.push(f);
            if (ip.args.length === 0) removeKeyword(rec, 'CHGINPDFT');
            ctx.onChange?.();
        });
        chips.appendChild(chip);
    }
    sec.appendChild(row('CHGINPDFT', chips));
}

export function renderCursorBinding (pane, rec, ctx) {
    const sec = sectionStart(pane, 'Cursor binding');

    const note = document.createElement('p');
    note.className     = 'empty';
    note.style.padding = '2px 0 4px';
    note.textContent   = 'RTNCSRLOC: where the cursor was; CSRLOC: where to put it before display.';
    sec.appendChild(note);

    const mkInput = (label, name, placeholder) => {
        const kw  = rec.keywords.find(k => k.name === name);
        const inp = document.createElement('input');
        inp.type        = 'text';
        inp.placeholder = placeholder;
        inp.value       = (kw?.args ?? []).join(' ');
        inp.addEventListener('change', () => {
            const args = inp.value.trim().split(/\s+/).filter(Boolean);
            removeKeyword(rec, name);
            if (args.length) rec.keywords.push({ name, args, indicators: [] });
            ctx.onChange?.();
        });
        sec.appendChild(row(label, inp));
    };
    mkInput('RTNCSRLOC', 'RTNCSRLOC', '&REC; &FLD;  (or *MOUSE/&WINDOW + 2-4 vars)');
    mkInput('CSRLOC',    'CSRLOC',    'row col   (or 2 field refs)');
}
