// CodeMirror 6 wrapper for the bottom DSPF source panel.  Owns the
// EditorView and exposes a small façade so main.js doesn't have to know
// about CodeMirror.
//
// Two design notes worth remembering:
//
//   1. setValue / setCursorLine / setHighlightLines are PROGRAMMATIC.
//      They run inside an `_internal = true` flag so the updateListener
//      does NOT fire onUserChange / onCursorChange.  That breaks the
//      canvas → source → canvas cycle that would otherwise re-fire on
//      every regen.
//
//   2. DSPF source is fixed-column.  Tokenisation + the sticky ruler
//      both live in their own modules and key off canvas columns.

// Imports resolve through the import map in index.html so every
// @codemirror/* package shares a single @codemirror/state instance.
// Hard-coded esm.sh URLs would each pull their own copy of state,
// breaking the `instanceof` checks the View runs on extensions.
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Transaction } from '@codemirror/state';
import { showPanel } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';

import { dspfLanguageExtensions } from './language.js';
import { dspfCompletions }        from './completions.js';
import { rulerPanelFactory }      from './rulerPanel.js';
import {
    highlightField, setHighlightEffect,
} from './highlightField.js';
import { cursorColMarkerPlugin }  from './columnMarker.js';

export class SourceEditor {
    constructor (parent, { onUserChange, onCursorChange } = {}) {
        this._internal       = false;       // suppress events during programmatic edits
        this._onUserChange   = onUserChange;
        this._onCursorChange = onCursorChange;

        const updateListener = EditorView.updateListener.of((update) => {
            if (this._internal) return;
            if (update.docChanged && this._onUserChange) {
                this._onUserChange(update.state.doc.toString());
            }
            if (update.selectionSet && !update.docChanged && this._onCursorChange) {
                const sel  = update.state.selection.main;
                const line = update.state.doc.lineAt(sel.head).number;
                this._onCursorChange(line);
            }
        });

        const state = EditorState.create({
            doc: '',
            extensions: [
                basicSetup,
                ...dspfLanguageExtensions,
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
                    '&':            { height: '100%' },
                    '.cm-scroller': { fontFamily: 'inherit', overflow: 'auto' },
                    '.cm-content':  { padding: '4px 0' },
                }, { dark: true }),
            ],
        });

        this.view = new EditorView({ state, parent });
    }

    setValue (text) {
        const cur = this.view.state.doc.toString();
        if (cur === text) return;                       // no-op avoids cursor jumps
        this._internal = true;
        try {
            // `addToHistory.of(false)` keeps this programmatic replacement
            // OUT of the undo stack.  Ctrl+Z must not roll back to
            // whatever was loaded before Open / New, nor to the pre-edit
            // source.  Only user keystrokes inside the editor record into
            // history.
            this.view.dispatch({
                changes: { from: 0, to: this.view.state.doc.length, insert: text },
                annotations: Transaction.addToHistory.of(false),
            });
        } finally {
            this._internal = false;
        }
    }

    getValue () { return this.view.state.doc.toString(); }

    // Move the cursor to line N (1-indexed) and scroll it into view.
    // Suppresses onCursorChange so a canvas-driven jump doesn't re-fire.
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

    // Highlight (tint + left accent) the given 1-indexed lines.  Empty
    // array clears.
    setHighlightLines (lines) {
        this.view.dispatch({ effects: setHighlightEffect.of(lines ?? []) });
    }

    // Toggle a class on the column-marker element (NOT on view.dom: CM6
    // rewrites view.dom's className whenever editorAttributes recompute,
    // which would silently strip anything we set there).
    setCursorColumnMarker (enabled) {
        const bar = this.view.scrollDOM.querySelector('.dspf-col-marker-bar');
        if (bar) bar.classList.toggle('show', !!enabled);
    }

    focus ()   { this.view.focus(); }
    destroy () { this.view.destroy(); }
}
