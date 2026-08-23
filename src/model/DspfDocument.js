// In-memory DSPF document.  All conditioning and attributes live on
// item.keywords[] / record.keywords[] in { name, args, indicators } shape
// — see ./keywords.js for the manipulation helpers.

import { MODELS, RECORD_TYPES } from './constants.js';
import { makeItem, makeRecord, uniqueRecordName, ibmiName } from './factories.js';

export class DspfDocument {
    constructor () {
        this.modelKey = '24x80';
        this.sourceName = 'DSPFILE';
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
        for (const record of this.records) {
            record.keywords = (record.keywords ?? []).filter(
                keyword => keyword.name !== 'DSPSIZ');
        }
        this.records[0]?.keywords.unshift(modelSizeKeyword(key));
        // Clamp items that no longer fit the new geometry.
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
        this.sourceName = 'DSPFILE';
        this.records = [makeRecord({
            name: 'MAIN', keywords: [modelSizeKeyword(this.modelKey)],
        })];
        this.activeRecordIndex = 0;
        this.emit();
    }

    // Copy state from another DspfDocument in place so existing references
    // to `this` stay valid after a parser round-trip.
    adopt (other) {
        this.modelKey = MODELS[other?.modelKey] ? other.modelKey : '24x80';
        this.records = Array.isArray(other?.records) && other.records.length
            ? other.records
            : [makeRecord({ name: 'MAIN' })];
        this.activeRecordIndex = clampRecordIndex(
            other?.activeRecordIndex, this.records.length);
        // Overlay and conditioning visibility are workspace preferences,
        // not DSPF source data.  Preserve them while source edits adopt a
        // freshly parsed document.
        this.emit();
    }

    addRecord (name, type = 'RECORD') {
        const safe = uniqueRecordName(this.records,
            name || `R${this.records.length + 1}`);
        this.records.push(makeRecord({ name: safe, type }));
        this.activeRecordIndex = this.records.length - 1;
        this.emit();
    }

    // Create a wired-up SFL + SFLCTL pair.  SFLCTL becomes active because
    // it's the side users actually edit.
    addSubfile (baseName) {
        const seed = (baseName || 'SFL').toUpperCase()
            .replace(/[^A-Z0-9]/g, '').slice(0, 7) || 'SFL';
        const sflName    = uniqueRecordName(this.records, seed);
        const sflCtlName = uniqueRecordName(
            [...this.records, { name: sflName }], seed + 'C');
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
        const oldName = this.records[idx].name;
        const newName = uniqueRecordName(this.records, name, idx);
        this.records[idx].name = newName;
        if (newName !== oldName) updateRecordReferences(this.records, oldName, newName);
        this.emit();
    }

    setRecordType (idx, type) {
        if (idx < 0 || idx >= this.records.length) return;
        if (!RECORD_TYPES[type]) return;
        if (this.records[idx].type === type) return;
        const record = this.records[idx];
        record.type = type;
        record.keywords = (record.keywords ?? []).filter(keyword =>
            !Object.hasOwn(RECORD_TYPES, keyword.name));
        if (type !== 'RECORD') {
            record.keywords.unshift({ name: type, args: [], indicators: [] });
        }
        this.emit();
    }

    deleteRecord (idx) {
        if (this.records.length === 1) return;
        const fileKeywords = (this.records[idx]?.keywords ?? []).filter(
            keyword => keyword.scope === 'file');
        this.records.splice(idx, 1);
        if (fileKeywords.length) {
            const first = this.records[0];
            const existing = new Set(first.keywords
                .filter(keyword => keyword.scope === 'file')
                .map(keyword => `${keyword.name}\0${keyword.args.join('\0')}`));
            first.keywords.unshift(...fileKeywords.filter(keyword =>
                !existing.has(`${keyword.name}\0${keyword.args.join('\0')}`)));
        }
        if (idx < this.activeRecordIndex) this.activeRecordIndex--;
        else if (this.activeRecordIndex >= this.records.length)
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

    addItems (items) {
        const created = (items ?? []).map(overrides => makeItem(overrides));
        if (!created.length) return [];
        this.activeRecord.items.push(...created);
        this.emit();
        return created;
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
        // Clamp to grid + minimum field length.
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
            sourceName: this.sourceName,
            activeRecordIndex: this.activeRecordIndex,
            showOverlay: this.showOverlay,
            hideConditioned: this.hideConditioned,
            records: this.records.map(r => ({
                name: r.name,
                type: r.type,
                keywords: r.keywords.map(kw => ({
                    ...kw,
                    args: kw.args.slice(),
                    indicators: kw.indicators.slice(),
                    conditionLines: cloneConditionLines(kw.conditionLines),
                })),
                helpSpecs: (r.helpSpecs ?? []).map(spec => ({
                    keywords: (spec.keywords ?? []).map(kw => ({
                        ...kw,
                        args: kw.args.slice(),
                        indicators: kw.indicators.slice(),
                        conditionLines: cloneConditionLines(kw.conditionLines),
                    })),
                })),
                items: r.items.map(it => ({
                    ...it,
                    conditionLines: cloneConditionLines(it.conditionLines),
                    alternateLocations: (it.alternateLocations ?? []).map(
                        location => ({ ...location })),
                    keywords:   it.keywords.map(kw => ({
                        ...kw,
                        args: kw.args.slice(),
                        indicators: kw.indicators.slice(),
                        conditionLines: cloneConditionLines(kw.conditionLines),
                    })),
                    indicators: it.indicators.slice(),
                })),
            })),
        };
    }

    static fromJSON (data) {
        data = data && typeof data === 'object' ? data : {};
        const doc = new DspfDocument();
        doc.modelKey    = MODELS[data.modelKey] ? data.modelKey : '24x80';
        doc.sourceName  = ibmiName(data.sourceName, 'DSPFILE');
        doc.showOverlay = !!data.showOverlay;
        doc.hideConditioned = !!data.hideConditioned;
        const usedIds = new Set();
        const recs = (Array.isArray(data.records) ? data.records : []).map(r => makeRecord({
            name: r.name, type: r.type, keywords: r.keywords,
            helpSpecs: r.helpSpecs,
            items: (Array.isArray(r.items) ? r.items : []).map(raw => {
                const overrides = { ...raw };
                if (!overrides.id || usedIds.has(overrides.id)) overrides.id = null;
                const item = makeItem(overrides);
                usedIds.add(item.id);
                return item;
            }),
        }));
        doc.records = recs.length ? recs : [makeRecord({ name: 'MAIN' })];
        doc.activeRecordIndex = clampRecordIndex(
            data.activeRecordIndex, doc.records.length);
        return doc;
    }
}

function cloneConditionLines (lines) {
    return (lines ?? []).map(line => ({
        conditionOp: line.conditionOp ?? '',
        indicators: (line.indicators ?? []).slice(),
    }));
}

function modelSizeKeyword (key) {
    return key === '27x132'
        ? { name: 'DSPSIZ', args: ['27', '132', '*DS4'], indicators: [], scope: 'file' }
        : { name: 'DSPSIZ', args: ['24', '80', '*DS3'], indicators: [], scope: 'file' };
}

function updateRecordReferences (records, oldName, newName) {
    const updateKeyword = keyword => {
        const refIndex = keyword.name === 'MNUBARCHC' ? 1 : 0;
        const recordRefKeywords = new Set([
            'SFLCTL', 'MNUBARDSP', 'MNUBARCHC', 'HLPRCD',
        ]);
        if (recordRefKeywords.has(keyword.name) && keyword.args?.[refIndex] === oldName) {
            keyword.args[refIndex] = newName;
        }
        if (keyword.name === 'WINDOW' && keyword.args?.length === 1 &&
            keyword.args[0] === oldName) {
            keyword.args[0] = newName;
        }
    };
    for (const record of records) {
        for (const keyword of record.keywords ?? []) updateKeyword(keyword);
        for (const spec of record.helpSpecs ?? []) {
            for (const keyword of spec.keywords ?? []) updateKeyword(keyword);
        }
        for (const item of record.items ?? []) {
            for (const keyword of item.keywords ?? []) updateKeyword(keyword);
        }
    }
}

function clampRecordIndex (value, length) {
    const n = Number.isInteger(value) ? value : 0;
    return Math.min(Math.max(n, 0), Math.max(0, length - 1));
}
