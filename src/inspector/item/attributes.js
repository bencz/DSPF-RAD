// DSPATR chips + COLOR dropdown + EDTCDE dropdown.  These three sit
// together because they're the visual-styling triad every item exposes.

import { DSPATR_FLAGS, COLORS, EDTCDE } from '../../Attributes.js';
import { flagsOf, valueOf, setFlag, setSingle } from '../../model/keywords.js';
import { sectionStart, section, selRawField } from '../dom.js';

export function renderDspatrChips (pane, item, ctx) {
    const sec    = sectionStart(pane, 'DSPATR');
    const chips  = document.createElement('div');
    chips.className = 'insp-chips';

    const active = flagsOf(item, 'DSPATR');
    for (const [flag, label] of Object.entries(DSPATR_FLAGS)) {
        const on = active.includes(flag);
        const chip = document.createElement('span');
        chip.className = 'insp-chip' + (on ? ' on' : '');
        chip.textContent = flag;
        chip.title = label;
        chip.addEventListener('click', () => {
            setFlag(item, 'DSPATR', flag, !on);
            ctx.onChange?.();
        });
        chips.appendChild(chip);
    }
    sec.appendChild(chips);
}

export function renderColor (pane, item, ctx) {
    const options = [
        { value: '', label: '(default GRN)' },
        ...Object.entries(COLORS).map(([v, l]) => ({ value: v, label: `${v} · ${l}` })),
    ];
    section(pane, 'Color', [
        selRawField(options, valueOf(item, 'COLOR') ?? '', v => {
            setSingle(item, 'COLOR', v || null);
            ctx.onChange?.();
        }),
    ]);
}

export function renderEdtCde (pane, item, ctx) {
    if (item.kind !== 'field') return;
    const options = EDTCDE.map(c => ({ value: c, label: c || '(none)' }));
    section(pane, 'Edit code', [
        selRawField(options, valueOf(item, 'EDTCDE') ?? '', v => {
            setSingle(item, 'EDTCDE', v || null);
            ctx.onChange?.();
        }),
    ]);
}
