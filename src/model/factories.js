// Constructors for items and records.  Centralised so every entry point
// (parser, drop handler, demo seed) lands on the same default shape.

import { normalize as kwNormalize } from './keywords.js';

let _idSeq = 0;
const newId = () => `it_${(++_idSeq).toString(36)}`;

function trackId (id) {
    const match = /^it_([0-9a-z]+)$/i.exec(String(id ?? ''));
    if (!match) return;
    const seq = parseInt(match[1], 36);
    if (Number.isSafeInteger(seq) && seq > _idSeq) _idSeq = seq;
}

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
        conditionOp: '',
        conditionLines: [],
        alternateLocations: [],
        keywords: [],
    };
    const it = Object.assign(base, overrides);
    if (!it.id) it.id = newId();
    trackId(it.id);
    it.keywords   = (it.keywords ?? []).map(kwNormalize);
    it.indicators = (it.indicators ?? []).slice();
    it.conditionOp = it.conditionOp === 'A' || it.conditionOp === 'O'
        ? it.conditionOp
        : '';
    it.conditionLines = (it.conditionLines ?? []).map(line => ({
        conditionOp: line.conditionOp === 'A' || line.conditionOp === 'O'
            ? line.conditionOp
            : '',
        indicators: (line.indicators ?? []).slice(),
    }));
    it.alternateLocations = (it.alternateLocations ?? []).map(location => ({
        conditionName: String(location.conditionName ?? '').toUpperCase(),
        row: location.row,
        col: location.col,
    }));
    return it;
}

export function makeRecord (overrides = {}) {
    return {
        name:     (overrides.name ?? 'REC').toUpperCase().slice(0, 10),
        type:     overrides.type ?? 'RECORD',
        items:    overrides.items ?? [],
        keywords: (overrides.keywords ?? []).map(kwNormalize),
        // Each entry represents one DDS H-specification.  Keeping these
        // separate from record keywords is essential: column 17 changes
        // how HLPARA and its following keywords are interpreted by DDS.
        helpSpecs: (overrides.helpSpecs ?? []).map(spec => ({
            keywords: (spec.keywords ?? []).map(kwNormalize),
        })),
    };
}

// Coerce + dedupe an incoming record name against the existing record list.
// `ignoreIdx` lets a rename skip its own slot during the collision check.
export function uniqueRecordName (records, candidate, ignoreIdx = -1) {
    let name = (candidate ?? '').trim().toUpperCase()
        .replace(/[^A-Z0-9_$#@]/g, '').slice(0, 10);
    if (!name) name = 'REC';
    let final = name, n = 1;
    while (records.some((r, i) => i !== ignoreIdx && r.name === final)) {
        n++;
        const suffix = String(n);
        final = name.slice(0, Math.max(0, 10 - suffix.length)) + suffix;
    }
    return final;
}

// IBM i system-style name suitable for generated source identifiers.
// DDS names in this project are limited to the classic ten characters.
export function ibmiName (candidate, fallback = 'OBJECT') {
    let name = String(candidate ?? '').trim().toUpperCase()
        .replace(/[^A-Z0-9_$#@]/g, '').slice(0, 10);
    if (!name) name = fallback;
    // HLL identifiers are less permissive than CL object names when the
    // first character is numeric; prefixing keeps generated RPG/COBOL valid.
    if (/^\d/.test(name)) name = ('X' + name).slice(0, 10);
    return name;
}
