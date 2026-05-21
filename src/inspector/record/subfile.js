// SFL / SFLCTL-focused form: SFLPAG/SFLSIZ, indicator-conditioned
// SFLDSP/CTL/CLR/END, the message-subfile sub-form, and the SFLEND mode
// chips (*MORE / *PLUS / *SCRBAR).

import { sectionStart, row } from '../dom.js';

export function renderSubfile (pane, rec, ctx) {
    const sec = sectionStart(
        pane,
        rec.type === 'SFL' ? 'Subfile (SFL)' : 'Subfile control (SFLCTL)',
    );

    const ops = makeKwOps(rec, ctx);
    if (rec.type === 'SFLCTL') renderSflctlForm(sec, rec, ctx, ops);
    else                        renderSflInfo  (sec, rec, ctx, ops);
}

// ---- SFLCTL side --------------------------------------------------------

function renderSflctlForm (sec, rec, ctx, ops) {
    renderLinkedSflRow(sec, rec, ctx, ops);
    renderPagSizRows(sec, rec, ops);
    renderIndicatorFlags(sec, rec, ops);
    renderVarInputs(sec, rec, ops);
    renderMessageSubfile(sec, rec, ops);
    renderSflendModeChips(sec, rec, ctx);
}

function renderLinkedSflRow (sec, rec, ctx, ops) {
    const sflSel = document.createElement('select');
    for (const r of ctx.document.records) {
        if (r.type !== 'SFL') continue;
        const opt = document.createElement('option');
        opt.value = r.name; opt.textContent = r.name;
        sflSel.appendChild(opt);
    }
    sflSel.value = ops.getKw('SFLCTL')?.args?.[0] ?? '';
    sflSel.addEventListener('change', () => ops.setSingle('SFLCTL', sflSel.value));
    sec.appendChild(row('Linked SFL', sflSel));
}

function renderPagSizRows (sec, rec, ops) {
    const pagInp = makeNumInput(parseInt(ops.getKw('SFLPAG')?.args?.[0], 10) || 14, 1, 9999);
    pagInp.addEventListener('change', () =>
        ops.setSingle('SFLPAG', String(parseInt(pagInp.value, 10) || 14).padStart(4, '0')));
    sec.appendChild(row('SFLPAG', pagInp));

    const sizInp = makeNumInput(parseInt(ops.getKw('SFLSIZ')?.args?.[0], 10) || 15, 1, 9999);
    sizInp.addEventListener('change', () =>
        ops.setSingle('SFLSIZ', String(parseInt(sizInp.value, 10) || 15).padStart(4, '0')));
    sec.appendChild(row('SFLSIZ', sizInp));
}

function renderIndicatorFlags (sec, rec, ops) {
    const indFlag = (label, name, defaultInd) => {
        const inp = document.createElement('input');
        inp.type        = 'text';
        inp.placeholder = `e.g. ${defaultInd}`;
        inp.value       = ops.getKw(name)?.indicators?.[0] ?? '';
        inp.title       = `Indicator that activates ${name}`;
        inp.className   = 'insp-ind';
        inp.addEventListener('change', () =>
            ops.setIndicator(name, inp.value.toUpperCase().trim()));
        sec.appendChild(row(label, inp));
    };
    indFlag('SFLDSP',    'SFLDSP',    '31');
    indFlag('SFLDSPCTL', 'SFLDSPCTL', '32');
    indFlag('SFLCLR',    'SFLCLR',    '30');
    indFlag('SFLEND',    'SFLEND',    '80');
    indFlag('SFLDLT',    'SFLDLT',    '');
    indFlag('SFLINZ',    'SFLINZ',    '');
}

function renderVarInputs (sec, rec, ops) {
    // SFLMODE(&VAR;) / SFLCSRRRN(&VAR;) carry program-bound variable refs.
    const varInput = (label, name, placeholder) => {
        const inp = document.createElement('input');
        inp.type        = 'text';
        inp.placeholder = placeholder;
        inp.value       = ops.getKw(name)?.args?.[0] ?? '';
        inp.addEventListener('change', () => ops.setSingle(name, inp.value.trim()));
        sec.appendChild(row(label, inp));
    };
    varInput('SFLMODE',   'SFLMODE',   '&MODE;');
    varInput('SFLCSRRRN', 'SFLCSRRRN', '&RRN;');
}

// SFLMSGRCD + SFLMSGKEY + SFLPGMQ: when SFLMSGRCD is present this SFLCTL
// drives a message status line instead of a scrolling list of records.
function renderMessageSubfile (sec, rec, ops) {
    const isMsg = !!ops.getKw('SFLMSGRCD');

    const sub = document.createElement('div');
    sub.style.borderTop  = '1px dashed #2a4a2a';
    sub.style.marginTop  = '6px';
    sub.style.paddingTop = '6px';
    const hdr = document.createElement('div');
    hdr.style.color      = '#cca844';
    hdr.style.fontSize   = '11px';
    hdr.style.fontFamily = 'monospace';
    hdr.textContent = isMsg ? '◆ Message subfile mode' : 'Message subfile (optional)';
    sub.appendChild(hdr);
    sec.appendChild(sub);

    const msgRow = makeNumInput(parseInt(ops.getKw('SFLMSGRCD')?.args?.[0], 10) || '', 1, 27);
    msgRow.placeholder = 'row (e.g. 24)';
    msgRow.addEventListener('change', () =>
        ops.setSingle('SFLMSGRCD', msgRow.value.trim()));
    sec.appendChild(row('SFLMSGRCD', msgRow));

    const varInput = (label, name, placeholder) => {
        const inp = document.createElement('input');
        inp.type        = 'text';
        inp.placeholder = placeholder;
        inp.value       = ops.getKw(name)?.args?.[0] ?? '';
        inp.addEventListener('change', () => ops.setSingle(name, inp.value.trim()));
        sec.appendChild(row(label, inp));
    };
    varInput('SFLMSGKEY', 'SFLMSGKEY', 'msg key field');
    varInput('SFLPGMQ',   'SFLPGMQ',   'pgm queue field');
}

// SFLEND mode chips (*MORE / *PLUS for text markers, *SCRBAR for the
// ENPTUI scrollbar).  Combinations like "*SCRBAR *MORE" are valid; chips
// just toggle args on the SFLEND keyword.
function renderSflendModeChips (sec, rec, ctx) {
    const sflendKw   = rec.keywords.find(k => k.name === 'SFLEND');
    const curArgs    = (sflendKw?.args ?? []).map(a => String(a).toUpperCase());
    const modes      = ['*MORE', '*PLUS', '*SCRBAR'];

    const chips = document.createElement('div');
    chips.className = 'insp-chips';
    for (const mode of modes) {
        const on = curArgs.includes(mode);
        const chip = document.createElement('span');
        chip.className = 'insp-chip' + (on ? ' on' : '');
        chip.textContent = mode;
        chip.title = mode === '*SCRBAR'
            ? 'Render an ENPTUI scroll bar at the right edge of the subfile'
            : `Display "${mode.replace('*', '')}" in the corner when the subfile has more records`;
        chip.addEventListener('click', () => {
            let kw = rec.keywords.find(k => k.name === 'SFLEND');
            if (!kw) {
                kw = { name: 'SFLEND', args: [], indicators: [] };
                rec.keywords.push(kw);
            }
            const i = kw.args.findIndex(a => String(a).toUpperCase() === mode);
            if (i >= 0) kw.args.splice(i, 1);
            else        kw.args.push(mode);
            ctx.onChange?.();
        });
        chips.appendChild(chip);
    }
    sec.appendChild(row('SFLEND mode', chips));
}

// ---- SFL side ----------------------------------------------------------

function renderSflInfo (sec, rec, ctx, ops) {
    const ctl = ctx.document.records.find(r =>
        r.type === 'SFLCTL' &&
        r.keywords.some(kw => kw.name === 'SFLCTL' && kw.args[0] === rec.name));

    const info = document.createElement('div');
    info.style.fontSize   = '11px';
    info.style.fontFamily = 'monospace';
    info.style.color      = ctl ? '#6cf' : '#cc6';
    info.style.padding    = '4px 0';
    info.textContent = ctl
        ? `Controlled by ${ctl.name} (SFLCTL).`
        : `No SFLCTL references this SFL yet.  Add a SFLCTL record with SFLCTL(${rec.name}).`;
    sec.appendChild(info);

    // SFLNXTCHG (indicator-driven) + CHANGE(N).
    const indFlag = (label, name) => {
        const inp = document.createElement('input');
        inp.type        = 'text';
        inp.placeholder = 'indicator';
        inp.value       = ops.getKw(name)?.indicators?.[0] ?? '';
        inp.className   = 'insp-ind';
        inp.addEventListener('change', () =>
            ops.setIndicator(name, inp.value.toUpperCase().trim()));
        sec.appendChild(row(label, inp));
    };
    indFlag('SFLNXTCHG', 'SFLNXTCHG');

    const changeKw = ops.getKw('CHANGE');
    const chgInp = document.createElement('input');
    chgInp.type        = 'text';
    chgInp.placeholder = 'e.g. 49';
    chgInp.value       = changeKw?.args?.[0] ?? '';
    chgInp.title       = 'Indicator set when the row is changed at runtime';
    chgInp.addEventListener('change', () => ops.setSingle('CHANGE', chgInp.value.trim()));
    sec.appendChild(row('CHANGE', chgInp));
}

// ---- helpers ------------------------------------------------------------

function makeKwOps (rec, ctx) {
    return {
        getKw (name) {
            return rec.keywords.find(kw => kw.name === name);
        },
        setSingle (name, value) {
            const i = rec.keywords.findIndex(kw => kw.name === name);
            if (value == null || value === '') {
                if (i >= 0) rec.keywords.splice(i, 1);
            } else if (i >= 0) {
                rec.keywords[i].args = [String(value)];
            } else {
                rec.keywords.push({ name, args: [String(value)], indicators: [] });
            }
            ctx.onChange?.();
        },
        setIndicator (name, indicator) {
            const i = rec.keywords.findIndex(kw => kw.name === name);
            const inds = indicator ? [indicator] : [];
            if (i >= 0) rec.keywords[i].indicators = inds;
            else        rec.keywords.push({ name, args: [], indicators: inds });
            ctx.onChange?.();
        },
    };
}

function makeNumInput (value, min, max) {
    const inp = document.createElement('input');
    inp.type = 'number';
    if (min != null) inp.min = min;
    if (max != null) inp.max = max;
    inp.value = value;
    return inp;
}
