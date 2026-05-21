// Line-decoration field driven by a state effect.  The cursor↔item link
// uses it to highlight which item is selected on the canvas.

import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

export const setHighlightEffect = StateEffect.define();

export const highlightField = StateField.define({
    create: () => Decoration.none,
    update (deco, tr) {
        for (const e of tr.effects) {
            if (e.is(setHighlightEffect)) {
                return buildHighlights(tr.state, e.value);
            }
        }
        return deco.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f),
});

function buildHighlights (state, lines) {
    const builder = new RangeSetBuilder();
    const sorted  = (lines ?? []).slice().sort((a, b) => a - b);
    for (const line of sorted) {
        if (line < 1 || line > state.doc.lines) continue;
        const from = state.doc.line(line).from;
        builder.add(from, from, Decoration.line({ class: 'dspf-item-highlight' }));
    }
    return builder.finish();
}
