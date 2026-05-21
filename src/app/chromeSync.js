// Mirrors document state to the surrounding chrome: model dropdown,
// record list, statusbar fields, toggle states, etc.  Called on every
// emit so the toolbar/statusbar always reflect the current doc.

import { MODELS } from '../model/constants.js';

export function makeChromeSync ({ doc, els }) {
    return function refreshChrome () {
        els.sbModel.textContent = MODELS[doc.modelKey].label.split(' · ')[0];
        els.modelSel.value      = doc.modelKey;
        document.body.classList.toggle('wide-mode', doc.modelKey === '27x132');

        rebuildRecordSelect(els.recordSel, doc);

        const rec = doc.activeRecord;
        const typeShort = rec.type === 'RECORD' ? '' : ` · ${rec.type}`;
        els.sbRecord.textContent = rec.name + typeShort;
        els.sbItems.textContent  = `${rec.items.length} items`;
        els.helpEl.classList.toggle('hidden', rec.items.length > 0);

        els.overlayBtn?.classList.toggle('on', doc.showOverlay);
        els.hideCondBtn?.classList.toggle('on', doc.hideConditioned);

        // 98.css paints the etched-gray look when [disabled] is set.  The
        // handler also flashes an error if invoked with a single record,
        // but disabling here matches what Win98 toolbars did historically.
        els.deleteBtn.disabled = doc.records.length === 1;
    };
}

function rebuildRecordSelect (recordSel, doc) {
    recordSel.innerHTML = '';
    for (let i = 0; i < doc.records.length; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        const r = doc.records[i];
        const typeBadge = r.type === 'RECORD' ? '' : ` [${r.type}]`;
        opt.textContent = r.name + typeBadge;
        recordSel.appendChild(opt);
    }
    recordSel.value = doc.activeRecordIndex;
}
