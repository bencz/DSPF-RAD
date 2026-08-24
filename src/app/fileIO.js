// Open/save orchestration for DDS and project files. Environment-specific
// dialogs and persistence are delegated to HostBridge.

import { parseDspf } from '../parser/parseDspf.js';
import { writeDspf } from '../writer/writeDspf.js';
import { ibmiName } from '../model/factories.js';
import { DspfDocument } from '../model/DspfDocument.js';

export function bindFileIO ({ doc, designer, modelSel, host, flash, flushSource }) {
    bindOpen(doc, designer, modelSel, host, flash, flushSource);
    bindSave(doc, host, flash, flushSource);
    bindProjectIO(doc, designer, modelSel, host, flash, flushSource);
}

function bindOpen (doc, designer, modelSel, host, flash, flushSource) {
    document.getElementById('openDoc').addEventListener('click', async () => {
        flushSource?.();
        if (doc.isDirty && !confirm('Open another DSPF and discard unsaved changes?')) return;
        try {
            const file = await host.openTextFile({ accept: '.dspf,.dds,.txt' });
            if (!file) return;
            const parsed = parseDspf(file.text);
            doc.adopt(parsed, { preserveAidActions: false });
            doc.sourceName = ibmiName(file.name.replace(/\.[^.]+$/, ''), 'DSPFILE');
            doc.resetHistory({ markClean: true });

            syncModelChrome(doc, modelSel, designer);
            designer.selectItem(null);
            flash(`Loaded ${file.name}: ${doc.records.length} records, ${doc.itemCount()} items.`, 'ok');
        } catch (err) {
            console.error('[ironterm] open failed:', err);
            flash(`Open failed: ${err.message}`, 'error', 4000);
        }
    });
}

function syncModelChrome (doc, modelSel, designer) {
    modelSel.value = doc.modelKey;
    document.body.classList.toggle('wide-mode', doc.modelKey === '27x132');
    requestAnimationFrame(() => designer.forceResize());
}

function bindSave (doc, host, flash, flushSource) {
    document.getElementById('saveDoc').addEventListener('click', async () => {
        try {
            flushSource?.();
            const source = writeDspf(doc);
            const name = (doc.sourceName || 'DSPFILE') + '.DSPF';
            await host.saveTextFile({ suggestedName: name, text: source });
            if (!doc.aidActions.length) doc.markClean();
            flash(doc.aidActions.length
                ? `Exported ${name}. Save the RAD project too to keep key actions.`
                : `Saved ${name}.`, 'ok', 5000);
        } catch (err) {
            console.error('[ironterm] save failed:', err);
            flash(`Save failed: ${err.message}`, 'error');
        }
    });
}

function bindProjectIO (doc, designer, modelSel, host, flash, flushSource) {
    document.getElementById('openProject')?.addEventListener('click', async () => {
        flushSource?.();
        if (doc.isDirty && !confirm('Open another RAD project and discard unsaved changes?')) return;
        try {
            const file = await host.openTextFile({ accept: '.json,.dspfrad.json' });
            if (!file) return;
            const data = JSON.parse(file.text);
            if (data.format && data.format !== 'DSPF-RAD') {
                throw new Error(`Unsupported project format: ${data.format}`);
            }
            const payload = data.document ?? data;
            if (!Array.isArray(payload?.records) || !payload.records.length) {
                throw new Error('The file does not contain a DSPF-RAD document.');
            }
            const restored = DspfDocument.fromJSON(payload);
            doc.sourceName = restored.sourceName;
            doc.showOverlay = restored.showOverlay;
            doc.hideConditioned = restored.hideConditioned;
            doc.adopt(restored, { preserveAidActions: false });
            doc.resetHistory({ markClean: true });
            syncModelChrome(doc, modelSel, designer);
            designer.selectItem(null);
            flash(`Loaded RAD project ${file.name}.`, 'ok');
        } catch (error) {
            console.error('[ironterm] project open failed:', error);
            flash(`Project open failed: ${error.message}`, 'error', 5000);
        }
    });
    document.getElementById('saveProject')?.addEventListener('click', async () => {
        try {
            flushSource?.();
            const project = {
                // Keep the established format identifier for backward compatibility.
                format: 'DSPF-RAD', version: 1,
                document: doc.toJSON(),
            };
            const name = `${doc.sourceName || 'DSPFILE'}.dspfrad.json`;
            await host.saveTextFile({
                suggestedName: name,
                text: JSON.stringify(project, null, 2) + '\n',
                mime: 'application/json;charset=utf-8',
            });
            doc.markClean();
            flash(`Saved RAD project ${name}.`, 'ok');
        } catch (error) {
            console.error('[ironterm] project save failed:', error);
            flash(`Project save failed: ${error.message}`, 'error', 5000);
        }
    });
}
