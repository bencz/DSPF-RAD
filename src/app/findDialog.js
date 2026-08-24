import { searchDocument } from '../model/search.js';

export function bindFindDialog ({ doc, designer, flushSource }) {
    const openButton = document.getElementById('findDesign');
    const dialog = document.getElementById('findDialog');
    const form = document.getElementById('findForm');
    const query = document.getElementById('findQuery');
    const resultsElement = document.getElementById('findResults');
    const count = document.getElementById('findCount');
    if (!openButton || !dialog || !form || !query || !resultsElement) return;

    openButton.addEventListener('click', () => {
        flushSource?.();
        render();
        showDialog(dialog);
        query.focus();
        query.select();
    });
    query.addEventListener('input', render);
    form.addEventListener('submit', event => {
        event.preventDefault();
        resultsElement.querySelector('.find-result')?.click();
    });
    document.getElementById('findClose')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });

    function render () {
        const results = searchDocument(doc, query.value);
        count.textContent = query.value.trim()
            ? `${results.length} result(s)`
            : 'Start typing to search';
        resultsElement.replaceChildren(...results.map(result => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'find-result';
            const badge = document.createElement('span');
            badge.className = `find-result-badge kind-${result.kind}`;
            badge.textContent = result.kind === 'record' ? 'R' : 'F';
            const text = document.createElement('span');
            text.className = 'find-result-text';
            const label = document.createElement('strong');
            label.textContent = result.label;
            const detail = document.createElement('small');
            detail.textContent = result.detail;
            text.append(label, detail);
            button.append(badge, text);
            button.addEventListener('click', () => openResult(result));
            return button;
        }));
    }

    function openResult (result) {
        designer.selectItem(null);
        doc.setActiveRecord(result.recordIndex);
        if (result.itemId) {
            designer.inspector?.setTab?.('item');
            designer.selectItem(result.itemId);
        } else {
            designer.inspector?.setTab?.('record');
        }
        dialog.close();
        designer.canvas.focus();
    }
}

function showDialog (dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
}
