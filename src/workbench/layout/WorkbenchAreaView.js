import areaMarkup from './workbench-area.html?raw';
import { HtmlTemplateView } from '../views/HtmlTemplateView.js';

export class WorkbenchAreaView extends HtmlTemplateView {
    constructor ({ documentRef }) {
        super({ documentRef, markup: areaMarkup });
    }

    mount (host) {
        host.append(this.createFragment());
        const explorerHost = this.document.getElementById('projectExplorerHost');
        const editorHost = this.document.getElementById('editorPart');
        if (!explorerHost || !editorHost) {
            throw new Error('Workbench area hosts were not rendered.');
        }
        return Object.freeze({ explorerHost, editorHost });
    }
}
