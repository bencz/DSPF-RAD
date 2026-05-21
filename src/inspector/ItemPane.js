// Item tab: stitches the per-item sections together in the right order.
// Each section module owns one slice of the inspector UI.

import { emptyNote } from './dom.js';

import { renderPosition, renderKindBlock } from './item/identity.js';
import { renderTextDesc, renderDftVal, renderEditWord } from './item/text.js';
import { renderRefFld } from './item/refField.js';
import { renderValidation, renderCheck } from './item/validation.js';
import { renderDateTimeFormat } from './item/dateTime.js';
import { renderChoiceList } from './item/choices.js';
import { renderDspatrChips, renderColor, renderEdtCde } from './item/attributes.js';
import {
    renderConditioning, renderOtherKeywords, renderItemActions,
} from './item/conditioning.js';

export function renderItemPane (pane, ctx) {
    const item = ctx.selectedItem;
    if (!item) {
        emptyNote(pane, 'No item selected.');
        return;
    }

    renderPosition(pane, item, ctx);
    renderKindBlock(pane, item, ctx);

    renderTextDesc(pane, item, ctx);
    if (item.refField) renderRefFld(pane, item, ctx);
    renderDftVal(pane, item, ctx);
    renderValidation(pane, item, ctx);
    renderEditWord(pane, item, ctx);
    renderDateTimeFormat(pane, item, ctx);
    renderCheck(pane, item, ctx);
    renderChoiceList(pane, item, ctx);

    renderConditioning(pane, item, ctx);
    renderDspatrChips(pane, item, ctx);
    renderColor(pane, item, ctx);
    renderEdtCde(pane, item, ctx);
    renderOtherKeywords(pane, item, ctx);

    renderItemActions(pane, item, ctx);
}
