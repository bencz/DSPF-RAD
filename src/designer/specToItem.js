// Factory: palette spec → DspfDocument item shape.  Each spec.kind maps
// to a kind + keyword preset so the renderer's ENPTUI branches kick in
// immediately after the drop.

import { keywordsFromShortcuts } from '../model/keywords.js';

export function specToItem (spec, cell) {
    return specToItems(spec, cell)[0];
}

export function specToItems (spec, cell, usedNames = []) {
    const at = { row: cell.row, col: cell.col };
    const baseKws = keywordsFromShortcuts(spec);

    const builder = BUILDERS[spec.kind] ?? defaultField;
    const primary = builder(spec, at, baseKws);
    const names = new Set(usedNames.map(name => String(name).toUpperCase()));
    if (primary.kind === 'field' && primary.name) {
        primary.name = uniqueFieldName(primary.name, names);
    }
    if (!primary.keywords?.some(kw => kw.name === 'MLTCHCFLD')) return [primary];

    const companions = [];
    for (const choice of primary.keywords.filter(kw => kw.name === 'CHOICE')) {
        const choiceNo = String(choice.args?.[0] ?? companions.length + 1);
        const controlName = uniqueFieldName(`${primary.name || 'CHK'}C${choiceNo}`, names);
        primary.keywords.push({
            name: 'CHCCTL', args: [choiceNo, `&${controlName};`], indicators: [],
        });
        companions.push({
            kind: 'field', row: 1, col: 1,
            name: controlName, length: 1,
            usage: 'H', dataType: 'Y', decimals: 0,
            keywords: [],
        });
    }
    return [primary, ...companions];
}

const BUILDERS = {
    constant: (spec, at, kws) => ({
        kind: 'constant', ...at,
        text: spec.text ?? 'Text',
        keywords: kws,
    }),

    sysvalue: (spec, at, kws) => {
        const sys = spec.sys ?? 'DATE';
        return {
            kind: 'sysvalue', ...at,
            sysName: sys,
            keywords: [{ name: sys, args: [], indicators: [] }, ...kws],
        };
    },

    pushbtn: (spec, at, kws) => ({
        kind: 'field', ...at,
        name: spec.name ?? 'BTN', length: 2,
        usage: 'B', dataType: 'Y', decimals: 0,
        keywords: [
            { name: 'PSHBTNFLD', args: [],                 indicators: [] },
            { name: 'PSHBTNCHC', args: ['1', "'OK'"],       indicators: [] },
            ...kws,
        ],
    }),

    pushbtnGroup: (spec, at, kws) => ({
        kind: 'field', ...at,
        name: spec.name ?? 'BTNS', length: 2,
        usage: 'B', dataType: 'Y', decimals: 0,
        keywords: [
            { name: 'PSHBTNFLD', args: [],                     indicators: [] },
            { name: 'PSHBTNCHC', args: ['1', "'OK'"],          indicators: [] },
            { name: 'PSHBTNCHC', args: ['2', "'Cancel'"],      indicators: [] },
            { name: 'PSHBTNCHC', args: ['3', "'Help'"],        indicators: [] },
            ...kws,
        ],
    }),

    radio:    (spec, at, kws) => singleChoice('SNGCHCFLD', spec, at, kws, 'RAD'),
    checkbox: (spec, at, kws) => singleChoice('MLTCHCFLD', spec, at, kws, 'CHK'),
    radioGroup: (spec, at, kws) => groupChoice('SNGCHCFLD', spec, at, kws, 'RAD'),
    checkGroup: (spec, at, kws) => groupChoice('MLTCHCFLD', spec, at, kws, 'CHK'),

    mnubar: (spec, at, kws) => ({
        kind: 'field', ...at,
        name: spec.name ?? 'MENU', length: 2,
        usage: 'B', dataType: 'Y', decimals: 0,
        keywords: [
            { name: 'MNUBARCHC', args: ['1', 'PULL1', "' Item 1 '"], indicators: [] },
            { name: 'MNUBARCHC', args: ['2', 'PULL2', "' Item 2 '"], indicators: [] },
            ...kws,
        ],
    }),

    cntfld: (spec, at, kws) => ({
        kind: 'field', ...at,
        name: spec.name ?? 'TEXT', length: 120,
        usage: 'B', dataType: 'A', decimals: 0,
        keywords: [
            { name: 'CNTFLD', args: ['60'], indicators: [] },
            ...kws,
        ],
    }),

    errmsg: (spec, at, kws) => ({
        kind: 'field', ...at,
        name: spec.name ?? 'MSG', length: 60,
        usage: 'O', dataType: 'A', decimals: 0,
        keywords: [
            { name: 'DSPATR', args: ['HI'],  indicators: [] },
            { name: 'COLOR',  args: ['RED'], indicators: [] },
            ...kws,
        ],
    }),
};

function singleChoice (head, spec, at, kws, defaultName) {
    return {
        kind: 'field', ...at,
        name: spec.name ?? defaultName,
        length: 2, usage: 'B', dataType: 'Y', decimals: 0,
        keywords: [
            { name: head,     args: [],                       indicators: [] },
            { name: 'CHOICE', args: ['1', "'Option'"],         indicators: [] },
            ...kws,
        ],
    };
}

function groupChoice (head, spec, at, kws, defaultName) {
    return {
        kind: 'field', ...at,
        name: spec.name ?? defaultName,
        length: 2, usage: 'B', dataType: 'Y', decimals: 0,
        keywords: [
            { name: head,     args: [],                          indicators: [] },
            { name: 'CHOICE', args: ['1', "'Option 1'"],          indicators: [] },
            { name: 'CHOICE', args: ['2', "'Option 2'"],          indicators: [] },
            { name: 'CHOICE', args: ['3', "'Option 3'"],          indicators: [] },
            ...kws,
        ],
    };
}

function uniqueFieldName (candidate, used) {
    const base = String(candidate).toUpperCase()
        .replace(/[^A-Z0-9_]/g, '').slice(0, 10) || 'CTL';
    let name = base;
    let suffix = 1;
    while (used.has(name)) {
        suffix++;
        const tail = String(suffix);
        name = base.slice(0, 10 - tail.length) + tail;
    }
    used.add(name);
    return name;
}

function defaultField (spec, at, kws) {
    const usage =
        spec.kind === 'input'  ? 'I' :
        spec.kind === 'output' ? 'O' :
        spec.kind === 'both'   ? 'B' : 'B';
    return {
        kind: 'field', ...at,
        name:   spec.name   ?? '',
        length: spec.length ?? 10,
        usage, dataType: 'A', decimals: 0,
        keywords: kws,
    };
}
