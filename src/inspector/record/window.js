// WINDOW placement form: mode (explicit / *DFT / *REL), top/left/rows/
// cols, border colour, title text + placement chips, WINDOW flags
// (*NOMSGLIN / *NORSTCSR).

import { sectionStart, row } from '../dom.js';
import { removeKeyword } from '../quoting.js';

export function renderWindowSpec (pane, rec, ctx) {
    const sec = sectionStart(pane, 'Window placement');

    // Make sure a WINDOW keyword exists so the editor has something to
    // mutate.  Seeded with a sensible default.
    let win = rec.keywords.find(k => k.name === 'WINDOW');
    if (!win) {
        win = { name: 'WINDOW', args: ['5', '10', '10', '40'], indicators: [] };
        rec.keywords.push(win);
    }

    const winOps = makeWindowOps(win, ctx);

    renderModeRow(sec, win, winOps);
    renderGeometryRows(sec, win, winOps);
    renderBorderRow(sec, rec, ctx);
    renderTitleEditor(sec, rec, win, ctx);
    renderFlagChips(sec, win, winOps);
}

// ---- mode / geometry ---------------------------------------------------

function renderModeRow (sec, win, ops) {
    const sel = document.createElement('select');
    for (const m of ['explicit', '*DFT', '*REL']) {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = m;
        sel.appendChild(opt);
    }
    sel.value = ops.parse().mode;
    sel.addEventListener('change', () =>
        ops.rebuild({ ...ops.parse(), mode: sel.value }));
    sec.appendChild(row('Mode', sel));
}

function renderGeometryRows (sec, win, ops) {
    const cur = ops.parse();
    const mkNum = (label, key, disabled) => {
        const inp = document.createElement('input');
        inp.type     = 'number';
        inp.min      = 1;
        inp.value    = cur[key] || '';
        inp.disabled = !!disabled;
        inp.addEventListener('change', () =>
            ops.rebuild({ ...ops.parse(), [key]: inp.value }));
        sec.appendChild(row(label, inp));
    };
    mkNum('Top',  'top',  cur.mode === '*DFT');
    mkNum('Left', 'left', cur.mode === '*DFT');
    mkNum('Rows', 'rows', false);
    mkNum('Cols', 'cols', false);
}

// ---- WDWBORDER colour --------------------------------------------------

function renderBorderRow (sec, rec, ctx) {
    const borderKw   = rec.keywords.find(k => k.name === 'WDWBORDER');
    const borderArgs = (borderKw?.args ?? []).join(' ');
    const cMatch     = borderArgs.match(/\*COLOR\s+([A-Z]+)/i);

    const colorSel = document.createElement('select');
    for (const c of ['', 'GRN','WHT','RED','TRQ','YLW','PNK','BLU']) {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c || '(default purple)';
        colorSel.appendChild(opt);
    }
    colorSel.value = cMatch?.[1].toUpperCase() ?? '';
    colorSel.addEventListener('change', () => {
        removeKeyword(rec, 'WDWBORDER');
        if (colorSel.value) {
            rec.keywords.push({
                name: 'WDWBORDER',
                args: [`(*COLOR ${colorSel.value})`],
                indicators: [],
            });
        }
        ctx.onChange?.();
    });
    sec.appendChild(row('Border', colorSel));
}

// ---- WDWTITLE: text + placement chips ----------------------------------

function renderTitleEditor (sec, rec, win, ctx) {
    let   titleKw     = rec.keywords.find(k => k.name === 'WDWTITLE');
    const titleArgs   = titleKw?.args ?? [];
    const initialText = extractTitleText(titleArgs[0]);
    const curArgsUpper = titleArgs.slice(1).map(a => String(a).toUpperCase());

    const titleInp = document.createElement('input');
    titleInp.type        = 'text';
    titleInp.value       = initialText;
    titleInp.placeholder = "title text or '&VAR;'";

    const placementBox = document.createElement('div');
    placementBox.className = 'insp-chips';

    const saveTitle = () => {
        const v = titleInp.value.trim();
        removeKeyword(rec, 'WDWTITLE');
        if (v) {
            const wrapped = v.startsWith('&')
                ? `(*TEXT ${v})`
                : `(*TEXT '${v.replace(/'/g, "''")}')`;
            const newArgs = [wrapped, ...placementTokens(placementBox)];
            rec.keywords.push({ name: 'WDWTITLE', args: newArgs, indicators: [] });
        }
        ctx.onChange?.();
    };
    titleInp.addEventListener('change', saveTitle);
    sec.appendChild(row('Title', titleInp));

    const placements = [
        ['*TOP',    'top vert'],
        ['*BOTTOM', 'bot vert'],
        ['*LEFT',   'left horz'],
        ['*CENTER', 'centre horz'],
        ['*RIGHT',  'right horz'],
    ];
    for (const [p, tip] of placements) {
        const on   = curArgsUpper.includes(p);
        const chip = document.createElement('span');
        chip.className   = 'insp-chip' + (on ? ' on' : '');
        chip.textContent = p;
        chip.title       = tip;
        chip.addEventListener('click', () => {
            chip.classList.toggle('on');
            // Mutually exclusive within each axis.
            if (chip.classList.contains('on')) {
                const others = (p === '*TOP' || p === '*BOTTOM')
                    ? ['*TOP', '*BOTTOM'].filter(x => x !== p)
                    : ['*LEFT', '*CENTER', '*RIGHT'].filter(x => x !== p);
                for (const c of placementBox.querySelectorAll('.insp-chip')) {
                    if (others.includes(c.textContent)) c.classList.remove('on');
                }
            }
            if (titleInp.value.trim()) saveTitle();
        });
        placementBox.appendChild(chip);
    }
    sec.appendChild(row('Placement', placementBox));
}

// ---- WINDOW(*flag) chips -----------------------------------------------

function renderFlagChips (sec, win, ops) {
    const flagsRow = document.createElement('div');
    flagsRow.className = 'insp-chips';
    const winFlags = ['*NOMSGLIN', '*NORSTCSR'];

    const cur = ops.parse();
    const curExtra = cur.extra.map(a => String(a).toUpperCase());

    for (const f of winFlags) {
        const on   = curExtra.includes(f);
        const chip = document.createElement('span');
        chip.className   = 'insp-chip' + (on ? ' on' : '');
        chip.textContent = f;
        chip.title = f === '*NOMSGLIN'
            ? 'Suppress the message line inside the window'
            : 'Do not restore cursor position when the window closes';
        chip.addEventListener('click', () => {
            const cur2 = ops.parse();
            const ext  = cur2.extra.slice();
            const i = ext.findIndex(a => String(a).toUpperCase() === f);
            if (i >= 0) ext.splice(i, 1);
            else        ext.push(f);
            ops.rebuild({ ...cur2, extra: ext });
        });
        flagsRow.appendChild(chip);
    }
    sec.appendChild(row('Flags', flagsRow));
}

// ---- ops + helpers ----------------------------------------------------

function makeWindowOps (win, ctx) {
    const parse = () => parseWin(win.args);
    return {
        parse,
        rebuild (spec) {
            const out = [];
            if      (spec.mode === '*DFT') out.push('*DFT', String(spec.rows || 5), String(spec.cols || 30));
            else if (spec.mode === '*REL') out.push('*REL', String(spec.top || 1), String(spec.left || 1), String(spec.rows || 5), String(spec.cols || 30));
            else                            out.push(String(spec.top || 1), String(spec.left || 1), String(spec.rows || 5), String(spec.cols || 30));
            for (const e of spec.extra) out.push(e);
            win.args = out;
            ctx.onChange?.();
        },
    };
}

function parseWin (a) {
    if (a[0] === '*DFT') {
        return { mode:'*DFT', top:'', left:'', rows:a[1]??'', cols:a[2]??'', extra:a.slice(3) };
    }
    if (a[0] === '*REL') {
        return { mode:'*REL', top:a[1]??'', left:a[2]??'', rows:a[3]??'', cols:a[4]??'', extra:a.slice(5) };
    }
    return { mode:'explicit', top:a[0]??'', left:a[1]??'', rows:a[2]??'', cols:a[3]??'', extra:a.slice(4) };
}

function extractTitleText (raw) {
    if (!raw) return '';
    const lit = String(raw).match(/\*TEXT\s+'([^']*)'/);
    if (lit) return lit[1];
    const variable = String(raw).match(/\*TEXT\s+&([A-Z0-9_]+);?/i);
    if (variable) return `&${variable[1]};`;
    return stripQuotesLite(raw);
}

function stripQuotesLite (s) {
    const t = String(s).trim();
    if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
        return t.substring(1, t.length - 1).replace(/''/g, "'");
    }
    return t;
}

function placementTokens (placementBox) {
    const tokens = [];
    for (const c of placementBox.querySelectorAll('.insp-chip.on')) {
        tokens.push(c.textContent);
    }
    return tokens;
}
