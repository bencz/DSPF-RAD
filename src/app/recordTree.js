export function bindRecordTree ({ doc, designer }) {
    const paletteBtn = document.getElementById('paletteTabBtn');
    const recordsBtn = document.getElementById('recordsTabBtn');
    const palettePane = document.getElementById('paletteTabPane');
    const recordsPane = document.getElementById('recordsTabPane');
    const tree = document.getElementById('recordTree');
    if (!paletteBtn || !recordsBtn || !palettePane || !recordsPane || !tree) return;

    const show = tab => {
        const records = tab === 'records';
        palettePane.hidden = records;
        recordsPane.hidden = !records;
        paletteBtn.classList.toggle('active', !records);
        recordsBtn.classList.toggle('active', records);
    };
    paletteBtn.addEventListener('click', () => show('palette'));
    recordsBtn.addEventListener('click', () => show('records'));

    const render = () => {
        tree.innerHTML = '';
        const root = document.createElement('div');
        root.className = 'record-tree-root';
        root.textContent = `${doc.sourceName}.DSPF`;
        tree.appendChild(root);

        doc.records.forEach((record, index) => {
            const branch = document.createElement('div');
            branch.className = 'record-tree-branch';

            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'record-tree-row';
            row.classList.toggle('active', index === doc.activeRecordIndex);

            const icon = document.createElement('span');
            icon.className = `record-tree-icon type-${record.type.toLowerCase()}`;
            icon.textContent = typeIcon(record.type);
            row.appendChild(icon);

            const name = document.createElement('span');
            name.className = 'record-tree-name';
            name.textContent = record.name;
            row.appendChild(name);

            const meta = document.createElement('span');
            meta.className = 'record-tree-meta';
            meta.textContent = record.type === 'RECORD'
                ? `${record.items.length}`
                : `${record.type} · ${record.items.length}`;
            row.appendChild(meta);
            row.addEventListener('click', () => {
                designer.selectItem(null);
                doc.setActiveRecord(index);
            });
            branch.appendChild(row);

            for (const relation of recordRelations(record)) {
                branch.appendChild(relationRow(relation, doc, designer));
            }
            tree.appendChild(branch);
        });

        const create = document.createElement('button');
        create.type = 'button';
        create.className = 'record-tree-create';
        create.textContent = 'New design from template…';
        create.addEventListener('click', () =>
            document.getElementById('templateNew')?.click());
        tree.appendChild(create);
    };

    doc.onChange((_doc, meta = {}) => {
        if (!meta.transient) render();
    });
    render();
    show('palette');
}

function recordRelations (record) {
    const relations = [];
    for (const keyword of record.keywords ?? []) {
        if (keyword.name === 'SFLCTL' && keyword.args?.[0]) {
            relations.push({ label: 'controls', target: keyword.args[0] });
        } else if (keyword.name === 'MNUBARDSP' && keyword.args?.[0]) {
            relations.push({ label: 'displays menu', target: keyword.args[0] });
        } else if (keyword.name === 'WINDOW' && keyword.args?.length === 1) {
            relations.push({ label: 'window reference', target: keyword.args[0] });
        }
    }
    const seen = new Set();
    for (const item of record.items ?? []) {
        for (const keyword of item.keywords ?? []) {
            if (keyword.name !== 'MNUBARCHC' || !keyword.args?.[1]) continue;
            const target = keyword.args[1];
            if (seen.has(target)) continue;
            seen.add(target);
            relations.push({ label: 'opens pulldown', target });
        }
    }
    return relations;
}

function relationRow (relation, doc, designer) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'record-tree-link';
    row.textContent = `↳ ${relation.label}: ${relation.target}`;
    const targetIndex = doc.records.findIndex(record => record.name === relation.target);
    row.disabled = targetIndex < 0;
    row.title = targetIndex < 0 ? 'Referenced record was not found' : 'Open referenced record';
    row.addEventListener('click', () => {
        if (targetIndex < 0) return;
        designer.selectItem(null);
        doc.setActiveRecord(targetIndex);
    });
    return row;
}

function typeIcon (type) {
    if (type === 'SFL') return 'S';
    if (type === 'SFLCTL') return 'C';
    if (type === 'WINDOW') return 'W';
    if (type === 'MNUBAR') return 'M';
    if (type === 'PULLDOWN') return 'P';
    return 'R';
}
