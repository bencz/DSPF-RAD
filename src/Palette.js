// Palette: HTML5 drag source + click-to-place fallback.
//
// HTML5 drag/drop is finicky across browsers - sometimes a custom MIME
// silently fails or the dataTransfer reads empty inside the drop
// handler.  We:
//   - publish two MIMEs at dragstart (custom + text/plain) for robustness
//   - log every dragstart so you can confirm the source fired
//   - expose a "click-to-place" mode: click a palette pill, then click
//     the canvas to drop.  Works even when HTML5 drag is broken.

const MIME_DSPF = 'application/x-dspf-item';
const MIME_TEXT = 'text/plain';

export class Palette {
    constructor (rootEl) {
        this.root = rootEl;
        this._armedSpec = null;
        this._armedEl   = null;
        this.root.addEventListener('dragstart', (ev) => this._onDragStart(ev));
        this.root.addEventListener('dragend',   (ev) => this._onDragEnd(ev));
        this.root.addEventListener('click',     (ev) => this._onClick(ev));
    }

    // ---- public API (consumed by Designer) ----
    getArmedSpec () { return this._armedSpec; }
    clearArmed () {
        if (this._armedEl) this._armedEl.classList.remove('palette-armed');
        this._armedSpec = null;
        this._armedEl   = null;
    }

    // ---- events ----
    _onClick (ev) {
        const el = ev.target.closest('.palette-item');
        if (!el) return;
        if (this._armedEl === el) {
            console.debug('[palette] disarmed', el);
            this.clearArmed();
            return;
        }
        this.clearArmed();
        const spec = readSpec(el);
        this._armedSpec = spec;
        this._armedEl   = el;
        el.classList.add('palette-armed');
        console.debug('[palette] armed for click-to-place', spec);
    }

    _onDragStart (ev) {
        const el = ev.target.closest('.palette-item');
        if (!el || !ev.dataTransfer) {
            console.debug('[palette] dragstart bailout', { target: ev.target, dt: ev.dataTransfer });
            return;
        }
        const spec = readSpec(el);
        const json = JSON.stringify(spec);
        try {
            ev.dataTransfer.setData(MIME_DSPF,  json);
            ev.dataTransfer.setData(MIME_TEXT, json);
            ev.dataTransfer.effectAllowed = 'copy';
        } catch (e) {
            console.warn('[palette] setData failed:', e);
        }
        // Tiny drag image so we don't snapshot the whole palette pill.
        try {
            const ghost = document.createElement('span');
            ghost.textContent = spec.label ?? spec.kind;
            ghost.style.cssText =
                'position:absolute;top:-1000px;padding:2px 6px;'
              + 'background:#0e0e0e;color:#6f6;border:1px solid #6f6;'
              + 'border-radius:2px;font-family:monospace;font-size:11px;';
            document.body.appendChild(ghost);
            ev.dataTransfer.setDragImage(ghost, 4, 4);
            requestAnimationFrame(() => ghost.remove());
        } catch (e) {
            console.warn('[palette] setDragImage failed:', e);
        }
        console.debug('[palette] dragstart', spec);
    }

    _onDragEnd (ev) {
        // Reserved for future cleanup; currently the canvas drop handler
        // is responsible for clearing its own preview state.
        console.debug('[palette] dragend');
    }
}

function readSpec (el) {
    const ds = el.dataset;
    const spec = {
        kind:  ds.kind ?? 'constant',
        label: el.querySelector('.pi-label')?.textContent.trim(),
    };
    if (ds.text)    spec.text    = ds.text;
    if (ds.name)    spec.name    = ds.name;
    if (ds.length)  spec.length  = parseInt(ds.length, 10);
    if (ds.dspatr)  spec.dspatr  = ds.dspatr.split(',').map(s => s.trim()).filter(Boolean);
    if (ds.color)   spec.color   = ds.color;
    if (ds.edtcde)  spec.edtcde  = ds.edtcde;
    if (ds.sys)     spec.sys     = ds.sys;
    return spec;
}

/** Parse a drop event into a spec, or null if the drop didn't come from
 *  our palette.  Tries the custom MIME first, then text/plain. */
export function readDropSpec (ev) {
    const dt = ev.dataTransfer;
    if (!dt) return null;
    let raw = '';
    try { raw = dt.getData(MIME_DSPF); } catch (_) {}
    if (!raw) {
        try { raw = dt.getData(MIME_TEXT); } catch (_) {}
    }
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { return null; }
}

export function specWidth (spec) {
    if (!spec) return 1;
    if (spec.kind === 'constant') return Math.max(1, (spec.text ?? '').length);
    if (spec.kind === 'sysvalue') {
        const w = { DATE: 8, TIME: 8, USER: 10, SYSNAME: 8, USRNAME: 10 };
        return w[spec.sys ?? 'DATE'] ?? 8;
    }
    if (spec.kind === 'pushbtn')       return 6;    // "[OK]"
    if (spec.kind === 'pushbtnGroup')  return 22;
    if (spec.kind === 'radio'    || spec.kind === 'checkbox')   return 10;
    if (spec.kind === 'radioGroup' || spec.kind === 'checkGroup') return 12;
    if (spec.kind === 'mnubar')        return 20;
    if (spec.kind === 'cntfld')        return 60;
    if (spec.kind === 'errmsg')        return 60;
    return Math.max(1, spec.length ?? 10);
}
