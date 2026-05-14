// Property panel with two tabs: "Item" (for the currently selected
// item) and "Record" (for the active record format).  Plain DOM, no
// framework.  All edits go through the provided callbacks - the
// Inspector mutates keyword lists directly but always calls `onChange`
// afterwards so the document emits a change event.

import { DSPATR_FLAGS, COLORS, EDTCDE, DATA_TYPES, USAGES } from './Attributes.js';
import { RECORD_TYPES } from './DspfModel.js';
import {
    flagsOf, valueOf, setFlag, setSingle,
    addKeyword, removeWhere,
    parseIndicatorTokens, formatIndicatorTokens,
} from './Keywords.js';

const ITEM_PRIMARY_KW = new Set(['DSPATR', 'COLOR', 'EDTCDE']);

export class Inspector {
    constructor (rootEl, {
        documentRef, activeRecordRef,
        onItemPatch, onItemDelete, onRecordPatch,
        onChange, onSelectItem,
    }) {
        this.root            = rootEl;
        this.documentRef     = documentRef;
        this.activeRecordRef = activeRecordRef;
        this.onItemPatch     = onItemPatch;
        this.onItemDelete    = onItemDelete;
        this.onRecordPatch   = onRecordPatch;
        this.onChange        = onChange;
        this.onSelectItem    = onSelectItem;

        this.activeTab    = 'item';
        this.selectedItem = null;
    }

    setSelection (item) {
        this.selectedItem = item;
        this.render();
    }

    setTab (tab) {
        if (tab !== 'item' && tab !== 'record') return;
        this.activeTab = tab;
        this.render();
    }

    render () {
        this.root.innerHTML = '';

        // Tab strip.
        const tabs = document.createElement('div');
        tabs.className = 'insp-tabs';
        for (const [tab, label] of [['item', 'Item'], ['record', 'Record']]) {
            const btn = document.createElement('button');
            btn.className = 'insp-tab' + (this.activeTab === tab ? ' active' : '');
            btn.textContent = label;
            btn.addEventListener('click', () => this.setTab(tab));
            tabs.appendChild(btn);
        }
        this.root.appendChild(tabs);

        const pane = document.createElement('div');
        pane.className = 'insp-pane';
        this.root.appendChild(pane);

        if (this.activeTab === 'item') this._renderItemPane(pane);
        else                            this._renderRecordPane(pane);
    }

    // ------------------------------------------------------------------
    // ITEM tab
    // ------------------------------------------------------------------
    _renderItemPane (pane) {
        const item = this.selectedItem;
        if (!item) {
            const p = document.createElement('p');
            p.className = 'empty';
            p.textContent = 'No item selected.';
            pane.appendChild(p);
            return;
        }
        const doc = this.documentRef();

        // Position
        this._section(pane, 'Position', [
            this._numField(item, 'row', 'Row',
                v => this._patchItem(item.id, { row: v }), 1, doc.rows),
            this._numField(item, 'col', 'Col',
                v => this._patchItem(item.id, { col: v }), 1, doc.cols),
        ]);

        // Type-specific
        if (item.kind === 'constant') {
            this._section(pane, 'Constant', [
                this._textField(item, 'text', 'Text',
                    v => this._patchItem(item.id, { text: v })),
            ]);
        } else if (item.kind === 'sysvalue') {
            const sysSel = document.createElement('select');
            for (const n of ['DATE', 'TIME', 'USER', 'SYSNAME', 'USRNAME',
                             'DATEUSA', 'TIMEUSA', 'EUROPE', 'JOBNAME', 'NETID']) {
                const opt = document.createElement('option');
                opt.value = n; opt.textContent = n;
                sysSel.appendChild(opt);
            }
            sysSel.value = item.sysName || 'DATE';
            sysSel.addEventListener('change', () => {
                // Replace the head sysvalue keyword too so the writer
                // emits the new name on the row/col line.
                const oldName = item.sysName;
                item.sysName = sysSel.value;
                if (item.keywords?.[0]?.name === oldName) {
                    item.keywords[0].name = sysSel.value;
                }
                this.onChange?.();
            });
            this._section(pane, 'System value', [
                this._row('Name', sysSel),
            ]);
        } else {
            this._section(pane, 'Field', [
                this._textField(item, 'name', 'Name',
                    v => this._patchItem(item.id, {
                        name: v.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 10),
                    })),
                this._numField(item, 'length', 'Length',
                    v => this._patchItem(item.id, { length: v }), 1, doc.cols),
                this._selField(item, 'usage', 'Usage', USAGES,
                    v => this._patchItem(item.id, { usage: v })),
                this._selField(item, 'dataType', 'Data type', DATA_TYPES,
                    v => this._patchItem(item.id, { dataType: v })),
                this._numField(item, 'decimals', 'Decimals',
                    v => this._patchItem(item.id, { decimals: v }), 0, 31),
            ]);
        }

        // Item-level "convenience" sections for the most common keywords.
        this._renderTextDescItem(pane, item);
        if (item.refField) this._renderRefFldSection(pane, item);
        this._renderDftValSection(pane, item);
        this._renderValidationSection(pane, item);
        this._renderEditWordSection(pane, item);
        if (item.kind === 'field' && (item.dataType === 'L' || item.dataType === 'T')) {
            this._renderDateTimeFormatSection(pane, item);
        }
        this._renderCheckSection(pane, item);
        if (item.kind === 'field') this._renderChoiceListSection(pane, item);

        // Item-level indicators
        const indSec = this._sectionStart(pane, 'Conditioning');
        indSec.appendChild(this._row('Indicators',
            this._indicatorsInput(item.indicators, arr => {
                item.indicators = arr;
                this.onChange?.();
            })));

        // DSPATR chips
        const dspSec = this._sectionStart(pane, 'DSPATR');
        const chips = document.createElement('div');
        chips.className = 'insp-chips';
        const activeFlags = flagsOf(item, 'DSPATR');
        for (const [flag, label] of Object.entries(DSPATR_FLAGS)) {
            const chip = document.createElement('span');
            const on = activeFlags.includes(flag);
            chip.className = 'insp-chip' + (on ? ' on' : '');
            chip.textContent = flag;
            chip.title = label;
            chip.addEventListener('click', () => {
                setFlag(item, 'DSPATR', flag, !on);
                this.onChange?.();
            });
            chips.appendChild(chip);
        }
        dspSec.appendChild(chips);

        // COLOR
        const colorOpts = [{ value: '', label: '(default GRN)' },
            ...Object.entries(COLORS).map(([v, l]) => ({ value: v, label: `${v} · ${l}` }))];
        this._section(pane, 'Color', [
            this._selRawField(colorOpts, valueOf(item, 'COLOR') ?? '',
                v => { setSingle(item, 'COLOR', v || null); this.onChange?.(); }),
        ]);

        // EDTCDE (fields only)
        if (item.kind === 'field') {
            const edtOpts = EDTCDE.map(c => ({ value: c, label: c || '(none)' }));
            this._section(pane, 'Edit code', [
                this._selRawField(edtOpts, valueOf(item, 'EDTCDE') ?? '',
                    v => { setSingle(item, 'EDTCDE', v || null); this.onChange?.(); }),
            ]);
        }

        // Other keywords (anything not handled by chips/selects above).
        const otherSec = this._sectionStart(pane, 'Other keywords');
        const others = item.keywords.filter(kw => !ITEM_PRIMARY_KW.has(kw.name));
        if (others.length === 0) this._emptyNote(otherSec, 'No other keywords.');
        for (const kw of others) {
            otherSec.appendChild(this._renderKeywordEditor(item, kw));
        }
        otherSec.appendChild(this._addKeywordButton(item));

        // Actions
        const actions = document.createElement('div');
        actions.className = 'insp-actions';
        const del = document.createElement('button');
        del.className = 'danger';
        del.textContent = 'Delete';
        del.title = 'Remove this item (Del / Backspace)';
        del.addEventListener('click', () => this.onItemDelete(item.id));
        actions.appendChild(del);
        pane.appendChild(actions);
    }

    // ------------------------------------------------------------------
    // RECORD tab
    // ------------------------------------------------------------------
    _renderRecordPane (pane) {
        const rec = this.activeRecordRef();
        if (!rec) {
            this._emptyNote(pane, 'No active record.');
            return;
        }

        // Identity (name + type)
        const nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.value = rec.name;
        nameInp.maxLength = 10;
        nameInp.addEventListener('change', () =>
            this.onRecordPatch({ name: nameInp.value }));
        const typeSel = document.createElement('select');
        for (const [k, info] of Object.entries(RECORD_TYPES)) {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = info.label;
            typeSel.appendChild(opt);
        }
        typeSel.value = rec.type;
        typeSel.addEventListener('change', () =>
            this.onRecordPatch({ type: typeSel.value }));
        this._section(pane, 'Identity', [
            this._row('Name', nameInp),
            this._row('Type', typeSel),
        ]);

        // Stats
        const stats = this._sectionStart(pane, 'Stats');
        const sLine = document.createElement('div');
        sLine.style.color = '#888';
        sLine.style.fontSize = '11px';
        sLine.style.fontFamily = 'monospace';
        sLine.textContent = `${rec.items.length} item${rec.items.length === 1 ? '' : 's'} · ${rec.keywords.length} keyword${rec.keywords.length === 1 ? '' : 's'}`;
        stats.appendChild(sLine);

        // Subfile-specific shortcut form when the record is SFL/SFLCTL.
        if (rec.type === 'SFL' || rec.type === 'SFLCTL') {
            this._renderSubfileSection(pane, rec);
        }
        if (rec.type === 'WINDOW') {
            this._renderWindowSpecSection(pane, rec);
        }
        this._renderFunctionKeysSection(pane, rec);
        this._renderRecordOptionsSection(pane, rec);
        this._renderEntryDefaultsSection(pane, rec);
        this._renderCursorBindingSection(pane, rec);
        this._renderMouseButtonsSection(pane, rec);
        this._renderMnubarDspSection(pane, rec);
        this._renderHelpSection(pane, rec);
        if (rec === this.documentRef().records[0]) {
            this._renderFileOptionsSection(pane, rec);
            this._renderFileMiscSection(pane, rec);
        }

        // Record-level keywords (catch-all for what no dedicated section covers)
        const kwSec = this._sectionStart(pane, 'Keywords');
        if (rec.keywords.length === 0) this._emptyNote(kwSec, 'No record-level keywords.');
        for (const kw of rec.keywords) {
            kwSec.appendChild(this._renderKeywordEditor(rec, kw));
        }
        kwSec.appendChild(this._addKeywordButton(rec));

        // Items list - especially useful for hidden fields and for big
        // records like CLOCK where dozens of conditioned figlet items
        // dominate.  Sort so fields/sysvalues/widgets float above the
        // constants; tag each row with kind + indicator badge.  When the
        // "Hide cond" toggle is on we also collapse the conditioned ones
        // to a single "+N conditioned" entry at the bottom.
        const itSec = this._sectionStart(pane, 'Items');
        if (rec.items.length === 0) {
            this._emptyNote(itSec, 'No items in this record.');
        } else {
            const doc = this.documentRef();
            const hideCnd = !!doc.hideConditioned;
            const kindWeight = it =>
                it.kind === 'field'    ? 0 :
                it.kind === 'sysvalue' ? 1 :
                                         2;
            const sorted = rec.items.slice().sort((a, b) => {
                const ac = !!a.indicators?.length, bc = !!b.indicators?.length;
                if (ac !== bc) return ac ? 1 : -1;     // unconditioned first
                if (kindWeight(a) !== kindWeight(b)) return kindWeight(a) - kindWeight(b);
                if (a.row !== b.row) return a.row - b.row;
                return a.col - b.col;
            });
            const visible = hideCnd ? sorted.filter(it => !it.indicators?.length) : sorted;
            const hidden  = hideCnd ? sorted.filter(it => !!it.indicators?.length) : [];

            const list = document.createElement('div');
            list.className = 'insp-itemlist';
            for (const it of visible) {
                const row = document.createElement('button');
                row.className = 'insp-itemrow';
                row.type = 'button';
                const tag = document.createElement('span');
                const tagClass =
                    it.kind === 'constant' ? 'tag-constant' :
                    it.kind === 'sysvalue' ? 'tag-sysvalue' :
                    it.usage === 'H'       ? 'tag-hidden'   :
                    it.usage === 'P'       ? 'tag-hidden'   : 'tag-field';
                tag.className = 'insp-itemrow-tag ' + tagClass;
                tag.textContent =
                    it.kind === 'constant' ? 'C' :
                    it.kind === 'sysvalue' ? 'S' :
                    it.usage === 'H'       ? 'H' :
                    it.usage === 'P'       ? 'P' : 'F';
                row.appendChild(tag);
                const label = document.createElement('span');
                label.className = 'insp-itemrow-label';
                label.textContent =
                    it.kind === 'constant' ? `"${(it.text || '').slice(0, 20)}"` :
                    it.kind === 'sysvalue' ? `<${it.sysName || '?'}>` :
                    (it.name || '(unnamed)');
                row.appendChild(label);
                const pos = document.createElement('span');
                pos.className = 'insp-itemrow-pos';
                const indMark = it.indicators?.length ? ` [${it.indicators.join(',')}]` : '';
                pos.textContent = `${it.row},${it.col}${indMark}`;
                row.appendChild(pos);
                row.addEventListener('click', () => {
                    this.activeTab = 'item';
                    this.onSelectItem?.(it.id);
                });
                list.appendChild(row);
            }
            if (hidden.length) {
                const note = document.createElement('p');
                note.className = 'empty';
                note.style.padding = '4px 0';
                note.textContent = `+ ${hidden.length} conditioned item${hidden.length === 1 ? '' : 's'} hidden (toggle "Hide cond" off to list).`;
                itSec.appendChild(note);
            }
            itSec.appendChild(list);
        }
    }

    // ------------------------------------------------------------------
    // Subfile-focused form (SFL / SFLCTL records)
    // ------------------------------------------------------------------
    _renderSubfileSection (pane, rec) {
        const doc = this.documentRef();
        const sec = this._sectionStart(pane, rec.type === 'SFL' ? 'Subfile (SFL)' : 'Subfile control (SFLCTL)');

        const getKw  = (name) => rec.keywords.find(kw => kw.name === name);
        const setSingleKw = (name, value) => {
            const i = rec.keywords.findIndex(kw => kw.name === name);
            if (value == null || value === '') {
                if (i >= 0) rec.keywords.splice(i, 1);
            } else if (i >= 0) {
                rec.keywords[i].args = [String(value)];
            } else {
                rec.keywords.push({ name, args: [String(value)], indicators: [] });
            }
            this.onChange?.();
        };
        const setIndKw = (name, indicator) => {
            const i = rec.keywords.findIndex(kw => kw.name === name);
            const inds = indicator ? [indicator] : [];
            if (i >= 0) rec.keywords[i].indicators = inds;
            else        rec.keywords.push({ name, args: [], indicators: inds });
            this.onChange?.();
        };

        if (rec.type === 'SFLCTL') {
            // Linked SFL chooser
            const sflSel = document.createElement('select');
            for (const r of doc.records) {
                if (r.type !== 'SFL') continue;
                const opt = document.createElement('option');
                opt.value = r.name; opt.textContent = r.name;
                sflSel.appendChild(opt);
            }
            const linkKw = getKw('SFLCTL');
            sflSel.value = linkKw?.args?.[0] ?? '';
            sflSel.addEventListener('change', () => setSingleKw('SFLCTL', sflSel.value));
            sec.appendChild(this._row('Linked SFL', sflSel));

            // SFLPAG / SFLSIZ
            const pagInp = document.createElement('input');
            pagInp.type = 'number'; pagInp.min = 1; pagInp.max = 9999;
            pagInp.value = parseInt(getKw('SFLPAG')?.args?.[0], 10) || 14;
            pagInp.addEventListener('change', () =>
                setSingleKw('SFLPAG', String(parseInt(pagInp.value, 10) || 14).padStart(4, '0')));
            sec.appendChild(this._row('SFLPAG', pagInp));

            const sizInp = document.createElement('input');
            sizInp.type = 'number'; sizInp.min = 1; sizInp.max = 9999;
            sizInp.value = parseInt(getKw('SFLSIZ')?.args?.[0], 10) || 15;
            sizInp.addEventListener('change', () =>
                setSingleKw('SFLSIZ', String(parseInt(sizInp.value, 10) || 15).padStart(4, '0')));
            sec.appendChild(this._row('SFLSIZ', sizInp));

            // Indicator-driven flags
            const indFlag = (label, name, defaultInd) => {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.placeholder = `e.g. ${defaultInd}`;
                inp.value = getKw(name)?.indicators?.[0] ?? '';
                inp.title = `Indicator that activates ${name}`;
                inp.className = 'insp-ind';
                inp.addEventListener('change', () => setIndKw(name, inp.value.toUpperCase().trim()));
                sec.appendChild(this._row(label, inp));
            };
            indFlag('SFLDSP',    'SFLDSP',    '31');
            indFlag('SFLDSPCTL', 'SFLDSPCTL', '32');
            indFlag('SFLCLR',    'SFLCLR',    '30');
            indFlag('SFLEND',    'SFLEND',    '80');
            indFlag('SFLDLT',    'SFLDLT',    '');
            indFlag('SFLINZ',    'SFLINZ',    '');

            // SFLMODE(&VAR;) and SFLCSRRRN(&VAR;) carry program-bound
            // variable refs.  Plain text input - the user types `&NAME;`.
            const varInput = (label, name, placeholder) => {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.placeholder = placeholder;
                inp.value = getKw(name)?.args?.[0] ?? '';
                inp.addEventListener('change', () => setSingleKw(name, inp.value.trim()));
                sec.appendChild(this._row(label, inp));
            };
            varInput('SFLMODE',  'SFLMODE',  '&MODE;');
            varInput('SFLCSRRRN', 'SFLCSRRRN', '&RRN;');

            // Message-subfile pattern (SFLMSGRCD + SFLMSGKEY + SFLPGMQ).
            // When SFLMSGRCD is present, this SFLCTL drives a message
            // status line instead of a scrolling list of records.
            const isMsg = !!getKw('SFLMSGRCD');
            const msgSub = document.createElement('div');
            msgSub.style.borderTop = '1px dashed #2a4a2a';
            msgSub.style.marginTop = '6px';
            msgSub.style.paddingTop = '6px';
            const hdr = document.createElement('div');
            hdr.style.color = '#cca844';
            hdr.style.fontSize = '11px';
            hdr.style.fontFamily = 'monospace';
            hdr.textContent = isMsg ? '◆ Message subfile mode' : 'Message subfile (optional)';
            msgSub.appendChild(hdr);
            sec.appendChild(msgSub);
            const msgRowInp = document.createElement('input');
            msgRowInp.type = 'number'; msgRowInp.min = 1; msgRowInp.max = 27;
            msgRowInp.value = parseInt(getKw('SFLMSGRCD')?.args?.[0], 10) || '';
            msgRowInp.placeholder = 'row (e.g. 24)';
            msgRowInp.addEventListener('change', () =>
                setSingleKw('SFLMSGRCD', msgRowInp.value.trim()));
            sec.appendChild(this._row('SFLMSGRCD', msgRowInp));
            varInput('SFLMSGKEY', 'SFLMSGKEY', 'msg key field');
            varInput('SFLPGMQ',   'SFLPGMQ',   'pgm queue field');

            // SFLEND has args that decide the visual mode of the end
            // marker: *MORE / *PLUS (text) or *SCRBAR (scrollbar widget).
            // IBM allows combinations like "*SCRBAR *MORE".  Toggle chips
            // mutate the SFLEND keyword's args directly.
            const sflendKw = getKw('SFLEND');
            const sflendArgs = ((sflendKw?.args ?? []).map(a => String(a).toUpperCase()));
            const modes = ['*MORE', '*PLUS', '*SCRBAR'];
            const chips = document.createElement('div');
            chips.className = 'insp-chips';
            for (const mode of modes) {
                const on = sflendArgs.includes(mode);
                const chip = document.createElement('span');
                chip.className = 'insp-chip' + (on ? ' on' : '');
                chip.textContent = mode;
                chip.title = mode === '*SCRBAR'
                    ? 'Render an ENPTUI scroll bar at the right edge of the subfile'
                    : `Display "${mode.replace('*', '')}" in the corner when the subfile has more records`;
                chip.addEventListener('click', () => {
                    let kw = rec.keywords.find(k => k.name === 'SFLEND');
                    if (!kw) {
                        kw = { name: 'SFLEND', args: [], indicators: [] };
                        rec.keywords.push(kw);
                    }
                    const i = kw.args.findIndex(a => String(a).toUpperCase() === mode);
                    if (i >= 0) kw.args.splice(i, 1);
                    else        kw.args.push(mode);
                    this.onChange?.();
                });
                chips.appendChild(chip);
            }
            sec.appendChild(this._row('SFLEND mode', chips));
        } else {
            // SFL record - the linked CTL is whichever SFLCTL references it.
            const ctl = doc.records.find(r =>
                r.type === 'SFLCTL' &&
                r.keywords.some(kw => kw.name === 'SFLCTL' && kw.args[0] === rec.name));
            const info = document.createElement('div');
            info.style.fontSize = '11px';
            info.style.fontFamily = 'monospace';
            info.style.color = ctl ? '#6cf' : '#cc6';
            info.style.padding = '4px 0';
            info.textContent = ctl
                ? `Controlled by ${ctl.name} (SFLCTL).`
                : `No SFLCTL references this SFL yet.  Add a SFLCTL record with SFLCTL(${rec.name}).`;
            sec.appendChild(info);

            // Indicator-driven flags applicable to the SFL row template.
            const indFlag = (label, name) => {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.placeholder = 'indicator';
                inp.value = getKw(name)?.indicators?.[0] ?? '';
                inp.className = 'insp-ind';
                inp.addEventListener('change', () => setIndKw(name, inp.value.toUpperCase().trim()));
                sec.appendChild(this._row(label, inp));
            };
            indFlag('SFLNXTCHG', 'SFLNXTCHG');
            // CHANGE(N) sets an indicator when the user edits a row -
            // mostly used at field level, but we expose it record-level
            // too for completeness.
            const changeKw = getKw('CHANGE');
            const chgInp = document.createElement('input');
            chgInp.type = 'text';
            chgInp.placeholder = 'e.g. 49';
            chgInp.value = changeKw?.args?.[0] ?? '';
            chgInp.title = 'Indicator set when the row is changed at runtime';
            chgInp.addEventListener('change', () => setSingleKw('CHANGE', chgInp.value.trim()));
            sec.appendChild(this._row('CHANGE', chgInp));
        }
    }

    // ------------------------------------------------------------------
    // Keyword editor cards (shared between Item.Other and Record tabs)
    // ------------------------------------------------------------------
    _renderKeywordEditor (target, kw) {
        const card = document.createElement('div');
        card.className = 'insp-kw';

        const head = document.createElement('div');
        head.className = 'insp-kw-head';

        const nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.value = kw.name;
        nameInp.placeholder = 'NAME';
        nameInp.title = 'Keyword name';
        nameInp.addEventListener('change', () => {
            kw.name = nameInp.value.toUpperCase().slice(0, 10);
            this.onChange?.();
        });
        head.appendChild(nameInp);

        const rm = document.createElement('button');
        rm.textContent = '×';
        rm.className = 'insp-kw-rm';
        rm.title = 'Remove keyword';
        rm.addEventListener('click', () => {
            removeWhere(target, k => k === kw);
            this.onChange?.();
        });
        head.appendChild(rm);
        card.appendChild(head);

        const argsInp = document.createElement('input');
        argsInp.type = 'text';
        argsInp.value = kw.args.join(' ');
        argsInp.placeholder = 'args';
        argsInp.title = 'Keyword arguments (space-separated)';
        argsInp.addEventListener('change', () => {
            kw.args = argsInp.value.trim().split(/\s+/).filter(Boolean);
            this.onChange?.();
        });
        card.appendChild(argsInp);

        const indInp = this._indicatorsInput(kw.indicators, arr => {
            kw.indicators = arr;
            this.onChange?.();
        });
        indInp.classList.add('insp-kw-ind');
        card.appendChild(indInp);

        return card;
    }

    _addKeywordButton (target) {
        const btn = document.createElement('button');
        btn.className = 'insp-add-kw';
        btn.textContent = '+ Add keyword';
        btn.addEventListener('click', () => {
            const name = prompt('Keyword name (e.g. OVERLAY, REFFLD, SFLPAG):', '');
            if (!name) return;
            addKeyword(target, { name: name.toUpperCase().trim(), args: [], indicators: [] });
            this.onChange?.();
        });
        return btn;
    }

    // ==================================================================
    // Convenience sections (record-level) - shortcuts for common keywords
    // ==================================================================

    /** Strip a layer of single-quote escaping for IBM-style 'literal'. */
    _stripQuotes (s) {
        if (!s) return '';
        const t = String(s).trim();
        if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
            return t.substring(1, t.length - 1).replace(/''/g, "'");
        }
        return t;
    }
    _quote (s) {
        return s == null ? '' : `'${String(s).replace(/'/g, "''")}'`;
    }

    /** Strip {target.keywords: [{name,...}, ...]} of every entry with the
     *  given name; returns the count removed. */
    _removeKeyword (target, name) {
        let n = 0;
        for (let i = target.keywords.length - 1; i >= 0; i--) {
            if (target.keywords[i].name === name) { target.keywords.splice(i, 1); n++; }
        }
        return n;
    }

    /** Generic "row of presence-only chips" - clicking toggles whether a
     *  bare keyword is on the target. */
    _renderPresenceChips (sec, target, names, titles = {}) {
        const chips = document.createElement('div');
        chips.className = 'insp-chips';
        for (const name of names) {
            const on = target.keywords.some(k => k.name === name);
            const chip = document.createElement('span');
            chip.className = 'insp-chip' + (on ? ' on' : '');
            chip.textContent = name;
            if (titles[name]) chip.title = titles[name];
            chip.addEventListener('click', () => {
                const idx = target.keywords.findIndex(k => k.name === name);
                if (idx >= 0) target.keywords.splice(idx, 1);
                else          target.keywords.push({ name, args: [], indicators: [] });
                this.onChange?.();
            });
            chips.appendChild(chip);
        }
        sec.appendChild(chips);
    }

    _renderWindowSpecSection (pane, rec) {
        const sec = this._sectionStart(pane, 'Window placement');
        let win = rec.keywords.find(k => k.name === 'WINDOW');
        if (!win) {
            win = { name: 'WINDOW', args: ['5', '10', '10', '40'], indicators: [] };
            rec.keywords.push(win);
        }
        // Mode: explicit / *DFT / *REL
        const modeOf = (a) => a[0] === '*DFT' ? '*DFT' : a[0] === '*REL' ? '*REL' : 'explicit';
        const parseWin = (a) => {
            if (a[0] === '*DFT') return { mode:'*DFT', top:'', left:'',
                rows:a[1]??'', cols:a[2]??'', extra:a.slice(3) };
            if (a[0] === '*REL') return { mode:'*REL', top:a[1]??'', left:a[2]??'',
                rows:a[3]??'', cols:a[4]??'', extra:a.slice(5) };
            return { mode:'explicit', top:a[0]??'', left:a[1]??'',
                rows:a[2]??'', cols:a[3]??'', extra:a.slice(4) };
        };
        const rebuild = (spec) => {
            const out = [];
            if (spec.mode === '*DFT')      out.push('*DFT', String(spec.rows||5), String(spec.cols||30));
            else if (spec.mode === '*REL') out.push('*REL', String(spec.top||1), String(spec.left||1), String(spec.rows||5), String(spec.cols||30));
            else                            out.push(String(spec.top||1), String(spec.left||1), String(spec.rows||5), String(spec.cols||30));
            for (const e of spec.extra) out.push(e);
            win.args = out;
            this.onChange?.();
        };

        const cur = parseWin(win.args);
        const modeSel = document.createElement('select');
        for (const m of ['explicit', '*DFT', '*REL']) {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            modeSel.appendChild(opt);
        }
        modeSel.value = cur.mode;
        modeSel.addEventListener('change', () => rebuild({ ...cur, mode: modeSel.value }));
        sec.appendChild(this._row('Mode', modeSel));

        const mkNum = (label, key, disabled) => {
            const inp = document.createElement('input');
            inp.type = 'number'; inp.min = 1;
            inp.value = cur[key] || '';
            inp.disabled = !!disabled;
            inp.addEventListener('change', () =>
                rebuild({ ...parseWin(win.args), [key]: inp.value }));
            sec.appendChild(this._row(label, inp));
        };
        mkNum('Top',  'top',  cur.mode === '*DFT');
        mkNum('Left', 'left', cur.mode === '*DFT');
        mkNum('Rows', 'rows', false);
        mkNum('Cols', 'cols', false);

        // Border colour from WDWBORDER((*COLOR XXX))
        const borderKw = rec.keywords.find(k => k.name === 'WDWBORDER');
        const borderArgs = (borderKw?.args ?? []).join(' ');
        const cMatch = borderArgs.match(/\*COLOR\s+([A-Z]+)/i);
        const colorSel = document.createElement('select');
        for (const c of ['', 'GRN','WHT','RED','TRQ','YLW','PNK','BLU']) {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c || '(default purple)';
            colorSel.appendChild(opt);
        }
        colorSel.value = cMatch?.[1].toUpperCase() ?? '';
        colorSel.addEventListener('change', () => {
            this._removeKeyword(rec, 'WDWBORDER');
            if (colorSel.value) {
                rec.keywords.push({
                    name: 'WDWBORDER',
                    args: [`(*COLOR ${colorSel.value})`],
                    indicators: [],
                });
            }
            this.onChange?.();
        });
        sec.appendChild(this._row('Border', colorSel));

        // Title editor
        let titleKw = rec.keywords.find(k => k.name === 'WDWTITLE');
        const titleArgs = titleKw?.args ?? [];
        const titleText = (() => {
            if (!titleArgs[0]) return '';
            const m = String(titleArgs[0]).match(/\*TEXT\s+'([^']*)'/);
            if (m) return m[1];
            const v = String(titleArgs[0]).match(/\*TEXT\s+&([A-Z0-9_]+);?/i);
            if (v) return `&${v[1]};`;
            return this._stripQuotes(titleArgs[0]);
        })();
        const titleInp = document.createElement('input');
        titleInp.type = 'text';
        titleInp.value = titleText;
        titleInp.placeholder = "title text or '&VAR;'";
        const saveTitle = () => {
            const v = titleInp.value.trim();
            this._removeKeyword(rec, 'WDWTITLE');
            if (v) {
                const wrapped = v.startsWith('&')
                    ? `(*TEXT ${v})`
                    : `(*TEXT '${v.replace(/'/g, "''")}')`;
                const newArgs = [wrapped, ...placementTokens()];
                rec.keywords.push({ name: 'WDWTITLE', args: newArgs, indicators: [] });
            }
            this.onChange?.();
        };
        titleInp.addEventListener('change', saveTitle);
        sec.appendChild(this._row('Title', titleInp));

        // Title placement chips
        const placementBox = document.createElement('div');
        placementBox.className = 'insp-chips';
        const placements = [['*TOP','top vert'], ['*BOTTOM','bot vert'],
                            ['*LEFT','left horz'], ['*CENTER','centre horz'], ['*RIGHT','right horz']];
        const curArgsUpper = titleArgs.slice(1).map(a => String(a).toUpperCase());
        const placementTokens = () => {
            const tokens = [];
            for (const c of placementBox.querySelectorAll('.insp-chip.on')) {
                tokens.push(c.textContent);
            }
            return tokens;
        };
        for (const [p, tip] of placements) {
            const on = curArgsUpper.includes(p);
            const chip = document.createElement('span');
            chip.className = 'insp-chip' + (on ? ' on' : '');
            chip.textContent = p;
            chip.title = tip;
            chip.addEventListener('click', () => {
                chip.classList.toggle('on');
                // Mutually exclusive within each axis: TOP/BOTTOM and LEFT/CENTER/RIGHT
                if (chip.classList.contains('on')) {
                    const others = (p === '*TOP' || p === '*BOTTOM')
                        ? ['*TOP', '*BOTTOM'].filter(x => x !== p)
                        : ['*LEFT', '*CENTER', '*RIGHT'].filter(x => x !== p);
                    for (const c of placementBox.querySelectorAll('.insp-chip')) {
                        if (others.includes(c.textContent)) c.classList.remove('on');
                    }
                }
                // Persist by re-saving title
                if (titleInp.value.trim()) saveTitle();
                else {
                    // Even with no text, we may still want to set placement
                    // for future-typed titles; skip.
                }
            });
            placementBox.appendChild(chip);
        }
        sec.appendChild(this._row('Placement', placementBox));

        // WINDOW flags - *NOMSGLIN / *NORSTCSR are passed as trailing
        // args of WINDOW(...).  Toggle chips manipulate the win.args list
        // by rewriting via rebuild().
        const flagsRow = document.createElement('div');
        flagsRow.className = 'insp-chips';
        const winFlags = ['*NOMSGLIN', '*NORSTCSR'];
        const curExtra = parseWin(win.args).extra.map(a => String(a).toUpperCase());
        for (const f of winFlags) {
            const on = curExtra.includes(f);
            const chip = document.createElement('span');
            chip.className = 'insp-chip' + (on ? ' on' : '');
            chip.textContent = f;
            chip.title = f === '*NOMSGLIN'
                ? 'Suppress the message line inside the window'
                : 'Do not restore cursor position when the window closes';
            chip.addEventListener('click', () => {
                const cur2 = parseWin(win.args);
                const ext = cur2.extra.slice();
                const i = ext.findIndex(a => String(a).toUpperCase() === f);
                if (i >= 0) ext.splice(i, 1);
                else        ext.push(f);
                rebuild({ ...cur2, extra: ext });
            });
            flagsRow.appendChild(chip);
        }
        sec.appendChild(this._row('Flags', flagsRow));
    }

    _renderFunctionKeysSection (pane, rec) {
        const aidRe = /^(C[AF]\d{1,2}|HELP|HOME|ROLLUP|ROLLDOWN|PAGEUP|PAGEDOWN|ALTPAGEUP|ALTPAGEDWN|ALTHELP|PRINT|CLEAR|RETKEY|MNUCNL)$/;
        const aids = rec.keywords.filter(k => aidRe.test(k.name));
        const sec = this._sectionStart(pane, 'Function keys');
        if (aids.length === 0) this._emptyNote(sec, 'No function keys.');
        for (const kw of aids) {
            const card = document.createElement('div');
            card.className = 'insp-kw';
            const head = document.createElement('div');
            head.className = 'insp-kw-head';
            const nameLbl = document.createElement('input');
            nameLbl.type = 'text'; nameLbl.value = kw.name;
            nameLbl.addEventListener('change', () => {
                kw.name = nameLbl.value.toUpperCase().slice(0, 10);
                this.onChange?.();
            });
            const rm = document.createElement('button');
            rm.textContent = '×'; rm.className = 'insp-kw-rm';
            rm.addEventListener('click', () => {
                rec.keywords.splice(rec.keywords.indexOf(kw), 1);
                this.onChange?.();
            });
            head.appendChild(nameLbl); head.appendChild(rm);
            card.appendChild(head);

            // Args row: indicator# + description
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '60px 1fr';
            row.style.gap = '4px';
            const indInp = document.createElement('input');
            indInp.type = 'text'; indInp.placeholder = 'ind';
            indInp.value = kw.args[0] ?? '';
            indInp.addEventListener('change', () => {
                kw.args[0] = indInp.value.trim();
                kw.args = kw.args.filter((v, i) => v !== '' || i > 0);
                this.onChange?.();
            });
            const descInp = document.createElement('input');
            descInp.type = 'text'; descInp.placeholder = 'description';
            descInp.value = this._stripQuotes(kw.args[1] ?? '');
            descInp.addEventListener('change', () => {
                const v = descInp.value.trim();
                if (v) kw.args[1] = `'${v.replace(/'/g, "''")}'`;
                else if (kw.args.length > 1) kw.args.splice(1, kw.args.length - 1);
                this.onChange?.();
            });
            row.appendChild(indInp); row.appendChild(descInp);
            card.appendChild(row);
            sec.appendChild(card);
        }
        const addBtn = document.createElement('button');
        addBtn.className = 'insp-add-kw';
        addBtn.textContent = '+ Add function key';
        addBtn.addEventListener('click', () => {
            const name = prompt('Function key name (e.g. CA03, CF12, HELP, ROLLUP):', 'CA03');
            if (!name) return;
            rec.keywords.push({ name: name.toUpperCase().trim(), args: [], indicators: [] });
            this.onChange?.();
        });
        sec.appendChild(addBtn);
    }

    _renderRecordOptionsSection (pane, rec) {
        const sec = this._sectionStart(pane, 'Record options');
        const names = ['OVERLAY','PUTOVR','OVRDTA','OVRATR','KEEP','ASSUME','FRCDTA','CLRL','BLINK','INVITE',
                       'RMVWDW','USRRSTDSP','LOCK','PROTECT','MSGALARM','FLDCSRPRG','DUP'];
        const tips = {
            OVERLAY:    'Keep previous record on screen',
            PUTOVR:     'Override previous output behaviour',
            OVRDTA:     'Override data (with PUTOVR)',
            OVRATR:     'Override attributes (with PUTOVR)',
            KEEP:       'Do not erase when overlaid',
            ASSUME:     'Assume record visible from previous step',
            FRCDTA:     'Force data to be sent immediately',
            CLRL:       'Clear lines',
            BLINK:      'Sound the alarm/blink',
            INVITE:     'Invite operation (multi-user)',
            RMVWDW:     'Removable window (close handle in chrome)',
            USRRSTDSP:  'Program controls display restore',
            LOCK:       'Lock subfile from scrolling',
            PROTECT:    'Protect record from user input',
            MSGALARM:   'Sound alarm with message',
            FLDCSRPRG:  'Field cursor progression handler',
            DUP:        'Enable DUP key for fields',
        };
        this._renderPresenceChips(sec, rec, names, tips);
    }

    _renderMouseButtonsSection (pane, rec) {
        const moubtns = rec.keywords.filter(k => k.name === 'MOUBTN');
        if (moubtns.length === 0) return;
        const sec = this._sectionStart(pane, 'Mouse buttons');
        for (const kw of moubtns) {
            const div = document.createElement('div');
            div.style.fontFamily = 'monospace';
            div.style.fontSize = '11px';
            div.style.color = '#c8c';
            div.style.padding = '2px 0';
            const action = kw.args[0] ?? '?';
            const target = kw.args[1] ?? '?';
            const labels = {
                '*ULD': 'single click', '*ULP': 'double click',
                '*LLD': 'long press', '*LLP': 'long double',
                '*MLD': 'middle click', '*MLP': 'middle double',
                '*RLD': 'right click', '*RLP': 'right double',
            };
            div.textContent = `${action} (${labels[action] ?? '?'}) → ${target}`;
            sec.appendChild(div);
        }
    }

    _renderEntryDefaultsSection (pane, rec) {
        const sec = this._sectionStart(pane, 'Entry-field defaults');
        let ip = rec.keywords.find(k => k.name === 'CHGINPDFT');
        const chips = document.createElement('div');
        chips.className = 'insp-chips';
        const flags = ['HI','UL','RI','BL','ND','PR'];
        const cur = new Set((ip?.args ?? []).map(a => String(a).toUpperCase()));
        for (const f of flags) {
            const chip = document.createElement('span');
            chip.className = 'insp-chip' + (cur.has(f) ? ' on' : '');
            chip.textContent = f;
            chip.title = 'Default DSPATR for entry fields in this record';
            chip.addEventListener('click', () => {
                if (!ip) {
                    ip = { name: 'CHGINPDFT', args: [], indicators: [] };
                    rec.keywords.push(ip);
                }
                const i = ip.args.findIndex(a => String(a).toUpperCase() === f);
                if (i >= 0) ip.args.splice(i, 1);
                else        ip.args.push(f);
                if (ip.args.length === 0) this._removeKeyword(rec, 'CHGINPDFT');
                this.onChange?.();
            });
            chips.appendChild(chip);
        }
        sec.appendChild(this._row('CHGINPDFT', chips));
    }

    _renderCursorBindingSection (pane, rec) {
        const sec = this._sectionStart(pane, 'Cursor binding');
        const note = document.createElement('p');
        note.className = 'empty';
        note.style.padding = '2px 0 4px';
        note.textContent = 'RTNCSRLOC: where the cursor was; CSRLOC: where to put it before display.';
        sec.appendChild(note);

        const mkInput = (label, name, placeholder) => {
            const kw = rec.keywords.find(k => k.name === name);
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = placeholder;
            inp.value = (kw?.args ?? []).join(' ');
            inp.addEventListener('change', () => {
                const args = inp.value.trim().split(/\s+/).filter(Boolean);
                this._removeKeyword(rec, name);
                if (args.length) rec.keywords.push({ name, args, indicators: [] });
                this.onChange?.();
            });
            sec.appendChild(this._row(label, inp));
        };
        mkInput('RTNCSRLOC', 'RTNCSRLOC', '&REC; &FLD;  (or *MOUSE/&WINDOW + 2-4 vars)');
        mkInput('CSRLOC',    'CSRLOC',    'row col   (or 2 field refs)');
    }

    _renderMnubarDspSection (pane, rec) {
        const kw = rec.keywords.find(k => k.name === 'MNUBARDSP');
        if (!kw) return;
        const sec = this._sectionStart(pane, 'Menu-bar reference');
        const txt = document.createElement('div');
        txt.style.fontFamily = 'monospace';
        txt.style.fontSize = '11px';
        txt.style.color = '#cc6';
        txt.textContent = `MNUBARDSP(${kw.args.join(' ')})`;
        sec.appendChild(txt);
        const explain = document.createElement('p');
        explain.className = 'empty';
        explain.style.padding = '4px 0';
        explain.textContent = `Menu bar record: ${kw.args[0] || '?'}.  Active choice → ${kw.args[1] || '?'};  active pulldown → ${kw.args[2] || '?'}.`;
        sec.appendChild(explain);
    }

    _renderHelpSection (pane, rec) {
        const hlpNames = ['HELP','HLPPNLGRP','HLPRCD','HLPARA','HLPID','HLPDOC',
                          'HLPTITLE','HLPSCHIDX','HLPSEQ','HLPFULL','HLPCMDKEY'];
        const present = rec.keywords.filter(k => hlpNames.includes(k.name));
        if (!present.length) return;
        const sec = this._sectionStart(pane, 'Help references');

        // HLPTITLE - single text arg
        const titleInp = document.createElement('input');
        titleInp.type = 'text';
        titleInp.placeholder = 'help panel title';
        const titleKw = rec.keywords.find(k => k.name === 'HLPTITLE');
        titleInp.value = this._stripQuotes(titleKw?.args?.[0] ?? '');
        titleInp.addEventListener('change', () => {
            this._removeKeyword(rec, 'HLPTITLE');
            const v = titleInp.value.trim();
            if (v) rec.keywords.push({
                name: 'HLPTITLE', args: [this._quote(v)], indicators: [],
            });
            this.onChange?.();
        });
        sec.appendChild(this._row('HLPTITLE', titleInp));

        // HLPARA(row col rows cols) - 4 numeric inputs in a grid
        const haKw = rec.keywords.find(k => k.name === 'HLPARA');
        const haArgs = haKw?.args ?? [];
        const haRow = document.createElement('div');
        haRow.style.display = 'grid';
        haRow.style.gridTemplateColumns = 'repeat(4, 1fr)';
        haRow.style.gap = '4px';
        const haInputs = [];
        for (let i = 0; i < 4; i++) {
            const inp = document.createElement('input');
            inp.type = 'number'; inp.min = 1;
            inp.placeholder = ['r','c','rows','cols'][i];
            inp.value = haArgs[i] ?? '';
            inp.addEventListener('change', () => {
                const vals = haInputs.map(x => x.value.trim()).filter(Boolean);
                this._removeKeyword(rec, 'HLPARA');
                if (vals.length) rec.keywords.push({
                    name: 'HLPARA', args: vals, indicators: [],
                });
                this.onChange?.();
            });
            haInputs.push(inp);
            haRow.appendChild(inp);
        }
        sec.appendChild(this._row('HLPARA', haRow));

        // Remaining help keywords as read-only info
        const otherHelp = present.filter(k => k.name !== 'HLPTITLE' && k.name !== 'HLPARA');
        if (otherHelp.length) {
            const list = document.createElement('div');
            list.style.marginTop = '4px';
            for (const kw of otherHelp) {
                const div = document.createElement('div');
                div.style.fontFamily = 'monospace';
                div.style.fontSize = '11px';
                div.style.color = '#9cc';
                div.style.padding = '1px 0';
                div.textContent = `${kw.name}(${kw.args.join(' ')})`;
                list.appendChild(div);
            }
            sec.appendChild(list);
        }
    }

    _renderFileMiscSection (pane, rec) {
        // Only on the records[0] where doc-level keywords land.
        const interesting = ['MSGLOC','DSPMOD','SETOF','MAXDEV','UBUFFER'];
        const present = rec.keywords.filter(k => interesting.includes(k.name));
        if (!present.length) return;
        const sec = this._sectionStart(pane, 'File-level misc');

        // MSGLOC(row) - simple number input
        const mlKw = rec.keywords.find(k => k.name === 'MSGLOC');
        const mlInp = document.createElement('input');
        mlInp.type = 'number'; mlInp.min = 1; mlInp.max = 27;
        mlInp.value = parseInt(mlKw?.args?.[0], 10) || '';
        mlInp.placeholder = 'msg line row';
        mlInp.addEventListener('change', () => {
            this._removeKeyword(rec, 'MSGLOC');
            const v = parseInt(mlInp.value, 10);
            if (Number.isFinite(v)) rec.keywords.push({
                name: 'MSGLOC', args: [String(v)], indicators: [],
            });
            this.onChange?.();
        });
        sec.appendChild(this._row('MSGLOC', mlInp));

        // DSPMOD(*DS3|*DS4) - dropdown
        const dmKw = rec.keywords.find(k => k.name === 'DSPMOD');
        const dmSel = document.createElement('select');
        for (const o of ['', '*DS3', '*DS4']) {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o || '(none)';
            dmSel.appendChild(opt);
        }
        dmSel.value = dmKw?.args?.[0] ?? '';
        dmSel.addEventListener('change', () => {
            this._removeKeyword(rec, 'DSPMOD');
            if (dmSel.value) rec.keywords.push({
                name: 'DSPMOD', args: [dmSel.value], indicators: [],
            });
            this.onChange?.();
        });
        sec.appendChild(this._row('DSPMOD', dmSel));

        // SETOF(N 'desc') - simple readonly list (rare; editing too fiddly)
        const setofs = rec.keywords.filter(k => k.name === 'SETOF');
        if (setofs.length) {
            const lab = document.createElement('div');
            lab.style.fontFamily = 'monospace';
            lab.style.fontSize = '11px';
            lab.style.color = '#cc6';
            lab.style.marginTop = '4px';
            lab.textContent = `SETOF: ${setofs.map(k => k.args.join(' ')).join('; ')}`;
            sec.appendChild(lab);
        }
    }

    _renderFileOptionsSection (pane, rec) {
        const sec = this._sectionStart(pane, 'File-level options');
        const names = ['PRINT','ERRSFL','INDARA','MOUBTN','VLDCMDKEY','MAXDEV','USRRSTDSP','NORSTCSR','REF'];
        const tips = {
            INDARA: 'Indicators live in a separate data structure (the program reads/writes them directly).  When set, the runtime DOES NOT use response indicators - the design-time preview still shows conditioned items, but at runtime visibility is controlled in code.',
        };
        this._renderPresenceChips(sec, rec, names, tips);
        // INDARA active warning
        if (rec.keywords.some(k => k.name === 'INDARA')) {
            const warn = document.createElement('p');
            warn.style.fontSize = '10px';
            warn.style.color = '#cc6';
            warn.style.padding = '4px 0';
            warn.style.fontStyle = 'italic';
            warn.textContent = '⚠ INDARA on: indicators are program-controlled.  Conditioned items still preview but runtime visibility depends on data structure values.';
            sec.appendChild(warn);
        }
        // DSPSIZ summary read-only
        const dsp = rec.keywords.find(k => k.name === 'DSPSIZ');
        if (dsp) {
            const info = document.createElement('div');
            info.style.fontFamily = 'monospace';
            info.style.fontSize = '11px';
            info.style.color = '#6cf';
            info.style.marginTop = '4px';
            info.textContent = `DSPSIZ(${dsp.args.join(' ')})`;
            sec.appendChild(info);
        }
    }

    // ==================================================================
    // Convenience sections (item-level)
    // ==================================================================

    _renderTextDescItem (pane, item) {
        let kw = item.keywords.find(k => k.name === 'TEXT');
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = this._stripQuotes(kw?.args?.[0] ?? '');
        inp.placeholder = "field description (TEXT('...'))";
        inp.addEventListener('change', () => {
            const v = inp.value.trim();
            this._removeKeyword(item, 'TEXT');
            if (v) item.keywords.push({ name: 'TEXT', args: [this._quote(v)], indicators: [] });
            this.onChange?.();
        });
        this._section(pane, 'Description (TEXT)', [this._row('Text', inp)]);
    }

    _renderRefFldSection (pane, item) {
        const sec = this._sectionStart(pane, 'Referenced field (REFFLD)');
        const kw = item.keywords.find(k => k.name === 'REFFLD');
        if (!kw) {
            this._emptyNote(sec, 'No REFFLD keyword on this field.');
            return;
        }
        const inp = document.createElement('input');
        inp.type = 'text'; inp.value = kw.args.join(' ');
        inp.placeholder = '<field> <file>  or  <lib>/<file>/<field>';
        inp.title = 'IBM REFFLD: which PF/LF + field this entry inherits from';
        inp.addEventListener('change', () => {
            kw.args = inp.value.trim().split(/\s+/).filter(Boolean);
            this.onChange?.();
        });
        sec.appendChild(this._row('REFFLD', inp));
    }

    _renderDftValSection (pane, item) {
        let kw = item.keywords.find(k => k.name === 'DFTVAL');
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = this._stripQuotes(kw?.args?.[0] ?? '');
        inp.placeholder = 'default display value';
        inp.addEventListener('change', () => {
            const v = inp.value;
            this._removeKeyword(item, 'DFTVAL');
            if (v !== '') item.keywords.push({
                name: 'DFTVAL', args: [this._quote(v)], indicators: [],
            });
            this.onChange?.();
        });
        this._section(pane, 'Default value (DFTVAL)', [this._row('Value', inp)]);
    }

    _renderValidationSection (pane, item) {
        if (item.kind !== 'field') return;
        const sec = this._sectionStart(pane, 'Validation');
        const mk = (name, placeholder) => {
            const kw = item.keywords.find(k => k.name === name);
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.value = (kw?.args ?? []).join(' ');
            inp.placeholder = placeholder;
            inp.addEventListener('change', () => {
                const args = inp.value.trim().split(/\s+/).filter(Boolean);
                this._removeKeyword(item, name);
                if (args.length) item.keywords.push({ name, args, indicators: [] });
                this.onChange?.();
            });
            sec.appendChild(this._row(name, inp));
        };
        mk('VALUES', "'A' 'B' 'C'");
        mk('RANGE',  '1 99');
        mk('COMP',   'GT 0');
        mk('CMP',    'EQ 5');
    }

    _renderDateTimeFormatSection (pane, item) {
        const isTime = item.dataType === 'T';
        const kwName = isTime ? 'TIMFMT' : 'DATFMT';
        const fmts = isTime
            ? ['','*HMS','*ISO','*USA','*EUR','*JIS']
            : ['','*ISO','*USA','*EUR','*JIS','*JUL','*YMD','*MDY','*DMY','*JOB'];

        const sel = document.createElement('select');
        for (const f of fmts) {
            const opt = document.createElement('option');
            opt.value = f; opt.textContent = f || `(default ${isTime ? '*HMS' : '*ISO'})`;
            sel.appendChild(opt);
        }
        const cur = item.keywords.find(k => k.name === kwName);
        sel.value = cur?.args?.[0] ?? '';
        sel.addEventListener('change', () => {
            this._removeKeyword(item, kwName);
            if (sel.value) item.keywords.push({
                name: kwName, args: [sel.value], indicators: [],
            });
            this.onChange?.();
        });
        this._section(pane, isTime ? 'Time format (TIMFMT)' : 'Date format (DATFMT)', [
            this._row(kwName, sel),
        ]);
    }

    _renderEditWordSection (pane, item) {
        if (item.kind !== 'field') return;
        let kw = item.keywords.find(k => k.name === 'EDTWRD');
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = this._stripQuotes(kw?.args?.[0] ?? '');
        inp.placeholder = "e.g.  '  /  /  '  for date";
        inp.title = 'Edit word pattern (EDTWRD)';
        inp.addEventListener('change', () => {
            const v = inp.value;
            this._removeKeyword(item, 'EDTWRD');
            if (v !== '') item.keywords.push({
                name: 'EDTWRD', args: [this._quote(v)], indicators: [],
            });
            this.onChange?.();
        });
        this._section(pane, 'Edit word (EDTWRD)', [this._row('Pattern', inp)]);
    }

    _renderCheckSection (pane, item) {
        if (item.kind !== 'field') return;
        const sec = this._sectionStart(pane, 'Input checks (CHECK)');
        let kw = item.keywords.find(k => k.name === 'CHECK');
        const chips = document.createElement('div');
        chips.className = 'insp-chips';
        const flags = [['LC','to lowercase'], ['ME','mandatory entry'], ['MF','mandatory fill'],
                       ['M10','mod-10'], ['M11','mod-11'], ['RB','right-blank'],
                       ['RZ','right-zero'], ['AB','no-blanks alpha'], ['VN','valid name']];
        const cur = new Set((kw?.args ?? []).map(a => String(a).toUpperCase()));
        for (const [f, tip] of flags) {
            const chip = document.createElement('span');
            chip.className = 'insp-chip' + (cur.has(f) ? ' on' : '');
            chip.textContent = f;
            chip.title = tip;
            chip.addEventListener('click', () => {
                if (!kw) {
                    kw = { name: 'CHECK', args: [], indicators: [] };
                    item.keywords.push(kw);
                }
                const i = kw.args.findIndex(a => String(a).toUpperCase() === f);
                if (i >= 0) kw.args.splice(i, 1);
                else        kw.args.push(f);
                if (kw.args.length === 0) this._removeKeyword(item, 'CHECK');
                this.onChange?.();
            });
            chips.appendChild(chip);
        }
        sec.appendChild(chips);
    }

    _renderChoiceListSection (pane, item) {
        const kinds = {
            'CHOICE':     { container: ['SNGCHCFLD','MLTCHCFLD'], label: 'Choice list' },
            'PSHBTNCHC':  { container: ['PSHBTNFLD','PUSHBTNFLD'], label: 'Push-button list' },
            'MNUBARCHC':  { container: [], label: 'Menu-bar choices' },
        };
        // Decide which kind applies based on which container keyword the
        // item carries (or whether it has any *CHC entries already).
        let activeKind = null;
        for (const [chcName, info] of Object.entries(kinds)) {
            const hasContainer = info.container.some(n => item.keywords.some(k => k.name === n));
            const hasEntries = item.keywords.some(k => k.name === chcName);
            if (hasContainer || hasEntries) { activeKind = chcName; break; }
        }
        if (!activeKind) return;
        const info = kinds[activeKind];
        const sec = this._sectionStart(pane, info.label);

        // Show container-level flags (*AUTOENT, *NOSLTIND, *NUMROW N,
        // *NUMCOL N) so the user sees what's active without diving into
        // the "Other keywords" raw editor.
        const containerKw = item.keywords.find(k =>
            info.container.includes(k.name));
        if (containerKw) {
            const containerInfo = document.createElement('div');
            containerInfo.style.fontSize = '11px';
            containerInfo.style.fontFamily = 'monospace';
            containerInfo.style.color = '#9cc';
            containerInfo.style.marginBottom = '4px';
            containerInfo.textContent = containerKw.name + (containerKw.args.length
                ? `(${containerKw.args.join(' ')})` : '');
            sec.appendChild(containerInfo);
        }

        // CHCAVAIL / CHCSLT / CHCUNAVAIL summary - they live on the
        // field, parallel to CHOICE entries.
        const chcExtras = item.keywords.filter(k =>
            k.name === 'CHCAVAIL' || k.name === 'CHCSLT' || k.name === 'CHCUNAVAIL');
        if (chcExtras.length) {
            const ex = document.createElement('div');
            ex.style.fontSize = '10px';
            ex.style.color = '#888';
            ex.style.padding = '2px 0 6px';
            ex.style.fontFamily = 'monospace';
            ex.textContent = '+ ' + chcExtras
                .map(k => `${k.name}(${k.args.join(' ')})`).join(', ');
            sec.appendChild(ex);
        }

        const entries = item.keywords.filter(k => k.name === activeKind);
        if (entries.length === 0) this._emptyNote(sec, `No ${activeKind} entries.`);
        for (const kw of entries) {
            const card = document.createElement('div');
            card.className = 'insp-kw';
            const head = document.createElement('div');
            head.className = 'insp-kw-head';
            const numInp = document.createElement('input');
            numInp.type = 'text'; numInp.value = kw.args[0] ?? ''; numInp.style.maxWidth = '50px';
            numInp.title = 'Choice number';
            numInp.addEventListener('change', () => { kw.args[0] = numInp.value.trim(); this.onChange?.(); });
            const labelInp = document.createElement('input');
            labelInp.type = 'text';
            labelInp.placeholder = "label (text or &VAR;)";
            const labelIdx = activeKind === 'MNUBARCHC' ? 2 : 1;
            labelInp.value = this._stripQuotes(kw.args[labelIdx] ?? '');
            labelInp.addEventListener('change', () => {
                const v = labelInp.value.trim();
                if (!v) return;
                kw.args[labelIdx] = v.startsWith('&') ? v : this._quote(v);
                this.onChange?.();
            });
            const rm = document.createElement('button');
            rm.textContent = '×'; rm.className = 'insp-kw-rm';
            rm.addEventListener('click', () => {
                item.keywords.splice(item.keywords.indexOf(kw), 1);
                this.onChange?.();
            });
            head.appendChild(numInp); head.appendChild(labelInp); head.appendChild(rm);
            card.appendChild(head);
            // For MNUBARCHC the linked-record name is args[1]
            if (activeKind === 'MNUBARCHC') {
                const recInp = document.createElement('input');
                recInp.type = 'text';
                recInp.placeholder = 'linked PULLDOWN record';
                recInp.value = kw.args[1] ?? '';
                recInp.addEventListener('change', () => {
                    kw.args[1] = recInp.value.trim();
                    this.onChange?.();
                });
                card.appendChild(recInp);
            }
            // For PSHBTNCHC the optional action key is args[2]
            if (activeKind === 'PSHBTNCHC') {
                const actInp = document.createElement('input');
                actInp.type = 'text';
                actInp.placeholder = 'action (e.g. CF12, ENTER) optional';
                actInp.value = kw.args[2] ?? '';
                actInp.addEventListener('change', () => {
                    const v = actInp.value.trim();
                    if (v) kw.args[2] = v;
                    else   if (kw.args.length > 2) kw.args.splice(2);
                    this.onChange?.();
                });
                card.appendChild(actInp);
            }
            sec.appendChild(card);
        }
        const addBtn = document.createElement('button');
        addBtn.className = 'insp-add-kw';
        addBtn.textContent = `+ Add ${activeKind}`;
        addBtn.addEventListener('click', () => {
            const next = String(entries.length + 1);
            const newKw = activeKind === 'MNUBARCHC'
                ? { name: activeKind, args: [next, '', this._quote('Choice ' + next)], indicators: [] }
                : { name: activeKind, args: [next, this._quote('Choice ' + next)], indicators: [] };
            item.keywords.push(newKw);
            this.onChange?.();
        });
        sec.appendChild(addBtn);
    }

    // ------------------------------------------------------------------
    // Tiny DOM helpers
    // ------------------------------------------------------------------
    _patchItem (id, patch) { this.onItemPatch(id, patch); }

    _sectionStart (parent, title) {
        const s = document.createElement('div');
        s.className = 'insp-section';
        const h = document.createElement('h4');
        h.textContent = title;
        s.appendChild(h);
        parent.appendChild(s);
        return s;
    }
    _section (parent, title, rows) {
        const s = this._sectionStart(parent, title);
        for (const r of rows) s.appendChild(r);
        return s;
    }
    _emptyNote (parent, msg) {
        const note = document.createElement('p');
        note.className = 'empty';
        note.style.padding = '4px 0';
        note.textContent = msg;
        parent.appendChild(note);
    }
    _row (label, control) {
        const row = document.createElement('div');
        row.className = 'insp-row';
        const lab = document.createElement('label');
        lab.textContent = label;
        row.appendChild(lab);
        row.appendChild(control);
        return row;
    }
    _numField (obj, key, label, onChange, min, max) {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = obj[key] ?? 0;
        if (min != null) inp.min = min;
        if (max != null) inp.max = max;
        inp.addEventListener('change', () => {
            const v = parseInt(inp.value, 10);
            if (!Number.isNaN(v)) onChange(v);
        });
        return this._row(label, inp);
    }
    _textField (obj, key, label, onChange) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = obj[key] ?? '';
        inp.addEventListener('change', () => onChange(inp.value));
        return this._row(label, inp);
    }
    _selField (obj, key, label, options, onChange) {
        const sel = document.createElement('select');
        for (const o of options) {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            sel.appendChild(opt);
        }
        sel.value = obj[key] ?? '';
        sel.addEventListener('change', () => onChange(sel.value));
        return this._row(label, sel);
    }
    _selRawField (options, value, onChange) {
        const sel = document.createElement('select');
        sel.className = 'insp-raw-select';
        for (const o of options) {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            sel.appendChild(opt);
        }
        sel.value = value ?? '';
        sel.addEventListener('change', () => onChange(sel.value));
        return sel;
    }
    _indicatorsInput (currentArr, onChange) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = formatIndicatorTokens(currentArr);
        inp.placeholder = 'e.g. 33 N34';
        inp.title = 'Indicators - examples: "33" (when 33 on), "N80" (when 80 off), "33 N34" (both)';
        inp.className = 'insp-ind';
        inp.addEventListener('change', () => onChange(parseIndicatorTokens(inp.value)));
        return inp;
    }
}
