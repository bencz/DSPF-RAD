import { DspfEditorView } from '../../features/dspf-designer/DspfEditorView.js';
import { WorkbenchShellView } from '../shell/WorkbenchShellView.js';
import { StartPageView } from '../start/StartPageView.js';

export class WorkbenchView {
    constructor ({ documentRef }) {
        this.document = documentRef;
        this.shell = new WorkbenchShellView({ documentRef });
        this.startPage = new StartPageView({ documentRef });
        this.dspfEditor = new DspfEditorView({ documentRef });
    }

    mount () {
        const applicationHost = this.document.getElementById('app');
        if (!applicationHost) throw new Error('Application host #app was not found.');

        const contentHost = this.shell.mount(applicationHost);
        this.startPage.mount(contentHost);
        this.dspfEditor.mount({
            contentHost,
            overlayHost: this.document.body,
        });
    }
}
