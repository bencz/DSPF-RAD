// Seed the active record with a "Sign On"-style screen so first-run
// has something visible instead of an empty grid.

import { makeItem } from '../model/factories.js';
import { keywordsFromShortcuts } from '../model/keywords.js';

export function seedDemo (doc) {
    const r = doc.activeRecord;
    r.name = 'SIGNON';
    r.type = 'RECORD';
    r.keywords = [
        { name: 'DSPSIZ',  args: ['24', '80', '*DS3'], indicators: [] },
        { name: 'CA03',    args: ['03'],               indicators: [] },
        { name: 'CA12',    args: ['12'],               indicators: [] },
        { name: 'PRINT',   args: [],                   indicators: [] },
    ];

    const push = (it) => r.items.push(it);
    push(constant(1,  2,  'SIGNON',                              { color: 'BLU' }));
    push(constant(1,  36, 'Sign On',                             { dspatr: ['HI'], color: 'WHT' }));
    push(constant(2,  51, 'System . . . . . :',                  { color: 'GRN' }));
    push(field   (2,  71, 'SYSNAME', 8,                          { usage: 'O', color: 'WHT' }));
    push(constant(3,  51, 'Subsystem . . . . :',                 { color: 'GRN' }));
    push(field   (3,  71, 'SBSNAME', 8,                          { usage: 'O', color: 'WHT' }));
    push(constant(4,  51, 'Display . . . . . :',                 { color: 'GRN' }));
    push(field   (4,  71, 'DSPNAME', 8,                          { usage: 'O', color: 'WHT' }));
    push(constant(6,  17, 'User  . . . . . . . . . . . . . . .', { color: 'GRN' }));
    push(field   (6,  53, 'USER',    10,                         { usage: 'I', dspatr: ['UL'] }));
    push(constant(7,  17, 'Password  . . . . . . . . . . . . .', { color: 'GRN' }));
    push(field   (7,  53, 'PASSWD',  10,                         { usage: 'I', dspatr: ['ND','UL'] }));
    push(constant(8,  17, 'Program/procedure . . . . . . . . .', { color: 'GRN' }));
    push(field   (8,  53, 'PROGRAM', 10,                         { usage: 'I', dspatr: ['UL'] }));
    push(constant(9,  17, 'Menu  . . . . . . . . . . . . . . .', { color: 'GRN' }));
    push(field   (9,  53, 'MENU',    10,                         { usage: 'I', dspatr: ['UL'] }));
    push(constant(10, 17, 'Current library . . . . . . . . . .', { color: 'GRN' }));
    push(field   (10, 53, 'CURLIB',  10,                         { usage: 'I', dspatr: ['UL'] }));
    push(constant(23, 7,  '(C) COPYRIGHT IBM CORP. 1980, 2024.', { color: 'BLU' }));
    push(field   (24, 2,  'MSG',     79,                         { usage: 'O', dspatr: ['HI'], color: 'YLW' }));
}

function constant (row, col, text, opts = {}) {
    return makeItem({
        kind: 'constant', row, col, text,
        keywords: keywordsFromShortcuts(opts),
    });
}

function field (row, col, name, length, opts = {}) {
    return makeItem({
        kind: 'field', row, col, name, length,
        usage:    opts.usage    ?? 'B',
        dataType: opts.dataType ?? 'A',
        decimals: opts.decimals ?? 0,
        keywords: keywordsFromShortcuts(opts),
    });
}
