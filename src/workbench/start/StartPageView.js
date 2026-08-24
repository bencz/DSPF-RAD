import startPageMarkup from './start-page.html?raw';
import { HtmlTemplateView } from '../views/HtmlTemplateView.js';

export class StartPageView extends HtmlTemplateView {
    constructor ({ documentRef }) {
        super({ documentRef, markup: startPageMarkup });
    }

    mount (host) {
        host.append(this.createFragment());
    }
}
