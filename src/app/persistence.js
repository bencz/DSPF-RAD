// Lightweight crash/session recovery.  The DSPF source remains the user's
// portable file; this local snapshot only protects work between downloads.

import { DspfDocument } from '../model/DspfDocument.js';
import { PRODUCT } from '../product.js';

// Legacy key is intentionally retained so the rebrand does not strand work.
const STORAGE_KEY = 'dspf-rad:autosave:v1';
const SAVE_DELAY_MS = 700;

export function recoverAutosave (doc) {
    const saved = readSnapshot();
    if (!saved?.document?.records?.length) return false;

    const when = saved.savedAt
        ? new Date(saved.savedAt).toLocaleString()
        : 'an earlier session';
    const recover = confirm(
        `Recover unsaved ${PRODUCT.name} work from ${when}?\n\n` +
        'Cancel discards the recovery snapshot and opens the IDE Start Page.');
    if (!recover) {
        clearSnapshot();
        return false;
    }

    try {
        const restored = DspfDocument.fromJSON(saved.document);
        doc.sourceName = restored.sourceName;
        doc.showOverlay = restored.showOverlay;
        doc.hideConditioned = restored.hideConditioned;
        doc.adopt(restored, { preserveAidActions: false });
        return true;
    } catch (error) {
        console.warn('[ironterm] autosave recovery failed:', error);
        clearSnapshot();
        return false;
    }
}

export function bindPersistence (doc) {
    let timer = null;

    const flush = () => {
        clearTimeout(timer);
        timer = null;
        if (!doc.isDirty) {
            clearSnapshot();
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                savedAt: new Date().toISOString(),
                document: doc.toJSON(),
            }));
        } catch (error) {
            console.warn('[ironterm] autosave unavailable:', error);
        }
    };

    doc.onChange((_doc, meta = {}) => {
        if (meta.transient) return;
        if (!doc.isDirty) {
            flush();
            return;
        }
        clearTimeout(timer);
        timer = setTimeout(flush, SAVE_DELAY_MS);
    });

    window.addEventListener('beforeunload', event => {
        if (!doc.isDirty) return;
        flush();
        event.preventDefault();
        event.returnValue = '';
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
    });

    return { flush };
}

function readSnapshot () {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function clearSnapshot () {
    try { localStorage.removeItem(STORAGE_KEY); }
    catch (_) { /* private browsing/storage disabled */ }
}
