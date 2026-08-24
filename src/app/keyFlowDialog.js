import {
    collectAids, collectDisplayRecords,
} from '../codegen/analysis.js';

export function bindKeyFlowDialog ({ doc, flash, flushSource }) {
    const openButton = document.getElementById('editKeyFlow');
    const dialog = document.getElementById('keyFlowDialog');
    const form = document.getElementById('keyFlowForm');
    const rowsElement = document.getElementById('keyFlowRows');
    if (!openButton || !dialog || !form || !rowsElement) return;

    let aids = [];
    let routes = [];

    openButton.addEventListener('click', () => {
        flushSource?.();
        aids = collectAids(doc);
        routes = collectDisplayRecords(doc);
        if (!aids.length) {
            flash('Add a CAxx, CFxx, HELP or paging keyword before configuring key flow.',
                'error', 5000);
            return;
        }
        renderRows();
        showDialog(dialog);
    });

    document.getElementById('keyFlowCancel')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        const actions = [...rowsElement.querySelectorAll('.flow-row')].flatMap(row => {
            const behavior = row.querySelector('.flow-behavior').value;
            if (behavior === 'default') return [];
            const action = { pos: Number(row.dataset.pos), behavior };
            if (behavior === 'navigate') action.target = row.querySelector('.flow-target').value;
            return [action];
        });
        doc.setAidActions(actions);
        dialog.close();
        flash(`Applied ${actions.length} explicit key action(s).`, 'ok');
    });

    function renderRows () {
        rowsElement.replaceChildren(...aids.map(aid => {
            const configured = doc.aidActions.find(action => action.pos === aid.pos);
            const row = document.createElement('div');
            row.className = 'flow-row';
            row.dataset.pos = String(aid.pos);

            const key = document.createElement('span');
            key.className = 'flow-key';
            key.innerHTML = `<strong>${aid.aid}</strong><small>IN${String(aid.pos).padStart(2, '0')} · ${aid.field}</small>`;

            const behavior = document.createElement('select');
            behavior.className = 'flow-behavior';
            behavior.append(
                option('default', defaultLabel(aid)),
                option('exit', 'Exit program'),
                option('navigate', 'Navigate to record'),
            );
            behavior.value = configured?.behavior ?? 'default';

            const target = document.createElement('select');
            target.className = 'flow-target';
            target.append(...routes.map(record => option(record.name,
                `${record.name} · ${record.type}`)));
            if (configured?.target && routes.some(record => record.name === configured.target)) {
                target.value = configured.target;
            }
            const sync = () => {
                target.disabled = behavior.value !== 'navigate' || !routes.length;
                if (behavior.value === 'navigate' && !routes.length) behavior.value = 'default';
            };
            behavior.addEventListener('change', sync);
            sync();
            row.append(key, behavior, target);
            return row;
        }));
    }
}

function defaultLabel (aid) {
    return /^C[AF](03|12)$/.test(aid.aid)
        ? 'Default (exit)'
        : 'Default (protected handler)';
}

function option (value, label) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    return element;
}

function showDialog (dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
}
