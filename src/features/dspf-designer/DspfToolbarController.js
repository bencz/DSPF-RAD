export class DspfToolbarController {
    #abortController = null;

    constructor ({
        doc, designer, elements, flash,
        documentRef = globalThis.document,
        windowRef = globalThis.window,
        dialogs,
    }) {
        this.doc = doc;
        this.designer = designer;
        this.elements = elements;
        this.flash = flash;
        this.document = documentRef;
        this.window = windowRef;
        if (!dialogs) throw new TypeError('DspfToolbarController requires dialogs.');
        this.dialogs = dialogs;
    }

    start () {
        this.stop();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;
        const { modelSel, recordSel } = this.elements;

        modelSel.addEventListener('change', () => this.#changeModel(), { signal });
        recordSel.addEventListener('change', () => this.#changeRecord(), { signal });
        this.#bind('undoDoc', () => this.doc.undo(), signal);
        this.#bind('redoDoc', () => this.doc.redo(), signal);
        this.#bind('copyItems', () => this.#copyItems(), signal);
        this.#bind('pasteItems', () => this.#pasteItems(), signal);
        this.#bind('duplicateItems', () => this.#duplicateItems(), signal);
        this.#bind('arrangeItems', () => this.#arrangeItems(), signal);
        this.#bind('addRecord', () => this.#addRecord(), signal);
        this.#bind('addSubfile', () => this.#addSubfile(), signal);
        this.#bind('cloneRecord', () => this.#cloneRecord(), signal);
        this.#bind('recordUp', () => this.doc.moveRecord(this.doc.activeRecordIndex, -1), signal);
        this.#bind('recordDown', () => this.doc.moveRecord(this.doc.activeRecordIndex, 1), signal);
        this.#bind('renameRecord', () => this.#renameRecord(), signal);
        this.#bind('deleteRecord', () => this.#deleteRecord(), signal);
        this.elements.overlayBtn?.addEventListener(
            'click', () => this.doc.setShowOverlay(!this.doc.showOverlay), { signal });
        this.elements.hideCondBtn?.addEventListener(
            'click', () => this.doc.setHideConditioned(!this.doc.hideConditioned), { signal });
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
    }

    #element (id) {
        return this.document.getElementById(id);
    }

    #bind (id, listener, signal) {
        this.#element(id)?.addEventListener('click', listener, { signal });
    }

    #changeModel () {
        this.doc.setModel(this.elements.modelSel.value);
        this.document.body.classList.toggle('wide-mode', this.doc.modelKey === '27x132');
        this.window.requestAnimationFrame(() => this.designer.forceResize());
        this.window.setTimeout(() => this.designer.forceResize(), 60);
    }

    #changeRecord () {
        this.doc.setActiveRecord(parseInt(this.elements.recordSel.value, 10));
        this.designer.selectItem(null);
    }

    #copyItems () {
        if (!this.designer.copySelection()) this.flash('Select one or more items first.', 'error');
        else this.flash(`Copied ${this.designer.selectedIds.size} item(s).`, 'ok');
    }

    #pasteItems () {
        const added = this.designer.pasteSelection();
        if (!added.length) this.flash('Nothing has been copied yet.', 'error');
        else this.flash(`Pasted ${added.length} item(s).`, 'ok');
    }

    #duplicateItems () {
        const added = this.designer.duplicateSelection();
        if (!added.length) this.flash('Select one or more items first.', 'error');
        else this.flash(`Duplicated ${added.length} item(s).`, 'ok');
    }

    #arrangeItems () {
        const mode = this.#element('arrangeSel')?.value;
        const changed = mode?.startsWith('distribute-')
            ? this.designer.distributeSelection(mode.replace('distribute-', ''))
            : this.designer.alignSelection(mode);
        if (!changed) this.flash('Select at least 2 items (3 to distribute).', 'error');
    }

    async #addRecord () {
        const name = await this.dialogs.prompt({
            title: 'Add record format',
            message: 'Create a record format in the active display file.',
            label: 'Record format name',
            value: `R${this.doc.records.length + 1}`,
            maxLength: 10,
            acceptLabel: 'Add',
        });
        if (name != null) this.doc.addRecord(name);
    }

    async #addSubfile () {
        const base = await this.dialogs.prompt({
            title: 'Add subfile pair',
            message: 'Create linked SFL and SFLCTL record formats.',
            label: 'Base name',
            value: 'SFL',
            maxLength: 9,
            acceptLabel: 'Add pair',
        });
        if (base == null) return;
        const { sflctl } = this.doc.addSubfile(base);
        const sflName = this.doc.records[this.doc.records.length - 2].name;
        this.flash(`Created subfile pair: ${sflName} + ${sflctl.name}.`, 'ok');
    }

    #cloneRecord () {
        const created = this.doc.duplicateRecord(this.doc.activeRecordIndex);
        if (!created.length) return;
        this.designer.selectItem(null);
        this.flash(created.length === 2
            ? `Duplicated subfile pair as ${created[0].name} + ${created[1].name}.`
            : `Duplicated record as ${created[0].name}.`, 'ok', 4000);
    }

    async #renameRecord () {
        const currentName = this.doc.activeRecord.name;
        const name = await this.dialogs.prompt({
            title: 'Rename record format',
            message: `Rename ${currentName}.`,
            label: 'Record format name',
            value: currentName,
            maxLength: 10,
            acceptLabel: 'Rename',
        });
        if (name != null && name !== currentName) {
            this.doc.renameRecord(this.doc.activeRecordIndex, name);
        }
    }

    async #deleteRecord () {
        if (this.doc.records.length === 1) {
            this.flash('At least one record is required.', 'error');
            return;
        }
        if (!await this.dialogs.confirm({
            title: 'Delete record format',
            message: `Delete record ${this.doc.activeRecord.name}?`,
            detail: 'This operation remains available through document undo.',
            acceptLabel: 'Delete',
            danger: true,
        })) return;
        this.doc.deleteRecord(this.doc.activeRecordIndex);
    }
}
