import editorMarkup from './dspf-editor.html?raw';
import { HtmlTemplateView } from '../../workbench/views/HtmlTemplateView.js';

export class DspfEditorView extends HtmlTemplateView {
    constructor ({ documentRef }) {
        super({ documentRef, markup: editorMarkup });
    }

    mount ({ contentHost, overlayHost }) {
        const fragment = this.createFragment();
        const dialogs = [...fragment.querySelectorAll('dialog')];
        for (const dialog of dialogs) overlayHost.append(dialog);
        contentHost.append(fragment);
    }
}
