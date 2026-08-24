import editorMarkup from './source-code-editor.html?raw';
import { HtmlTemplateView } from '../../workbench/views/HtmlTemplateView.js';

export class SourceCodeEditorView extends HtmlTemplateView {
    constructor ({ documentRef }) {
        super({ documentRef, markup: editorMarkup });
    }

    mount (host) {
        host.append(this.createFragment());
    }
}
