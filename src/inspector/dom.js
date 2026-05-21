// Tiny DOM builders shared by every inspector section.  Each helper
// returns an HTMLElement so the caller can compose them with appendChild.

export function sectionStart (parent, title) {
    const s = document.createElement('div');
    s.className = 'insp-section';
    const h = document.createElement('h4');
    h.textContent = title;
    s.appendChild(h);
    parent.appendChild(s);
    return s;
}

export function section (parent, title, rows) {
    const s = sectionStart(parent, title);
    for (const r of rows) s.appendChild(r);
    return s;
}

export function emptyNote (parent, msg) {
    const note = document.createElement('p');
    note.className = 'empty';
    note.style.padding = '4px 0';
    note.textContent = msg;
    parent.appendChild(note);
}

export function row (label, control) {
    const r = document.createElement('div');
    r.className = 'insp-row';
    const lab = document.createElement('label');
    lab.textContent = label;
    r.appendChild(lab);
    r.appendChild(control);
    return r;
}

// ---- field constructors (return a full row) ------------------------------

export function numField (obj, key, label, onChange, min, max) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.value = obj[key] ?? 0;
    if (min != null) inp.min = min;
    if (max != null) inp.max = max;
    inp.addEventListener('change', () => {
        const v = parseInt(inp.value, 10);
        if (!Number.isNaN(v)) onChange(v);
    });
    return row(label, inp);
}

export function textField (obj, key, label, onChange) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = obj[key] ?? '';
    inp.addEventListener('change', () => onChange(inp.value));
    return row(label, inp);
}

export function selField (obj, key, label, options, onChange) {
    const sel = document.createElement('select');
    for (const o of options) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        sel.appendChild(opt);
    }
    sel.value = obj[key] ?? '';
    sel.addEventListener('change', () => onChange(sel.value));
    return row(label, sel);
}

// Bare <select> (no label).  For sections that only need the control.
export function selRawField (options, value, onChange) {
    const sel = document.createElement('select');
    sel.className = 'insp-raw-select';
    for (const o of options) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        sel.appendChild(opt);
    }
    sel.value = value ?? '';
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
}
