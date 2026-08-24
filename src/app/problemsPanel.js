import { validateDspf } from '../validation/validateDspf.js';

export function bindProblemsPanel ({ doc, designer, sourceEditor }) {
    const sourceEl = document.getElementById('sourceEditor');
    const problemsEl = document.getElementById('problemsPanel');
    const sourceBtn = document.getElementById('sourceViewBtn');
    const problemsBtn = document.getElementById('problemsViewBtn');
    const colBtn = document.getElementById('cursorColToggle');
    if (!sourceEl || !problemsEl || !sourceBtn || !problemsBtn) return;

    let diagnostics = [];
    let activeView = 'source';

    const show = view => {
        activeView = view;
        const problems = view === 'problems';
        sourceEl.hidden = problems;
        problemsEl.hidden = !problems;
        sourceBtn.classList.toggle('on', !problems);
        problemsBtn.classList.toggle('on', problems);
        if (colBtn) colBtn.hidden = problems;
        if (!problems) sourceEditor.view?.requestMeasure?.();
    };

    const render = () => {
        diagnostics = validateDspf(doc, { layout: true });
        const errors = diagnostics.filter(item => item.severity === 'error').length;
        const warnings = diagnostics.filter(item => item.severity === 'warning').length;
        problemsBtn.textContent = `Problems ${errors + warnings}`;
        problemsBtn.title = `${errors} error(s), ${warnings} warning(s)`;
        problemsBtn.classList.toggle('has-errors', errors > 0);

        problemsEl.innerHTML = '';
        if (!diagnostics.length) {
            const empty = document.createElement('p');
            empty.className = 'problems-empty';
            empty.textContent = 'No problems found.';
            problemsEl.appendChild(empty);
            return;
        }
        for (const diagnostic of diagnostics.slice().sort(problemOrder)) {
            problemsEl.appendChild(problemRow(diagnostic, doc, designer));
        }
    };

    sourceBtn.addEventListener('click', () => show('source'));
    problemsBtn.addEventListener('click', () => show('problems'));
    doc.onChange((_doc, meta = {}) => {
        if (!meta.transient) render();
    });

    render();
    show(activeView);
}

function problemRow (diagnostic, doc, designer) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `problem-row ${diagnostic.severity}`;

    const severity = document.createElement('span');
    severity.className = 'problem-severity';
    severity.textContent = diagnostic.severity;
    row.appendChild(severity);

    const code = document.createElement('span');
    code.className = 'problem-code';
    code.textContent = diagnostic.code;
    row.appendChild(code);

    const message = document.createElement('span');
    message.textContent = diagnostic.message;
    if (diagnostic.record) {
        const context = document.createElement('span');
        context.className = 'problem-context';
        context.textContent = diagnostic.item
            ? `[${diagnostic.record} / ${diagnostic.item}]`
            : `[${diagnostic.record}]`;
        message.appendChild(context);
    }
    row.appendChild(message);

    row.addEventListener('click', () => {
        const recordIndex = doc.records.findIndex(record =>
            record.name === diagnostic.record);
        if (recordIndex >= 0) doc.setActiveRecord(recordIndex);
        const item = diagnostic.itemId
            ? doc.findItem(diagnostic.itemId)
            : doc.activeRecord.items.find(candidate =>
                candidate.name === diagnostic.item || candidate.id === diagnostic.item);
        designer.selectItem(item?.id ?? null);
        designer.canvas.focus();
    });
    return row;
}

function problemOrder (a, b) {
    const weight = severity => severity === 'error' ? 0 : severity === 'warning' ? 1 : 2;
    return weight(a.severity) - weight(b.severity) ||
        String(a.record ?? '').localeCompare(String(b.record ?? ''));
}
