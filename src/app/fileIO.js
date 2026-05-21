// Open / Save dialog wiring + the Save-As helper that triggers a
// browser download.  Open also auto-detects the parsed DSPSIZ so loading
// a 27×132 file flips the model selector immediately.

import { parseDspf } from '../parser/parseDspf.js';
import { writeDspf } from '../writer/writeDspf.js';

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

            matchModelFromDsPsiz(doc, modelSel, designer);
            designer.selectItem(null);
            flash(`Loaded ${file.name}: ${doc.records.length} records, ${doc.itemCount()} items.`, 'ok');
        } catch (err) {
            console.error('[dspf·rad] open failed:', err);
            flash(`Open failed: ${err.message}`, 'error', 4000);
        }
    });
}

function matchModelFromDsPsiz (doc, modelSel, designer) {
    const dspsiz = doc.records[0]?.keywords?.find(kw => kw.name === 'DSPSIZ');
    if (!dspsiz || dspsiz.args.length < 2) return;

    const rows = parseInt(dspsiz.args[0], 10);
    const cols = parseInt(dspsiz.args[1], 10);
    if (rows === 27 && cols === 132) {
        doc.setModel('27x132');
        modelSel.value = '27x132';
        document.body.classList.add('wide-mode');
    } else {
        doc.setModel('24x80');
        modelSel.value = '24x80';
        document.body.classList.remove('wide-mode');
    }
    requestAnimationFrame(() => designer.forceResize());
}

function bindSave (doc, flash) {
    document.getElementById('saveDoc').addEventListener('click', () => {
        try {
            const source = writeDspf(doc);
            const name = (doc.records[0]?.name || 'DSPF') + '.DSPF';
            downloadText(name, source);
            flash(`Saved ${name}.`, 'ok');
        } catch (err) {
            console.error('[dspf·rad] save failed:', err);
            flash(`Save failed: ${err.message}`, 'error');
        }
    });
}

// Programmatic download — used by Save, RPGLE/COBOL export, etc.
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
