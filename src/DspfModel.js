// In-memory representation of a DSPF (display file).  All conditioning
// and attributes flow through item.keywords[] / record.keywords[] in the
// canonical { name, args, indicators } shape - see Keywords.js for the
// helpers.

import { normalize as kwNormalize } from './Keywords.js';

let _idSeq = 0;
const newId = () => `it_${(++_idSeq).toString(36)}`;

export const MODELS = {
    '24x80':  { rows: 24, cols: 80,  label: '24×80 · 5251-11'  },
    '27x132': { rows: 27, cols: 132, label: '27×132 · 3477-FC' },
};

// The record "type" is our way of tagging which DSPF shape the record
// follows.  Plain RECORD is the default; SFL/SFLCTL are subfile pairs;
// MNUBAR/PULLDOWN/WINDOW are ENPTUI extensions.  The renderer + parser
// branch on this.
export const RECORD_TYPES = {
    RECORD:   { label: 'Record (standard)' },
    SFL:      { label: 'Subfile (SFL)' },
    SFLCTL:   { label: 'Subfile control (SFLCTL)' },
    MNUBAR:   { label: 'Menu bar (ENPTUI)' },
    PULLDOWN: { label: 'Pulldown menu (ENPTUI)' },
    WINDOW:   { label: 'Window (popup)' },
};

export function makeItem (overrides = {}) {
    const kind = overrides.kind ?? 'constant';
    const base = {
        id: newId(),
        kind,                  // 'constant' | 'field'
        row: 1, col: 1,
        // Constant
        text: 'Sample',
        // Field
        name: '',
        length: 10,
        decimals: 0,
        dataType: 'A',
        usage: 'B',
        // Conditioning that wraps every keyword of this item.  Per-keyword
        // indicators live inside each entry of `keywords`.
        indicators: [],
        // Canonical keyword list.  DSPATR / COLOR / EDTCDE / and anything
        // else (REFFLD, CNTFLD, CHGINPDFT, etc.) all live here.
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

export class DspfDocument {
    constructor () {
        this.modelKey = '24x80';
        this.records = [makeRecord({ name: 'MAIN' })];
        this.activeRecordIndex = 0;
        this.showOverlay = false;
        this.hideConditioned = false;
        this._listeners = new Set();
    }

    get rows () { return MODELS[this.modelKey].rows; }
    get cols () { return MODELS[this.modelKey].cols; }
    get activeRecord () { return this.records[this.activeRecordIndex]; }

    onChange (fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }
    emit () { for (const fn of this._listeners) fn(this); }

    // ---- mutations ----

    setModel (key) {
        if (!MODELS[key] || key === this.modelKey) return;
        this.modelKey = key;
        for (const r of this.records) {
            for (const it of r.items) {
                if (it.row > this.rows) it.row = this.rows;
                if (it.col > this.cols) it.col = this.cols;
            }
        }
        this.emit();
    }

    setShowOverlay (v) {
        const next = !!v;
        if (next === this.showOverlay) return;
        this.showOverlay = next;
        this.emit();
    }

    setHideConditioned (v) {
        const next = !!v;
        if (next === this.hideConditioned) return;
        this.hideConditioned = next;
        this.emit();
    }

    reset () {
        this.records = [makeRecord({ name: 'MAIN' })];
        this.activeRecordIndex = 0;
        this.emit();
    }

    /** Copy state from another DspfDocument in-place.  Used after a
     *  parser run so existing references to `this` stay valid. */
    adopt (other) {
        this.modelKey          = other.modelKey;
        this.records           = other.records;
        this.activeRecordIndex = other.activeRecordIndex ?? 0;
        this.showOverlay       = other.showOverlay ?? false;
        if (!this.records.length) this.records = [makeRecord({ name: 'MAIN' })];
        this.emit();
    }

    addRecord (name, type = 'RECORD') {
        const safe = uniqueRecordName(this.records,
            name || `R${this.records.length + 1}`);
        this.records.push(makeRecord({ name: safe, type }));
        this.activeRecordIndex = this.records.length - 1;
        this.emit();
    }

    /** Convenience: create an SFL + SFLCTL pair pre-wired with sensible
     *  defaults (SFLSIZ/SFLPAG, indicator-conditioned SFLDSP/SFLDSPCTL/
     *  SFLCLR/SFLEND).  The active record becomes the SFLCTL because
     *  that's what you typically edit. */
    addSubfile (baseName) {
        const seed = (baseName || 'SFL').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) || 'SFL';
        const sflName    = uniqueRecordName(this.records, seed);
        const sflCtlName = uniqueRecordName([...this.records, { name: sflName }], seed + 'C');
        const sfl = makeRecord({
            name: sflName,
            type: 'SFL',
            keywords: [],
            items: [],
        });
        const sflctl = makeRecord({
            name: sflCtlName,
            type: 'SFLCTL',
            keywords: [
                { name: 'SFLCTL',    args: [sflName],   indicators: [] },
                { name: 'SFLSIZ',    args: ['0015'],    indicators: [] },
                { name: 'SFLPAG',    args: ['0014'],    indicators: [] },
                { name: 'OVERLAY',   args: [],          indicators: [] },
                { name: 'SFLDSP',    args: [],          indicators: ['31'] },
                { name: 'SFLDSPCTL', args: [],          indicators: ['32'] },
                { name: 'SFLCLR',    args: [],          indicators: ['30'] },
                { name: 'SFLEND',    args: ['*MORE'],   indicators: ['80'] },
            ],
            items: [],
        });
        this.records.push(sfl, sflctl);
        this.activeRecordIndex = this.records.length - 1;     // focus SFLCTL
        this.emit();
        return { sfl, sflctl };
    }
    renameRecord (idx, name) {
        if (idx < 0 || idx >= this.records.length) return;
        this.records[idx].name = uniqueRecordName(this.records, name, idx);
        this.emit();
    }
    setRecordType (idx, type) {
        if (idx < 0 || idx >= this.records.length) return;
        if (!RECORD_TYPES[type]) return;
        if (this.records[idx].type === type) return;
        this.records[idx].type = type;
        this.emit();
    }
    deleteRecord (idx) {
        if (this.records.length === 1) return;
        this.records.splice(idx, 1);
        if (this.activeRecordIndex >= this.records.length)
            this.activeRecordIndex = this.records.length - 1;
        this.emit();
    }
    setActiveRecord (idx) {
        if (idx < 0 || idx >= this.records.length) return;
        if (idx === this.activeRecordIndex) return;
        this.activeRecordIndex = idx;
        this.emit();
    }

    addItem (overrides) {
        const it = makeItem(overrides);
        this.activeRecord.items.push(it);
        this.emit();
        return it;
    }
    removeItem (id) {
        const rec = this.activeRecord;
        const i = rec.items.findIndex(it => it.id === id);
        if (i < 0) return;
        rec.items.splice(i, 1);
        this.emit();
    }
    updateItem (id, patch) {
        const it = this.findItem(id);
        if (!it) return;
        Object.assign(it, patch);
        if (it.row < 1) it.row = 1;
        if (it.col < 1) it.col = 1;
        if (it.row > this.rows) it.row = this.rows;
        if (it.col > this.cols) it.col = this.cols;
        if (it.kind === 'field' && it.length < 1) it.length = 1;
        this.emit();
    }
    findItem (id) {
        for (const r of this.records) {
            const it = r.items.find(x => x.id === id);
            if (it) return it;
        }
        return null;
    }
    itemCount () {
        return this.records.reduce((s, r) => s + r.items.length, 0);
    }

    toJSON () {
        return {
            modelKey: this.modelKey,
            activeRecordIndex: this.activeRecordIndex,
            showOverlay: this.showOverlay,
            records: this.records.map(r => ({
                name: r.name,
                type: r.type,
                keywords: r.keywords.map(kw => ({ ...kw, args: kw.args.slice(), indicators: kw.indicators.slice() })),
                items: r.items.map(it => ({
                    ...it,
                    keywords:   it.keywords.map(kw => ({ ...kw, args: kw.args.slice(), indicators: kw.indicators.slice() })),
                    indicators: it.indicators.slice(),
                })),
            })),
        };
    }
    static fromJSON (data) {
        const doc = new DspfDocument();
        doc.modelKey    = data.modelKey ?? '24x80';
        doc.showOverlay = !!data.showOverlay;
        const recs = (data.records ?? []).map(r => makeRecord({
            name: r.name, type: r.type, keywords: r.keywords,
            items: (r.items ?? []).map(it => makeItem(it)),
        }));
        doc.records = recs.length ? recs : [makeRecord({ name: 'MAIN' })];
        doc.activeRecordIndex = Math.min(
            data.activeRecordIndex ?? 0, doc.records.length - 1);
        return doc;
    }
}

function uniqueRecordName (records, candidate, ignoreIdx = -1) {
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
