import {
    parseDatabaseDds, layoutDatabaseFields,
} from '../import/databaseDds.js';

export function bindDatabaseImportDialog ({
    doc, designer, host, flash, flushSource,
}) {
    const byId = id => document.getElementById(id);
    const openButton = byId('importDatabaseFields');
    const dialog = byId('databaseImportDialog');
    const form = byId('databaseImportForm');
    if (!openButton || !dialog || !form) return;

    const controls = {
        fileName: byId('databaseImportFile'),
        sourceRecord: byId('databaseSourceRecord'),
        targetRecord: byId('databaseTargetRecord'),
        layout: byId('databaseLayout'),
        usage: byId('databaseUsage'),
        startRow: byId('databaseStartRow'),
        labelCol: byId('databaseLabelCol'),
        fieldCol: byId('databaseFieldCol'),
        fieldColLabel: byId('databaseFieldColLabel'),
        addOption: byId('databaseAddOption'),
        fields: byId('databaseFields'),
    };
    let sourceRecords = [];

    openButton.addEventListener('click', async () => {
        flushSource?.();
        try {
            const file = await host.openTextFile({ accept: '.dds,.pf,.lf,.txt' });
            if (!file) return;
            sourceRecords = parseDatabaseDds(file.text);
            if (!sourceRecords.length) {
                flash('No PF/LF record fields were found in that DDS member.', 'error', 5000);
                return;
            }
            controls.fileName.textContent = `${file.name} · ${sourceRecords.reduce(
                (sum, record) => sum + record.fields.length, 0)} field(s)`;
            fillSourceRecords();
            fillTargetRecords();
            refreshFields();
            refreshLayoutControls();
            showDialog(dialog);
        } catch (error) {
            console.error('[ironterm] PF/LF import failed:', error);
            flash(`Could not import PF/LF DDS: ${error.message}`, 'error', 5000);
        }
    });

    controls.sourceRecord.addEventListener('change', refreshFields);
    controls.layout.addEventListener('change', refreshLayoutControls);
    controls.targetRecord.addEventListener('change', suggestLayoutFromTarget);
    byId('databaseImportCancel')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });

    form.addEventListener('submit', event => {
        event.preventDefault();
        const source = sourceRecords[Number(controls.sourceRecord.value)];
        const targetIndex = Number(controls.targetRecord.value);
        const target = doc.records[targetIndex];
        if (!source || !target) return;
        const selectedNames = new Set([...controls.fields.querySelectorAll(
            'input[type="checkbox"]:checked')].map(input => input.value));
        const fields = source.fields.filter(field => selectedNames.has(field.name));
        if (!fields.length) {
            flash('Select at least one database field.', 'error');
            return;
        }

        const result = layoutDatabaseFields(fields, {
            layout: controls.layout.value,
            usage: controls.usage.value,
            startRow: numberValue(controls.startRow, 3),
            labelCol: numberValue(controls.labelCol, 2),
            fieldCol: numberValue(controls.fieldCol, 24),
            addOption: controls.addOption.checked,
            rows: doc.rows,
            cols: doc.cols,
            existingItems: target.items,
        });
        if (!result.items.length) {
            flash('The selected fields do not fit in the target layout.', 'error', 5000);
            return;
        }

        doc.setActiveRecord(targetIndex);
        let created = [];
        doc.transaction(`Import ${source.name} fields`, () => {
            created = doc.addItems(result.items);
        });
        designer.selectItems(created.map(item => item.id));
        dialog.close();
        const skipped = result.skipped.length
            ? ` ${result.skipped.length} field(s) did not fit.`
            : '';
        flash(`Imported ${fields.length - result.skipped.length} field(s) into ${target.name}.${skipped}`,
            result.skipped.length ? 'error' : 'ok', 5000);
    });

    function fillSourceRecords () {
        controls.sourceRecord.replaceChildren(...sourceRecords.map((record, index) =>
            option(index, `${record.name} (${record.fields.length})`)));
    }

    function fillTargetRecords () {
        controls.targetRecord.replaceChildren(...doc.records.map((record, index) =>
            option(index, `${record.name} · ${record.type}`)));
        const active = doc.activeRecord;
        const linkedName = active?.type === 'SFLCTL'
            ? active.keywords.find(keyword => keyword.name === 'SFLCTL')?.args?.[0]
            : null;
        const linkedIndex = linkedName
            ? doc.records.findIndex(record => record.type === 'SFL' && record.name === linkedName)
            : -1;
        controls.targetRecord.value = String(linkedIndex >= 0
            ? linkedIndex
            : doc.activeRecordIndex);
        suggestLayoutFromTarget();
    }

    function refreshFields () {
        const record = sourceRecords[Number(controls.sourceRecord.value)];
        controls.fields.replaceChildren(...(record?.fields ?? []).map(field => {
            const label = document.createElement('label');
            label.className = 'import-field-row';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = field.name;
            input.checked = true;
            const description = document.createElement('span');
            description.innerHTML = `<strong>${escapeHtml(field.name)}</strong>` +
                `<small>${escapeHtml(field.sourceDataType)}(${field.length}` +
                `${field.decimals ? `,${field.decimals}` : ''}) · ${escapeHtml(field.label)}</small>`;
            label.append(input, description);
            return label;
        }));
    }

    function suggestLayoutFromTarget () {
        const target = doc.records[Number(controls.targetRecord.value)];
        if (target?.type === 'SFL') controls.layout.value = 'subfile';
        refreshLayoutControls();
    }

    function refreshLayoutControls () {
        const isSubfile = controls.layout.value === 'subfile';
        if (isSubfile) {
            const target = doc.records[Number(controls.targetRecord.value)];
            const linkedName = target?.type === 'SFLCTL'
                ? target.keywords.find(keyword => keyword.name === 'SFLCTL')?.args?.[0]
                : null;
            const linkedIndex = linkedName
                ? doc.records.findIndex(record => record.type === 'SFL' && record.name === linkedName)
                : -1;
            if (linkedIndex >= 0) controls.targetRecord.value = String(linkedIndex);
        }
        controls.fieldColLabel.hidden = isSubfile;
        controls.addOption.closest('label').hidden = !isSubfile;
        controls.usage.value = isSubfile ? 'O' : 'B';
    }
}

function option (value, label) {
    const element = document.createElement('option');
    element.value = String(value);
    element.textContent = label;
    return element;
}

function numberValue (input, fallback) {
    const value = Number.parseInt(input?.value, 10);
    return Number.isFinite(value) ? value : fallback;
}

function showDialog (dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
}

function escapeHtml (value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}
