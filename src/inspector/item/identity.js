// Item tab basics: Position, then a per-kind block (constant text /
// sysvalue name / field name+length+usage+type+decimals).

import { DATA_TYPES, USAGES } from '../../Attributes.js';
import { section, row, numField, textField, selField } from '../dom.js';

const SYSVALUE_NAMES = [
    'DATE', 'TIME', 'USER', 'SYSNAME', 'USRNAME',
    'DATEUSA', 'TIMEUSA', 'EUROPE', 'JOBNAME', 'NETID',
];

export function renderPosition (pane, item, ctx) {
    section(pane, 'Position', [
        numField(item, 'row', 'Row',
            v => ctx.onItemPatch(item.id, { row: v }), 1, ctx.document.rows),
        numField(item, 'col', 'Col',
            v => ctx.onItemPatch(item.id, { col: v }), 1, ctx.document.cols),
    ]);
}

export function renderKindBlock (pane, item, ctx) {
    if (item.kind === 'constant') renderConstantBlock(pane, item, ctx);
    else if (item.kind === 'sysvalue') renderSysvalueBlock(pane, item, ctx);
    else                                renderFieldBlock(pane, item, ctx);
}

function renderConstantBlock (pane, item, ctx) {
    section(pane, 'Constant', [
        textField(item, 'text', 'Text',
            v => ctx.onItemPatch(item.id, { text: v })),
    ]);
}

function renderSysvalueBlock (pane, item, ctx) {
    const sysSel = document.createElement('select');
    for (const n of SYSVALUE_NAMES) {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        sysSel.appendChild(opt);
    }
    sysSel.value = item.sysName || 'DATE';
    sysSel.addEventListener('change', () => {
        // Replace the head sysvalue keyword too so the writer emits the
        // new name on the row/col line.
        const oldName = item.sysName;
        item.sysName = sysSel.value;
        if (item.keywords?.[0]?.name === oldName) {
            item.keywords[0].name = sysSel.value;
        }
        ctx.onChange?.();
    });
    section(pane, 'System value', [row('Name', sysSel)]);
}

function renderFieldBlock (pane, item, ctx) {
    section(pane, 'Field', [
        textField(item, 'name', 'Name',
            v => ctx.onItemPatch(item.id, {
                name: v.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 10),
            })),
        numField(item, 'length', 'Length',
            v => ctx.onItemPatch(item.id, { length: v }), 1, ctx.document.cols),
        selField(item, 'usage', 'Usage', USAGES,
            v => ctx.onItemPatch(item.id, { usage: v })),
        selField(item, 'dataType', 'Data type', DATA_TYPES,
            v => ctx.onItemPatch(item.id, { dataType: v })),
        numField(item, 'decimals', 'Decimals',
            v => ctx.onItemPatch(item.id, { decimals: v }), 0, 31),
    ]);
}
