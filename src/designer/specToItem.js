// Factory: palette spec → DspfDocument item shape.  Each spec.kind maps
// to a kind + keyword preset so the renderer's ENPTUI branches kick in
// immediately after the drop.

import { keywordsFromShortcuts } from '../model/keywords.js';

export function specToItem (spec, cell) {
    const at = { row: cell.row, col: cell.col };
    const baseKws = keywordsFromShortcuts(spec);

    const builder = BUILDERS[spec.kind] ?? defaultField;
    return builder(spec, at, baseKws);
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
        length: 1, usage: 'B', dataType: 'Y', decimals: 0,
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
        length: 1, usage: 'B', dataType: 'Y', decimals: 0,
        keywords: [
            { name: head,     args: [],                          indicators: [] },
            { name: 'CHOICE', args: ['1', "'Option 1'"],          indicators: [] },
            { name: 'CHOICE', args: ['2', "'Option 2'"],          indicators: [] },
            { name: 'CHOICE', args: ['3', "'Option 3'"],          indicators: [] },
            ...kws,
        ],
    };
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
