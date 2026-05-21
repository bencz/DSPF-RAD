// Record tab: stitches the per-record sections together.  Record[0]
// gets the additional file-level sections since DSPF lands doc-level
// keywords there after parse.

import { emptyNote } from './dom.js';

import { renderRecordIdentity, renderRecordStats } from './record/identity.js';
import { renderSubfile }       from './record/subfile.js';
import { renderWindowSpec }    from './record/window.js';
import { renderFunctionKeys }  from './record/functionKeys.js';
import {
    renderRecordOptions, renderEntryDefaults, renderCursorBinding,
} from './record/options.js';
import { renderMouseButtons, renderMnubarDsp } from './record/mouse.js';
import { renderHelp } from './record/help.js';
import { renderFileOptions, renderFileMisc } from './record/file.js';
import { renderKeywordsCatchAll, renderItemList } from './record/keywords.js';

export function renderRecordPane (pane, ctx) {
    const rec = ctx.activeRecord;
    if (!rec) {
        emptyNote(pane, 'No active record.');
        return;
    }

    renderRecordIdentity(pane, rec, ctx);
    renderRecordStats(pane, rec);

    if (rec.type === 'SFL' || rec.type === 'SFLCTL') renderSubfile(pane, rec, ctx);
    if (rec.type === 'WINDOW')                        renderWindowSpec(pane, rec, ctx);

    renderFunctionKeys(pane, rec, ctx);
    renderRecordOptions(pane, rec, ctx);
    renderEntryDefaults(pane, rec, ctx);
    renderCursorBinding(pane, rec, ctx);
    renderMouseButtons(pane, rec);
    renderMnubarDsp(pane, rec);
    renderHelp(pane, rec, ctx);

    if (rec === ctx.document.records[0]) {
        renderFileOptions(pane, rec, ctx);
        renderFileMisc(pane, rec, ctx);
    }

    renderKeywordsCatchAll(pane, rec, ctx);
    renderItemList(pane, rec, ctx);
}
