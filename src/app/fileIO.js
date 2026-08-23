// Open / Save dialog wiring + the Save-As helper that triggers a
// browser download.  Open also auto-detects the parsed DSPSIZ so loading
// a 27×132 file flips the model selector immediately.

import { parseDspf } from '../parser/parseDspf.js';
import { writeDspf } from '../writer/writeDspf.js';
import { ibmiName } from '../model/factories.js';

export function bindFileIO ({ doc, designer, modelSel, fileInput, flash }) {
    bindOpen(doc, designer, modelSel, fileInput, flash);
    bindSave(doc, flash);
}

function bindOpen (doc, designer, modelSel, fileInput, flash) {
    document.getElementById('openDoc').addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (ev) => {
        const file = ev.target.files?.[0];
        fileInput.value = '';
        if (!file) return;
        try {
            const text   = await file.text();
            const parsed = parseDspf(text);
            doc.adopt(parsed);
            doc.sourceName = ibmiName(file.name.replace(/\.[^.]+$/, ''), 'DSPFILE');

            syncModelChrome(doc, modelSel, designer);
            designer.selectItem(null);
            flash(`Loaded ${file.name}: ${doc.records.length} records, ${doc.itemCount()} items.`, 'ok');
        } catch (err) {
            console.error('[dspf·rad] open failed:', err);
            flash(`Open failed: ${err.message}`, 'error', 4000);
        }
    });
}

function syncModelChrome (doc, modelSel, designer) {
    modelSel.value = doc.modelKey;
    document.body.classList.toggle('wide-mode', doc.modelKey === '27x132');
    requestAnimationFrame(() => designer.forceResize());
}

function bindSave (doc, flash) {
    document.getElementById('saveDoc').addEventListener('click', () => {
        try {
            const source = writeDspf(doc);
            const name = (doc.sourceName || 'DSPFILE') + '.DSPF';
            downloadText(name, source);
            flash(`Saved ${name}.`, 'ok');
        } catch (err) {
            console.error('[dspf·rad] save failed:', err);
            flash(`Save failed: ${err.message}`, 'error');
        }
    });
}

// Programmatic download - used by Save, RPGLE/COBOL export, etc.
export function downloadText (filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
