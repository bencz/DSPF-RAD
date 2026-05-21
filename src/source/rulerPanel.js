// Sticky 80-col DDS ruler that pins to the top of the editor.
//
// Line 1 is the classic SEU ruler (....+....1....+....2....).
// Line 2 names each DDS column zone so the user can see at a glance
// where Name / Len / Function area / etc. begin.
//
// Stays aligned with the actual content column 1: we measure the gutter
// offset at runtime via coordsAtPos and mirror the editor's horizontal
// scroll via a translate.

const DSPF_RULER_COLS =
    '....+....1....+....2....+....3....+....4....+....5....+....6....+....7....+....8';

// Each label aligned to its DSPF column:
//   cols 1-5  : Seq#
//   col   6   : A (form-type)
//   cols 8-16 : 3 indicator slots (3 chars each)
//   col   17  : nameType
//   cols 19-28: name
//   col   29  : refFlag
//   cols 30-34: length
//   col   35  : data type
//   cols 36-37: decimals
//   col   38  : usage
//   cols 39-41: row
//   cols 42-44: column
//   cols 45-80: keyword/function area
const DSPF_RULER_LABELS =
    'Seq# A IndIndIndT Name      RLen  TDcURowColFunction/Keyword area              ';

export function rulerPanelFactory (view) {
    const dom = document.createElement('div');
    dom.className = 'dspf-ruler';

    const inner = document.createElement('div');
    inner.className = 'dspf-ruler-inner';
    inner.appendChild(makeLine('dspf-ruler-cols',   DSPF_RULER_COLS));
    inner.appendChild(makeLine('dspf-ruler-labels', DSPF_RULER_LABELS));
    dom.appendChild(inner);

    // Font metrics are read once at mount — copying every sync triggered
    // a measure pulse (ResizeObserver -> sync -> style write -> RO again).
    const inheritFontMetricsOnce = () => {
        const cs = getComputedStyle(view.contentDOM);
        inner.style.fontFamily           = cs.fontFamily;
        inner.style.fontSize             = cs.fontSize;
        inner.style.fontWeight           = cs.fontWeight;
        inner.style.letterSpacing        = cs.letterSpacing;
        inner.style.fontFeatureSettings  = cs.fontFeatureSettings;
        inner.style.fontVariantLigatures = cs.fontVariantLigatures;
        inner.style.lineHeight           = cs.lineHeight;
    };

    // Use viewport.from instead of position 0: position 0 leaves the DOM
    // when line 1 scrolls off and coordsAtPos returns null/stale, snapping
    // the ruler back to the fallback offset.  viewport.from is always
    // rendered, and since all lines share x in a monospace editor, any
    // line's col 1 is a valid stand-in.
    const measure = () => {
        const editorL = view.dom.getBoundingClientRect().left;
        let offset = 30;
        try {
            const doc = view.state.doc;
            if (doc.length > 0) {
                const pos       = view.viewport.from;
                const lineStart = doc.lineAt(pos).from;
                const coords    = view.coordsAtPos(lineStart);
                if (coords && coords.left != null) offset = coords.left - editorL;
            }
        } catch (_) { /* not measurable during initial layout */ }
        const scroll = view.scrollDOM.scrollLeft;
        inner.style.paddingLeft = offset + 'px';
        inner.style.transform   = `translateX(${-scroll}px)`;
    };

    // Defer the measure to the next frame so we read AFTER CodeMirror's
    // own DOM updates (click / type / focus all trigger an internal pass
    // we'd otherwise read stale).  rAFs coalesce naturally so back-to-back
    // triggers don't pile up.
    let rafId = 0;
    const sync = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => { rafId = 0; measure(); });
    };

    view.scrollDOM.addEventListener('scroll', sync, { passive: true });

    // ResizeObserver catches geometry shifts the panel update can miss
    // (line-number digit growth from 2→3 at line 100, drag handle, window
    // resize).
    let resizeObs = null;
    const observeGeometry = () => {
        const gutter = view.dom.querySelector('.cm-gutters');
        if (!gutter || !view.scrollDOM) return;
        resizeObs?.disconnect();
        resizeObs = new ResizeObserver(() => sync());
        resizeObs.observe(gutter);
        resizeObs.observe(view.scrollDOM);
    };

    requestAnimationFrame(() => {
        inheritFontMetricsOnce();
        measure();
        observeGeometry();
    });

    return {
        dom,
        top: true,
        update: () => { sync(); if (!resizeObs) observeGeometry(); },
        destroy: () => {
            view.scrollDOM.removeEventListener('scroll', sync);
            resizeObs?.disconnect();
            if (rafId) cancelAnimationFrame(rafId);
        },
    };
}

function makeLine (cls, text) {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    return el;
}
