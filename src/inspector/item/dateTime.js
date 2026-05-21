// DATFMT / TIMFMT dropdown — only rendered for fields with date (L) or
// time (T) data type.

import { section, row } from '../dom.js';
import { removeKeyword } from '../quoting.js';

const DATE_FORMATS = ['', '*ISO', '*USA', '*EUR', '*JIS', '*JUL',
                      '*YMD', '*MDY', '*DMY', '*JOB'];
const TIME_FORMATS = ['', '*HMS', '*ISO', '*USA', '*EUR', '*JIS'];

export function renderDateTimeFormat (pane, item, ctx) {
    if (item.kind !== 'field') return;
    if (item.dataType !== 'L' && item.dataType !== 'T') return;

    const isTime = item.dataType === 'T';
    const kwName = isTime ? 'TIMFMT' : 'DATFMT';
    const fmts   = isTime ? TIME_FORMATS : DATE_FORMATS;
    const defaultFmt = isTime ? '*HMS' : '*ISO';

    const sel = document.createElement('select');
    for (const f of fmts) {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f || `(default ${defaultFmt})`;
        sel.appendChild(opt);
    }
    const cur = item.keywords.find(k => k.name === kwName);
    sel.value = cur?.args?.[0] ?? '';
    sel.addEventListener('change', () => {
        removeKeyword(item, kwName);
        if (sel.value) {
            item.keywords.push({ name: kwName, args: [sel.value], indicators: [] });
        }
        ctx.onChange?.();
    });

    section(pane, isTime ? 'Time format (TIMFMT)' : 'Date format (DATFMT)', [
        row(kwName, sel),
    ]);
}
