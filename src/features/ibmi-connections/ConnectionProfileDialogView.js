import dialogMarkup from './connection-profile-dialog.html?raw';
import { HtmlTemplateView } from '../../workbench/views/HtmlTemplateView.js';

export class ConnectionProfileDialogView extends HtmlTemplateView {
    constructor ({ documentRef }) {
        super({ documentRef, markup: dialogMarkup });
    }

    mount (host) {
        host.append(this.createFragment());
    }
}
