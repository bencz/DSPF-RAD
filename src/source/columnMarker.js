// Thin vertical bar tracking the cursor's pixel-x.  Implemented as a
// ViewPlugin to:
//
//   1. Mount inside `view.scrollDOM` (the .cm-scroller) — that element is
//      owned by CodeMirror's render pipeline and never removed.  Mounting
//      on `view.dom` lost the child on panel remount.
//
//   2. Read the cursor's screen position from `coordsAtPos` AFTER the
//      sync dispatch completes.  Doing it during the measure phase
//      (requestMeasure) left the bar trailing CM6's own write phase.
//
//   3. Span the full scrollHeight so any vertical scroll position shows
//      the bar across the visible portion.

import { ViewPlugin } from '@codemirror/view';

export const cursorColMarkerPlugin = ViewPlugin.fromClass(class {
    constructor (view) {
        this.view = view;
        this.dom  = document.createElement('div');
        this.dom.className = 'dspf-col-marker-bar';
        // Inline layout styles applied BEFORE mount so CodeMirror's first
        // flex-layout pass treats us as out-of-flow immediately.  Without
        // these the bar briefly participates in the flex row, shifts
        // .cm-content's left offset, and invalidates the coord cache on
        // the very first measure.  Start offscreen — position() corrects.
        Object.assign(this.dom.style, {
            position: 'absolute',
            top:      '0',
            left:     '-9999px',
            width:    '1px',
        });
        view.scrollDOM.appendChild(this.dom);

        this._raf = 0;
        this._onScroll = () => this.schedule();
        view.scrollDOM.addEventListener('scroll', this._onScroll, { passive: true });
        this.schedule();
    }

    update (update) {
        if (update.selectionSet || update.geometryChanged ||
            update.viewportChanged || update.docChanged ||
            update.focusChanged) {
            this.schedule();
        }
    }

    schedule () {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
            this._raf = 0;
            this.position();
        });
    }

    position () {
        const sel = this.view.state.selection.main;
        let coords;
        try {
            coords = this.view.coordsAtPos(sel.head, 1)
                  ?? this.view.coordsAtPos(sel.head, -1);
        } catch (_) { /* not measurable yet (initial layout) */ }
        if (!coords) {
            // CM6's coord cache may still be catching up on first paint —
            // retry on the next frame.
            requestAnimationFrame(() => this.position());
            return;
        }
        const scrollRect = this.view.scrollDOM.getBoundingClientRect();
        const left = coords.left - scrollRect.left + this.view.scrollDOM.scrollLeft;
        if (left < 0) return;
        this.dom.style.left = left + 'px';
        const h = Math.max(this.view.scrollDOM.scrollHeight,
                           this.view.scrollDOM.clientHeight);
        this.dom.style.height = h + 'px';
    }

    destroy () {
        this.view.scrollDOM.removeEventListener('scroll', this._onScroll);
        if (this._raf) cancelAnimationFrame(this._raf);
        this.dom.remove();
    }
});
