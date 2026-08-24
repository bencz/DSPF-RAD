import {
    SCREEN_TEMPLATES, createTemplateDocument,
} from '../templates/screenTemplates.js';

export function bindTemplateDialog ({
    doc, designer, palette, flash, flushSource,
}) {
    const dialog = document.getElementById('templateDialog');
    const form = document.getElementById('templateForm');
    const kind = document.getElementById('templateKind');
    const description = document.getElementById('templateDescription');
    const sourceName = document.getElementById('templateSourceName');
    const recordName = document.getElementById('templateRecordName');
    const model = document.getElementById('templateModel');
    if (!dialog || !form || !kind) return;

    for (const template of SCREEN_TEMPLATES) {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.label;
        kind.appendChild(option);
    }

    const updateDescription = () => {
        const template = SCREEN_TEMPLATES.find(candidate => candidate.id === kind.value);
        description.textContent = template?.description ?? '';
    };
    kind.addEventListener('change', updateDescription);
    updateDescription();

    const open = () => {
        flushSource?.();
        if (doc.isDirty && !confirm('Discard the current unsaved design?')) return;
        sourceName.value = 'DSPFILE';
        recordName.value = 'MAIN';
        model.value = doc.modelKey;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        sourceName.focus();
        sourceName.select();
    };

    document.getElementById('newDoc')?.addEventListener('click', open);
    document.getElementById('templateNew')?.addEventListener('click', open);
    document.getElementById('templateCancel')?.addEventListener('click', () => dialog.close());

    form.addEventListener('submit', event => {
        event.preventDefault();
        const created = createTemplateDocument(kind.value, {
            sourceName: sourceName.value,
            recordName: recordName.value,
            modelKey: model.value,
        });
        doc.sourceName = created.sourceName;
        doc.adopt(created, { preserveAidActions: false });
        // A generated starting point has not been downloaded yet.
        doc.resetHistory({ markClean: false });
        designer.selectItem(null);
        palette.clearArmed();
        dialog.close();
        flash(`Created ${created.sourceName} from the ${kind.selectedOptions[0].textContent} template.`, 'ok', 4000);
    });

    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });
}
