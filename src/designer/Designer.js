// Orchestrator: owns the canvas renderer, holds selection state, and
// turns input events into document mutations.  Honours the palette's
// click-to-place mode (the next canvas click drops the armed spec
// instead of selecting / dragging).

import { GridCanvas } from '../canvas/GridCanvas.js';
import { itemWidth, itemHeight } from '../canvas/metrics.js';
import { specToItems } from './specToItem.js';
import { bindDragDrop } from './dragDrop.js';
import { bindPointerInput, bindKeyboardInput } from './input.js';

export class Designer {
    constructor ({ canvas, document, inspector, palette, onChange, onSelectionChange }) {
        this.canvas    = canvas;
        this.document  = document;
        this.inspector = inspector;
        this.palette   = palette;
        this.onChange  = onChange;
        // Fires after selectItem changes the selected id (including to null).
        // Kept separate from onChange because the doc itself doesn't mutate
        // when selection alone changes.
        this.onSelectionChange = onSelectionChange;

        this.renderer  = new GridCanvas(canvas);
        this.renderer.document = document;
        this.selectedId = null;
        this.selectedIds = new Set();
        this._clipboard = [];
        this._pasteOffset = 0;

        this._dragItem      = null;
        this._dragOffset    = null;
        this._dragMoved     = false;
        this._dropSpecWidth = 1;

        document.onChange((_doc, meta) => this._refresh(meta));

        bindDragDrop(this);
        bindPointerInput(this);
        bindKeyboardInput(this);

        this._refresh();
    }

    selectItem (id, { additive = false, toggle = false } = {}) {
        const before = [...this.selectedIds].join('\0');
        if (!additive && !toggle) this.selectedIds.clear();
        if (id) {
            if (toggle && this.selectedIds.has(id)) this.selectedIds.delete(id);
            else this.selectedIds.add(id);
        }
        this.selectedId = id && this.selectedIds.has(id)
            ? id
            : ([...this.selectedIds].at(-1) ?? null);
        const changed = before !== [...this.selectedIds].join('\0');
        this.renderer.selection = this.selectedIds;
        this.inspector.setSelection(
            this.selectedId ? this.document.findItem(this.selectedId) : null);
        this.renderer.draw();
        if (changed) this.onSelectionChange?.(this.selectedId);
    }

    selectItems (ids) {
        this.selectedIds = new Set((ids ?? []).filter(id => this.document.findItem(id)));
        this.selectedId = [...this.selectedIds].at(-1) ?? null;
        this.renderer.selection = this.selectedIds;
        this.inspector.setSelection(
            this.selectedId ? this.document.findItem(this.selectedId) : null);
        this.renderer.draw();
        this.onSelectionChange?.(this.selectedId);
    }

    selectedItems () {
        const activeIds = this.selectedIds;
        return this.document.activeRecord.items.filter(item => activeIds.has(item.id));
    }

    selectAll () {
        this.selectItems(this.document.activeRecord.items.map(item => item.id));
    }

    copySelection () {
        const items = this.selectedItems();
        if (!items.length) return false;
        this._clipboard = JSON.parse(JSON.stringify(items));
        this._pasteOffset = 0;
        return true;
    }

    pasteSelection () {
        if (!this._clipboard.length) return [];
        this._pasteOffset++;
        const shift = this._pasteOffset;
        const created = cloneItemsForRecord(
            this._clipboard, this.document.activeRecord.items,
            shift, shift, this.document.rows, this.document.cols);
        const added = this.document.addItems(created);
        this.selectItems(added.map(item => item.id));
        return added;
    }

    duplicateSelection () {
        if (!this.copySelection()) return [];
        return this.pasteSelection();
    }

    deleteSelection () {
        const ids = [...this.selectedIds];
        if (!ids.length) return;
        this.document.transaction('Delete items', () => {
            for (const id of ids) this.document.removeItem(id);
        });
        this.selectItem(null);
    }

    moveSelection (dr, dc, label = 'Move items') {
        const items = this.selectedItems();
        if (!items.length) return;
        ({ dr, dc } = this.constrainMove(items, dr, dc));
        if (dr === 0 && dc === 0) return;
        this.document.transaction(label, () => this.document.updateItems(items.map(item => ({
            id: item.id,
            patch: { row: item.row + dr, col: item.col + dc },
        }))));
    }

    constrainMove (items, dr, dc) {
        if (!items?.length) return { dr: 0, dc: 0 };
        const minRow = Math.min(...items.map(item => item.row));
        const maxRow = Math.max(...items.map(item => item.row));
        const minCol = Math.min(...items.map(item => item.col));
        const maxCol = Math.max(...items.map(item => item.col));
        return {
            dr: Math.max(1 - minRow, Math.min(dr, this.document.rows - maxRow)),
            dc: Math.max(1 - minCol, Math.min(dc, this.document.cols - maxCol)),
        };
    }

    alignSelection (mode) {
        const items = this.selectedItems();
        if (items.length < 2) return false;
        const left = Math.min(...items.map(item => item.col));
        const top = Math.min(...items.map(item => item.row));
        const right = Math.max(...items.map(item => item.col + itemWidth(item) - 1));
        const bottom = Math.max(...items.map(item => item.row + itemHeight(item) - 1));
        const centerCol = Math.round((left + right) / 2);
        const centerRow = Math.round((top + bottom) / 2);
        const patches = items.map(item => {
            const patch = {};
            if (mode === 'left') patch.col = left;
            else if (mode === 'right') patch.col = right - itemWidth(item) + 1;
            else if (mode === 'top') patch.row = top;
            else if (mode === 'bottom') patch.row = bottom - itemHeight(item) + 1;
            else if (mode === 'hcenter') patch.col = centerCol - Math.floor(itemWidth(item) / 2);
            else if (mode === 'vcenter') patch.row = centerRow - Math.floor(itemHeight(item) / 2);
            return { id: item.id, patch };
        });
        if (!patches.some(entry => Object.keys(entry.patch).length)) return false;
        this.document.transaction('Align items', () => this.document.updateItems(patches));
        return true;
    }

    distributeSelection (axis) {
        const items = this.selectedItems();
        if (items.length < 3) return false;
        const key = axis === 'vertical' ? 'row' : 'col';
        const sorted = items.slice().sort((a, b) => a[key] - b[key]);
        const first = sorted[0][key];
        const last = sorted.at(-1)[key];
        const step = (last - first) / (sorted.length - 1);
        const patches = sorted.map((item, index) => ({
            id: item.id,
            patch: { [key]: Math.round(first + step * index) },
        }));
        this.document.transaction('Distribute items', () => this.document.updateItems(patches));
        return true;
    }

    // Called after window resize or a CSS class toggle so the canvas can
    // re-read its dimensions and redraw at the new scale.
    forceResize () { this.renderer.resize(); }

    placeFromSpec (spec, cell) {
        const usedNames = this.document.activeRecord.items
            .map(item => item.name)
            .filter(Boolean);
        const items   = specToItems(spec, cell, usedNames);
        const created = this.document.addItems(items);
        this.selectItems(created.map(item => item.id));
        this.palette?.clearArmed?.();
        this.canvas.classList.remove('canvas-armed');
    }

    _refresh (meta = {}) {
        this.renderer.document = this.document;
        for (const id of [...this.selectedIds]) {
            if (!this.document.findItem(id)) this.selectedIds.delete(id);
        }
        if (!this.selectedIds.has(this.selectedId)) {
            this.selectedId = [...this.selectedIds].at(-1) ?? null;
        }
        this.renderer.selection = this.selectedIds;
        if (meta.transient) {
            this.renderer.draw();
            return;
        }
        this.renderer.resize();
        this.renderer.draw();
        const sel = this.selectedId ? this.document.findItem(this.selectedId) : null;
        this.inspector.setSelection(sel);
        this.onChange?.(this.document);
    }
}

function cloneItemsForRecord (source, existing, dr, dc, maxRows, maxCols) {
    const usedNames = new Set(existing.map(item => item.name).filter(Boolean));
    const nameMap = new Map();
    const clones = source.map(raw => {
        const clone = JSON.parse(JSON.stringify(raw));
        clone.id = null;
        clone.row = Math.min(maxRows, Math.max(1, (clone.row ?? 1) + dr));
        clone.col = Math.min(maxCols, Math.max(1, (clone.col ?? 1) + dc));
        if (clone.kind === 'field' && clone.name) {
            const next = uniqueFieldName(clone.name, usedNames);
            nameMap.set(clone.name, next);
            clone.name = next;
        }
        return clone;
    });
    for (const clone of clones) rewriteFieldReferences(clone, nameMap);
    return clones;
}

function uniqueFieldName (candidate, used) {
    const base = String(candidate).toUpperCase()
        .replace(/[^A-Z0-9_$#@]/g, '').slice(0, 10) || 'FIELD';
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

function rewriteFieldReferences (item, nameMap) {
    for (const keyword of item.keywords ?? []) {
        keyword.args = (keyword.args ?? []).map(arg => {
            const text = String(arg);
            const match = /^&([A-Z0-9_$#@]+);?$/i.exec(text);
            if (!match || !nameMap.has(match[1])) return arg;
            return `&${nameMap.get(match[1])};`;
        });
    }
}
