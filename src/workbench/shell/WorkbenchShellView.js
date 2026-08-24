import shellMarkup from './workbench-shell.html?raw';
import { HtmlTemplateView } from '../views/HtmlTemplateView.js';

export class WorkbenchShellView extends HtmlTemplateView {
    constructor ({ documentRef }) {
        super({ documentRef, markup: shellMarkup });
    }

    mount (host) {
        host.replaceChildren(this.createFragment());
        const content = this.document.getElementById('workbenchContent');
        if (!content) throw new Error('Workbench content host was not rendered.');
        return content;
    }
}
