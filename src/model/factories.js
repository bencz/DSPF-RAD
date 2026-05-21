// Constructors for items and records.  Centralised so every entry point
// (parser, drop handler, demo seed) lands on the same default shape.

import { normalize as kwNormalize } from './keywords.js';

let _idSeq = 0;
const newId = () => `it_${(++_idSeq).toString(36)}`;

export function makeItem (overrides = {}) {
    const kind = overrides.kind ?? 'constant';
    const base = {
        id: newId(),
        kind,                  // 'constant' | 'field' | 'sysvalue'
        row: 1, col: 1,
        // constant
        text: 'Sample',
        // field
        name: '',
        length: 10,
        decimals: 0,
        dataType: 'A',
        usage: 'B',
        // Conditioning wraps every keyword of this item; per-keyword
        // indicators live inside each entry of `keywords`.
        indicators: [],
        keywords: [],
    };
    const it = Object.assign(base, overrides);
    if (!it.id) it.id = newId();
    it.keywords   = (it.keywords ?? []).map(kwNormalize);
    it.indicators = (it.indicators ?? []).slice();
    return it;
}

export function makeRecord (overrides = {}) {
    return {
        name:     (overrides.name ?? 'REC').toUpperCase().slice(0, 10),
        type:     overrides.type ?? 'RECORD',
        items:    overrides.items ?? [],
        keywords: (overrides.keywords ?? []).map(kwNormalize),
    };
}

// Coerce + dedupe an incoming record name against the existing record list.
// `ignoreIdx` lets a rename skip its own slot during the collision check.
export function uniqueRecordName (records, candidate, ignoreIdx = -1) {
    let name = (candidate ?? '').trim().toUpperCase()
        .replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (!name) name = 'REC';
    let final = name, n = 1;
    while (records.some((r, i) => i !== ignoreIdx && r.name === final)) {
        n++;
        final = (name + n).slice(0, 10);
    }
    return final;
}
