// Property panel.  Two tabs (Item / Record) rendered into the same root,
// re-built from scratch on every change.  All edits flow through the
// callbacks the constructor receives — sections mutate keyword lists
// directly but always call ctx.onChange so the doc emits.

import { renderItemPane }   from './ItemPane.js';
import { renderRecordPane } from './RecordPane.js';

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
        this.root.appendChild(this._buildTabs());

        const pane = document.createElement('div');
        pane.className = 'insp-pane';
        this.root.appendChild(pane);

        const ctx = this._buildContext();
        if (this.activeTab === 'item') renderItemPane(pane, ctx);
        else                            renderRecordPane(pane, ctx);
    }

    _buildTabs () {
        const tabs = document.createElement('div');
        tabs.className = 'insp-tabs';
        for (const [tab, label] of [['item', 'Item'], ['record', 'Record']]) {
            const btn = document.createElement('button');
            btn.className = 'insp-tab' + (this.activeTab === tab ? ' active' : '');
            btn.textContent = label;
            btn.addEventListener('click', () => this.setTab(tab));
            tabs.appendChild(btn);
        }
        return tabs;
    }

    // Context object passed to every section module.  Bundles the doc
    // accessors + mutation callbacks so sections don't need a reference
    // to the Inspector instance.
    _buildContext () {
        return {
            selectedItem: this.selectedItem,
            activeRecord: this.activeRecordRef(),
            document:     this.documentRef(),
            onItemPatch:  this.onItemPatch,
            onItemDelete: this.onItemDelete,
            onRecordPatch: this.onRecordPatch,
            onChange:     this.onChange,
            onSelectItem: this.onSelectItem,
            setTab:       (tab) => this.setTab(tab),
        };
    }
}
