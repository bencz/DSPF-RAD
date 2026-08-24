import explorerMarkup from './project-explorer.html?raw';
import { HtmlTemplateView } from '../views/HtmlTemplateView.js';

export class ProjectExplorerView extends HtmlTemplateView {
    constructor ({ documentRef }) {
        super({ documentRef, markup: explorerMarkup });
    }

    mount (host) {
        host.append(this.createFragment());
    }
}
