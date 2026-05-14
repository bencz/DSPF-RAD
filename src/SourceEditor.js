// CodeMirror 6 wrapper for the bottom DSPF source panel.  Owns the
// EditorView and exposes a tiny façade so main.js doesn't have to know
// about CodeMirror APIs.  Two design notes worth keeping in mind:
//
//   1. setValue() / setCursorLine() / setHighlightLines() are *programmatic*
//      mutations.  They run inside an `_internal = true` flag so the
//      updateListener does NOT fire the user-change / cursor callbacks.
//      That breaks the canvas → source → canvas cycle that would
//      otherwise re-fire on every regen.
//
//   2. DSPF source is fixed-column.  The custom StreamLanguage tokenises
//      by column ranges (1-5 seq, 6 form-type, 8-16 indicators, 17-44
//      metadata, 45-80 keyword text) so highlighting matches what the
//      compiler actually sees.

// Imports resolve through the import map declared in index.html so every
// @codemirror/* package shares a single @codemirror/state / @codemirror/view
// instance.  Hard-coded esm.sh URLs would each pull their own copy of
// state, breaking the `instanceof` checks the View runs on extensions.
import { EditorView, basicSetup } from 'codemirror';
import {
    EditorState, StateField, StateEffect, RangeSetBuilder, Transaction,
} from '@codemirror/state';
import { Decoration, showPanel, ViewPlugin } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';
import {
    StreamLanguage, HighlightStyle, syntaxHighlighting,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';

// ---------------------------------------------------------------- DSPF lang

// Keyword universe surfaced via autocomplete.  Not exhaustive — IBM has
// hundreds of DSPF keywords — but covers everything this designer
// recognises plus the most common ones we want one-keystroke access to.
const DSPF_KEYWORDS = [
    'SFL', 'SFLCTL', 'MNUBAR', 'PULLDOWN', 'WINDOW',
    'DSPSIZ', 'PRINT', 'HELP', 'CHGINPDFT', 'ENTFLDATR', 'INDARA',
    'CHECK', 'EDTCDE', 'EDTWRD', 'REFFLD', 'CMPVAL', 'COMP', 'RANGE',
    'VALUES', 'ALIAS', 'TEXT', 'CHANGE', 'DUP', 'AUTO', 'MDTOFF',
    'DSPATR', 'COLOR', 'BLINK',
    'OVERLAY', 'ASSUME', 'ERASE', 'PROTECT', 'LOCK',
    'PUTOVR', 'PUTRETAIN', 'OVRDTA', 'OVRATR',
    'CA01','CA02','CA03','CA04','CA05','CA06','CA07','CA08',
    'CA09','CA10','CA11','CA12','CA13','CA14','CA15','CA16',
    'CA17','CA18','CA19','CA20','CA21','CA22','CA23','CA24',
    'CF01','CF02','CF03','CF04','CF05','CF06','CF07','CF08',
    'CF09','CF10','CF11','CF12','CF13','CF14','CF15','CF16',
    'CF17','CF18','CF19','CF20','CF21','CF22','CF23','CF24',
    'HOME', 'ROLLUP', 'ROLLDOWN', 'PAGEUP', 'PAGEDOWN', 'CLEAR',
    'SFLPAG', 'SFLSIZ', 'SFLDSP', 'SFLDSPCTL', 'SFLCLR', 'SFLEND',
    'SFLNXTCHG', 'SFLRCDNBR', 'SFLLIN', 'SFLFOLD', 'SFLDROP',
    'SFLMSG', 'SFLMSGRCD', 'SFLMSGKEY', 'SFLPGMQ', 'SFLINZ',
    'DATFMT', 'DATSEP', 'TIMFMT', 'TIMSEP',
    'DATE', 'TIME', 'USER', 'SYSNAME', 'USRNAME',
    'DATEUSA', 'TIMEUSA', 'EUROPE', 'JOBNAME', 'NETID',
    'SNGCHCFLD', 'MLTCHCFLD', 'CHOICE', 'CHOICEACC',
    'PSHBTNFLD', 'PSHBTNCHC', 'PUSHBTNFLD', 'PUSHBTNCHC',
    'MNUBARDSP', 'MNUBARCHC', 'CNTFLD', 'ERRMSG', 'ERRMSGID',
    'WDWBORDER', 'WDWTITLE',
];

const DSPATR_FLAGS = ['HI', 'RI', 'UL', 'BL', 'ND', 'PC', 'PR', 'CS'];
const COLORS       = ['GRN', 'WHT', 'RED', 'TRQ', 'YLW', 'PNK', 'BLU'];

// Returns the matching DSPF completion set for the cursor position.
// Context-sensitive: inside DSPATR(...) → flags, inside COLOR(...) →
// colours, otherwise → the keyword universe.
function dspfCompletions (context) {
    const word = context.matchBefore(/[A-Za-z][A-Za-z0-9_]*$/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const line = context.state.doc.lineAt(context.pos);
    const lineText = line.text;
    const colInLine = context.pos - line.from;

    // Walk left from cursor to find the enclosing '(' (if any) and grab
    // the keyword name immediately before it.  Skips balanced inner ().
    let depth = 0;
    let openIdx = -1;
    for (let i = colInLine - 1; i >= 0; i--) {
        const c = lineText[i];
        if (c === ')') depth++;
        else if (c === '(') {
            if (depth === 0) { openIdx = i; break; }
            depth--;
        }
    }
    if (openIdx >= 0) {
        const head = lineText.slice(0, openIdx).match(/([A-Za-z][A-Za-z0-9]*)\s*$/);
        const kw = head?.[1]?.toUpperCase();
        if (kw === 'DSPATR') {
            return {
                from: word.from,
                options: DSPATR_FLAGS.map(f => ({
                    label: f, type: 'enum', detail: 'display attr',
                })),
                validFor: /^[A-Za-z]*$/,
            };
        }
        if (kw === 'COLOR') {
            return {
                from: word.from,
                options: COLORS.map(c => ({
                    label: c, type: 'enum', detail: 'colour',
                })),
                validFor: /^[A-Za-z]*$/,
            };
        }
    }

    return {
        from: word.from,
        options: DSPF_KEYWORDS.map(kw => ({
            label: kw, type: 'keyword',
        })),
        validFor: /^[A-Za-z0-9_]*$/,
    };
}

// Column-aware DSPF stream tokenizer.  The state.inString flag survives
// across token() calls inside a single line; we reset it at SOL because
// our writer never wraps strings across lines (uses `+` not `-`).
const dspfStreamLang = StreamLanguage.define({
    name: 'dspf',
    startState: () => ({ inString: false }),
    token (stream, state) {
        if (stream.sol()) state.inString = false;
        const col = stream.pos + 1;          // 1-indexed column

        if (state.inString) {
            while (!stream.eol()) {
                const ch = stream.next();
                if (ch === "'") {
                    if (stream.peek() === "'") { stream.next(); continue; }
                    state.inString = false;
                    return 'string';
                }
            }
            return 'string';
        }

        // Sequence number area (cols 1-5).  An asterisk in col 1 = whole-
        // line comment in DSPF (rare but legal).
        if (col >= 1 && col <= 5) {
            if (col === 1 && stream.peek() === '*') {
                stream.skipToEnd();
                return 'comment';
            }
            stream.next();
            return 'lineComment';
        }

        // Form-type at col 6: 'A' for DSPF lines, '*' for comments.
        if (col === 6) {
            const ch = stream.next();
            if (ch === '*') { stream.skipToEnd(); return 'comment'; }
            if (ch === 'A' || ch === 'a') return 'meta';
            return null;
        }
        if (col === 7) { stream.next(); return null; }

        // Indicator slots cols 8-16 (three 3-char chunks).
        if (col >= 8 && col <= 16) {
            const ch = stream.next();
            return /[A-Za-z0-9]/.test(ch) ? 'atom' : null;
        }

        // Metadata cols 17-44: name (19-28), refFlag (29), length (30-34),
        // type (35), decimals (36-37), usage (38), row (39-41), col (42-44).
        if (col >= 17 && col <= 44) {
            if (stream.match(/[A-Za-z][A-Za-z0-9_]*/)) return 'variableName';
            if (stream.match(/[0-9]+/))              return 'number';
            stream.next();
            return null;
        }

        // Keyword area col 45+: keyword names, args inside parens, quoted
        // literals, system value names.
        if (col >= 45) {
            const ch = stream.peek();
            if (ch === "'") {
                stream.next();
                state.inString = true;
                while (!stream.eol()) {
                    const c = stream.next();
                    if (c === "'") {
                        if (stream.peek() === "'") { stream.next(); continue; }
                        state.inString = false;
                        return 'string';
                    }
                }
                return 'string';
            }
            if (/[A-Za-z]/.test(ch)) {
                stream.eatWhile(/[A-Za-z0-9_]/);
                return 'keyword';
            }
            if (/[0-9]/.test(ch)) {
                stream.eatWhile(/[0-9.\-+]/);
                return 'number';
            }
            if (ch === '(' || ch === ')') {
                stream.next();
                return 'bracket';
            }
            if (ch === '+' || ch === '-') {
                stream.next();
                return 'meta';        // continuation marker at line tail
            }
            stream.next();
            return null;
        }

        stream.next();
        return null;
    },
});

const dspfHighlight = HighlightStyle.define([
    { tag: tags.keyword,        color: '#6f6', fontWeight: 'bold' },
    { tag: tags.string,         color: '#ffd866' },
    { tag: tags.atom,           color: '#cc6' },
    { tag: tags.number,         color: '#3dd' },
    { tag: tags.variableName,   color: '#9cf' },
    { tag: tags.meta,           color: '#888' },
    { tag: tags.lineComment,    color: '#2a4a2a' },
    { tag: tags.comment,        color: '#555', fontStyle: 'italic' },
    { tag: tags.bracket,        color: '#888' },
]);

// ---------------------------------------------------------------- DDS ruler panel

// 80-character ruler that sits sticky at the top of the editor, aligned
// with the actual content column 1 (gutter offset measured at runtime).
// Line 1 is the classic SEU column ruler ("....+....1....+....2...").
// Line 2 names each DDS column zone, so the user sees at a glance where
// Name / Len / Function area / etc. begin.  Mirrors horizontal scroll
// so cols stay aligned when content scrolls.
//
//   cols 1-5  : sequence number
//   col   6   : form-type 'A'
//   cols 8-16 : 3 indicator slots (3 chars each)
//   col   17  : nameType ('R' on record lines, blank on field/constant)
//   cols 19-28: name
//   col   29  : refFlag ('R' for REFFLD)
//   cols 30-34: length
//   col   35  : data type
//   cols 36-37: decimals
//   col   38  : usage
//   cols 39-41: row
//   cols 42-44: column
//   cols 45-80: keyword/function area
const DSPF_RULER_COLS   =
    '....+....1....+....2....+....3....+....4....+....5....+....6....+....7....+....8';
const DSPF_RULER_LABELS =
    'Seq# A IndIndIndT Name      RLen  TDcURowColFunction/Keyword area              ';

function rulerPanelFactory (view) {
    const dom = document.createElement('div');
    dom.className = 'dspf-ruler';

    const inner = document.createElement('div');
    inner.className = 'dspf-ruler-inner';

    const colsLine = document.createElement('div');
    colsLine.className = 'dspf-ruler-cols';
    colsLine.textContent = DSPF_RULER_COLS;

    const labelsLine = document.createElement('div');
    labelsLine.className = 'dspf-ruler-labels';
    labelsLine.textContent = DSPF_RULER_LABELS;

    inner.appendChild(colsLine);
    inner.appendChild(labelsLine);
    dom.appendChild(inner);

    // Mirror the editor's font metrics onto the ruler ONCE at mount.
    // Doing it inside sync() caused a pulse: each style write triggered
    // a sub-layout, the ResizeObserver fired, sync ran again, etc.  Font
    // metrics don't change at runtime so a one-shot is enough.
    const inheritFontMetricsOnce = () => {
        const cs = getComputedStyle(view.contentDOM);
        inner.style.fontFamily          = cs.fontFamily;
        inner.style.fontSize            = cs.fontSize;
        inner.style.fontWeight          = cs.fontWeight;
        inner.style.letterSpacing       = cs.letterSpacing;
        inner.style.fontFeatureSettings = cs.fontFeatureSettings;
        inner.style.fontVariantLigatures = cs.fontVariantLigatures;
        inner.style.lineHeight          = cs.lineHeight;
    };

    // Place the ruler's column 1 at the same pixel as the editor's column
    // 1.  We measure with `coordsAtPos(viewport.from)` — the first
    // currently-rendered position — instead of `coordsAtPos(0)`, because
    // position 0 leaves the DOM as soon as line 1 scrolls off, and the
    // call then returns null/stale and the ruler snaps back to the
    // fallback offset.  `viewport.from` is always rendered, and since all
    // lines start at the same x-coordinate in a non-wrapping monospace
    // editor any line's column 1 is a valid stand-in for col 1 overall.
    const measure = () => {
        const editorL = view.dom.getBoundingClientRect().left;
        let offset = 30;
        try {
            const doc = view.state.doc;
            if (doc.length > 0) {
                const pos       = view.viewport.from;
                const lineStart = doc.lineAt(pos).from;
                const coords    = view.coordsAtPos(lineStart);
                if (coords && coords.left != null) {
                    offset = coords.left - editorL;
                }
            }
        } catch (_) { /* during initial layout pos may not be measurable */ }
        const scroll = view.scrollDOM.scrollLeft;
        inner.style.paddingLeft = offset + 'px';
        inner.style.transform   = `translateX(${-scroll}px)`;
    };

    // Deferred sync — runs on next frame so we measure AFTER CodeMirror's
    // own DOM updates (click/type/focus all trigger an internal measure
    // pass that we'd otherwise read stale).  rAFs coalesce naturally so
    // back-to-back triggers don't pile up.
    let rafId = 0;
    const sync = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            measure();
        });
    };

    view.scrollDOM.addEventListener('scroll', sync, { passive: true });

    // ResizeObserver catches geometry shifts the update callback can miss
    // (line-number digit growth from 2→3 at line 100, panel drag handle,
    // window resize).
    let resizeObs = null;
    const observeGeometry = () => {
        const gutter = view.dom.querySelector('.cm-gutters');
        if (!gutter || !view.scrollDOM) return;
        resizeObs?.disconnect();
        resizeObs = new ResizeObserver(() => sync());
        resizeObs.observe(gutter);
        resizeObs.observe(view.scrollDOM);
    };

    // Initial setup after CodeMirror's first measurement pass.
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

// ---------------------------------------------------------------- highlight field

// State-effect carrying the array of line numbers (1-indexed) to highlight,
// and a StateField that builds line-decorations from the latest effect.
// Used by the cursor↔item link so the source side shows which item is
// currently selected on the canvas.
const setHighlightEffect = StateEffect.define();
const highlightField = StateField.define({
    create: () => Decoration.none,
    update (deco, tr) {
        for (const e of tr.effects) {
            if (e.is(setHighlightEffect)) {
                const builder = new RangeSetBuilder();
                const lines = (e.value ?? []).slice().sort((a, b) => a - b);
                for (const line of lines) {
                    if (line < 1 || line > tr.state.doc.lines) continue;
                    const from = tr.state.doc.line(line).from;
                    builder.add(from, from, Decoration.line({
                        class: 'dspf-item-highlight',
                    }));
                }
                return builder.finish();
            }
        }
        return deco.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f),
});

// ---------------------------------------------------------------- column marker

// Thin vertical bar tracking the cursor's pixel-x.  Implemented as a
// ViewPlugin that:
//   1. Appends its <div> inside `view.scrollDOM` (the .cm-scroller).
//      That element is owned by CodeMirror's render pipeline and never
//      removed — far safer than `view.dom`, which has occasionally lost
//      external children when panels remount.
//   2. Reads the cursor's screen position from the actual `.cm-cursor`
//      element in the DOM, not via `coordsAtPos`.  The cursor element is
//      whatever CodeMirror visually paints as the caret, so wherever it
//      sits is exactly the column we want the bar at.  `coordsAtPos` can
//      return null when the measurement cache hasn't caught up with the
//      latest selection (the previous symptom: bar vanishing after a
//      click).  A `coordsAtPos` fallback handles blur / unfocused state.
//   3. Spans the full scrollHeight so any vertical scroll position shows
//      the bar across the visible portion.
const cursorColMarkerPlugin = ViewPlugin.fromClass(class {
    constructor (view) {
        this.view = view;
        this.dom = document.createElement('div');
        this.dom.className = 'dspf-col-marker-bar';
        // Inline layout styles applied BEFORE the child enters the DOM so
        // CodeMirror's first flex-layout pass on `.cm-scroller` treats us
        // as out-of-flow immediately.  Without these the bar briefly
        // participates in the flex row, shifts `.cm-content`'s left
        // offset, and invalidates CM6's coord cache on the very first
        // measure.  Start offscreen — position() corrects in the next rAF.
        this.dom.style.position = 'absolute';
        this.dom.style.top      = '0';
        this.dom.style.left     = '-9999px';
        this.dom.style.width    = '1px';
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
    // rAF runs AFTER the current synchronous dispatch (CM6 has finished
    // both its measure and write passes by then), so coordsAtPos reads
    // from the freshly updated layout cache.  requestMeasure({read})
    // would fire DURING the measure phase, before CM6's own write phase
    // commits the new cursor's DOM position — that's why the previous
    // attempt left the bar trailing.
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
        } catch (_) { /* nothing measurable yet (initial layout) */ }
        if (!coords) {
            // Retry on the next frame; CM6's coord cache may still be
            // catching up on the first paint after mount.
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

// ---------------------------------------------------------------- SourceEditor

export class SourceEditor {
    constructor (parent, { onUserChange, onCursorChange } = {}) {
        this._internal       = false;     // suppress events during programmatic edits
        this._onUserChange   = onUserChange;
        this._onCursorChange = onCursorChange;

        const updateListener = EditorView.updateListener.of((update) => {
            if (this._internal) return;
            if (update.docChanged && this._onUserChange) {
                this._onUserChange(update.state.doc.toString());
            }
            if (update.selectionSet && !update.docChanged && this._onCursorChange) {
                const sel = update.state.selection.main;
                const line = update.state.doc.lineAt(sel.head).number;
                this._onCursorChange(line);
            }
        });

        const state = EditorState.create({
            doc: '',
            extensions: [
                basicSetup,
                dspfStreamLang,
                syntaxHighlighting(dspfHighlight),
                autocompletion({
                    override:        [dspfCompletions],
                    activateOnTyping: true,
                    closeOnBlur:     true,
                }),
                highlightField,
                showPanel.of(rulerPanelFactory),
                cursorColMarkerPlugin,
                updateListener,
                EditorView.theme({
                    '&':                { height: '100%' },
                    '.cm-scroller':     { fontFamily: 'inherit', overflow: 'auto' },
                    '.cm-content':      { padding: '4px 0' },
                }, { dark: true }),
            ],
        });

        this.view = new EditorView({ state, parent });
    }

    setValue (text) {
        const cur = this.view.state.doc.toString();
        if (cur === text) return;                 // no-op avoids cursor jumps
        this._internal = true;
        try {
            // `addToHistory.of(false)` keeps this programmatic replacement
            // OUT of the undo stack — Ctrl+Z must not roll back to whatever
            // was loaded before the user clicked Open / New, nor to the
            // pre-canvas-edit source.  Only user keystrokes inside the
            // editor itself get recorded in history.
            this.view.dispatch({
                changes: { from: 0, to: this.view.state.doc.length, insert: text },
                annotations: Transaction.addToHistory.of(false),
            });
        } finally {
            this._internal = false;
        }
    }

    getValue () { return this.view.state.doc.toString(); }

    /** Move the cursor to the start of the given 1-indexed line and
     *  scroll it into view.  Suppresses the onCursorChange callback so
     *  programmatic navigation from canvas selection doesn't re-trigger
     *  a canvas update. */
    setCursorLine (line) {
        const doc = this.view.state.doc;
        if (!line || line < 1 || line > doc.lines) return;
        const pos = doc.line(line).from;
        this._internal = true;
        try {
            this.view.dispatch({
                selection: { anchor: pos, head: pos },
                scrollIntoView: true,
            });
        } finally {
            this._internal = false;
        }
    }

    getCursorLine () {
        const sel = this.view.state.selection.main;
        return this.view.state.doc.lineAt(sel.head).number;
    }

    /** Highlight (lightly tint + left accent) the given 1-indexed line
     *  numbers.  Pass an empty array to clear. */
    setHighlightLines (lines) {
        this.view.dispatch({ effects: setHighlightEffect.of(lines ?? []) });
    }

    /** Show or hide the vertical column marker that tracks the cursor.
     *  Toggles a `.show` class directly on the bar element instead of on
     *  `view.dom`: CodeMirror rewrites `view.dom`'s className whenever
     *  its computed `editorAttributes` change (e.g. focus/blur), which
     *  silently drops any class we added with classList.toggle.  The bar
     *  itself is our own DOM and CM6 never touches it. */
    setCursorColumnMarker (enabled) {
        const bar = this.view.scrollDOM.querySelector('.dspf-col-marker-bar');
        if (bar) bar.classList.toggle('show', !!enabled);
    }

    focus () { this.view.focus(); }
    destroy () { this.view.destroy(); }
}
