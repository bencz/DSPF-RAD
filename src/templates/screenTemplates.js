import { DspfDocument } from '../model/DspfDocument.js';
import { makeItem, makeRecord, ibmiName } from '../model/factories.js';

export const SCREEN_TEMPLATES = [
    { id: 'blank', label: 'Blank screen', description: 'One empty record format.' },
    { id: 'login', label: 'Login screen', description: 'User, password, message and function keys.' },
    { id: 'menu', label: 'Application menu', description: 'Numbered options with a command field.' },
    { id: 'maintenance', label: 'Maintenance form', description: 'Header, labeled fields and CRUD actions.' },
    { id: 'subfile', label: 'Subfile list', description: 'Linked SFL/SFLCTL pair with headings and paging.' },
    { id: 'popup', label: 'Popup window', description: 'Main screen plus an overlay WINDOW record.' },
    { id: 'confirmation', label: 'Confirmation dialog', description: 'Compact confirmation WINDOW with response field.' },
];

export function createTemplateDocument (templateId, options = {}) {
    const doc = new DspfDocument();
    doc.modelKey = options.modelKey === '27x132' ? '27x132' : '24x80';
    doc.sourceName = ibmiName(options.sourceName, 'DSPFILE');
    const baseName = ibmiName(options.recordName, 'MAIN');
    const builder = BUILDERS[templateId] ?? buildBlank;
    doc.records = builder(baseName, doc.modelKey);
    doc.activeRecordIndex = pickActiveRecord(doc.records);
    doc.resetHistory({ markClean: true });
    return doc;
}

const BUILDERS = {
    blank: buildBlank,
    login: buildLogin,
    menu: buildMenu,
    maintenance: buildMaintenance,
    subfile: buildSubfile,
    popup: buildPopup,
    confirmation: buildConfirmation,
};

function buildBlank (name, modelKey) {
    return [record(name, [modelKeyword(modelKey), key('CA03', '03')])];
}

function buildLogin (name, modelKey) {
    const cols = modelKey === '27x132' ? 132 : 80;
    const center = Math.max(2, Math.floor(cols / 2) - 12);
    return [record(name, [modelKeyword(modelKey), key('CA03', '03'), key('CA12', '12')], [
        constant(1, 2, docTitle(name), 'WHT', ['HI']),
        constant(5, center, 'User . . . . . . :'),
        field(5, center + 20, 'USER', 10, 'I', ['UL']),
        constant(7, center, 'Password . . . . :'),
        field(7, center + 20, 'PASSWD', 10, 'I', ['UL', 'ND']),
        constant(10, center, 'F3=Exit   F12=Cancel', 'BLU'),
        field(modelKey === '27x132' ? 27 : 24, 2, 'MSG', cols - 2, 'O', ['HI'], 'YLW'),
    ])];
}

function buildMenu (name, modelKey) {
    const lastRow = modelKey === '27x132' ? 27 : 24;
    return [record(name, [modelKeyword(modelKey), key('CA03', '03'), key('CA12', '12')], [
        constant(1, 2, `${docTitle(name)} - Main Menu`, 'WHT', ['HI']),
        constant(4, 6, '1. Inquiry'),
        constant(6, 6, '2. Maintenance'),
        constant(8, 6, '3. Reports'),
        constant(11, 6, 'Option . . . :'),
        field(11, 21, 'OPTION', 2, 'I', ['UL']),
        constant(lastRow - 1, 2, 'F3=Exit   F12=Cancel', 'BLU'),
        field(lastRow, 2, 'MSG', modelKey === '27x132' ? 130 : 78, 'O', ['HI'], 'YLW'),
    ])];
}

function buildMaintenance (name, modelKey) {
    const lastRow = modelKey === '27x132' ? 27 : 24;
    return [record(name, [
        modelKeyword(modelKey), key('CA03', '03'), key('CA12', '12'), key('CF05', '05'),
    ], [
        constant(1, 2, `${docTitle(name)} - Maintenance`, 'WHT', ['HI']),
        constant(4, 4, 'Code . . . . . :'),
        field(4, 22, 'CODE', 10, 'B', ['UL']),
        constant(6, 4, 'Description  . :'),
        field(6, 22, 'DESCR', 40, 'B', ['UL']),
        constant(8, 4, 'Status . . . . :'),
        field(8, 22, 'STATUS', 1, 'B', ['UL']),
        constant(10, 4, 'Updated by . . :'),
        field(10, 22, 'UPDUSER', 10, 'O'),
        constant(lastRow - 1, 2, 'F3=Exit   F5=Refresh   F12=Cancel', 'BLU'),
        field(lastRow, 2, 'MSG', modelKey === '27x132' ? 130 : 78, 'O', ['HI'], 'YLW'),
    ])];
}

function buildSubfile (name, modelKey) {
    const seed = name.slice(0, 7) || 'LIST';
    const sflName = `${seed}S`.slice(0, 10);
    const ctlName = `${seed}C`.slice(0, 10);
    const lastRow = modelKey === '27x132' ? 27 : 24;
    const sfl = record(sflName, [key('SFL')], [
        field(7, 2, 'OPT', 1, 'B', ['UL']),
        field(7, 6, 'ROWID', 10, 'O'),
        field(7, 19, 'ROWDESC', modelKey === '27x132' ? 60 : 40, 'O'),
    ], 'SFL');
    const ctl = record(ctlName, [
        modelKeyword(modelKey),
        key('SFLCTL', sflName), key('SFLSIZ', '9999'), key('SFLPAG', '0010'),
        key('OVERLAY'), conditionedKey('SFLDSP', '31'),
        conditionedKey('SFLDSPCTL', '32'), conditionedKey('SFLCLR', '30'),
        conditionedKey('SFLEND', '80', '*MORE'), key('CA03', '03'), key('CA12', '12'),
    ], [
        constant(1, 2, `${docTitle(name)} - List`, 'WHT', ['HI']),
        constant(4, 2, 'Position to . . :'),
        field(4, 20, 'POSITION', 10, 'I', ['UL']),
        constant(6, 2, 'Opt'),
        constant(6, 6, 'Identifier'),
        constant(6, 19, 'Description'),
        constant(lastRow - 1, 2, '2=Change   4=Delete   5=Display   F3=Exit', 'BLU'),
        field(lastRow, 2, 'MSG', modelKey === '27x132' ? 130 : 78, 'O', ['HI'], 'YLW'),
    ], 'SFLCTL');
    return [sfl, ctl];
}

function buildPopup (name, modelKey) {
    const mainName = name;
    const windowName = `${name.slice(0, 7)}WIN`.slice(0, 10);
    const main = record(mainName, [modelKeyword(modelKey), key('CA03', '03'), key('CF04', '04')], [
        constant(1, 2, `${docTitle(name)} - Screen`, 'WHT', ['HI']),
        constant(5, 4, 'Press F4 to open the prompt window.'),
        constant(modelKey === '27x132' ? 26 : 23, 2, 'F3=Exit   F4=Prompt', 'BLU'),
    ]);
    const popup = record(windowName, [
        key('WINDOW', '5', '15', '9', '50'), key('OVERLAY'),
        key('WDWBORDER', '(*COLOR BLU)'), key('WDWTITLE', "(*TEXT 'Prompt')", '*CENTER', '*TOP'),
        key('CA12', '12'),
    ], [
        constant(2, 3, 'Search value . . :'),
        field(2, 22, 'SEARCH', 20, 'B', ['UL']),
        constant(6, 3, 'Enter=Accept   F12=Cancel', 'BLU'),
    ], 'WINDOW');
    return [main, popup];
}

function buildConfirmation (name, modelKey) {
    const rows = modelKey === '27x132' ? 27 : 24;
    const cols = modelKey === '27x132' ? 132 : 80;
    const top = Math.max(2, Math.floor(rows / 2) - 4);
    const left = Math.max(2, Math.floor(cols / 2) - 24);
    return [record(name, [
        modelKeyword(modelKey), key('WINDOW', String(top), String(left), '8', '48'),
        key('WDWBORDER', '(*COLOR YLW)'),
        key('WDWTITLE', "(*TEXT 'Confirmation')", '*CENTER', '*TOP'),
        key('CA12', '12'),
    ], [
        constant(2, 3, 'Confirm this operation?'),
        constant(4, 3, 'Response (Y/N) . :'),
        field(4, 23, 'CONFIRM', 1, 'I', ['UL']),
        constant(6, 3, 'Enter=Confirm   F12=Cancel', 'BLU'),
    ], 'WINDOW')];
}

function record (name, keywords = [], items = [], type = 'RECORD') {
    return makeRecord({ name, type, keywords, items });
}

function constant (row, col, text, color = 'GRN', attributes = []) {
    return makeItem({
        kind: 'constant', row, col, text,
        keywords: [
            ...(color ? [key('COLOR', color)] : []),
            ...attributes.map(attribute => key('DSPATR', attribute)),
        ],
    });
}

function field (row, col, name, length, usage = 'B', attributes = [], color = null) {
    return makeItem({
        kind: 'field', row, col, name, length, usage,
        dataType: 'A', decimals: 0,
        keywords: [
            ...attributes.map(attribute => key('DSPATR', attribute)),
            ...(color ? [key('COLOR', color)] : []),
        ],
    });
}

function key (name, ...args) {
    return { name, args, indicators: [] };
}

function conditionedKey (name, indicator, ...args) {
    return { name, args, indicators: [indicator] };
}

function modelKeyword (modelKey) {
    return modelKey === '27x132'
        ? { ...key('DSPSIZ', '27', '132', '*DS4'), scope: 'file' }
        : { ...key('DSPSIZ', '24', '80', '*DS3'), scope: 'file' };
}

function pickActiveRecord (records) {
    const index = records.findIndex(record => record.type === 'SFLCTL');
    return index >= 0 ? index : 0;
}

function docTitle (name) {
    return String(name || 'SCREEN').replace(/[_$#@]+/g, ' ');
}
