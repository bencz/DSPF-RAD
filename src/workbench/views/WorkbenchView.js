import { DspfEditorView } from '../../features/dspf-designer/DspfEditorView.js';
import { SourceCodeEditorView } from '../../features/source-code/SourceCodeEditorView.js';
import { WorkbenchShellView } from '../shell/WorkbenchShellView.js';
import { StartPageView } from '../start/StartPageView.js';
import { WorkbenchAreaView } from '../layout/WorkbenchAreaView.js';
import { ProjectExplorerView } from '../explorer/ProjectExplorerView.js';

export class WorkbenchView {
    constructor ({ documentRef }) {
        this.document = documentRef;
        this.shell = new WorkbenchShellView({ documentRef });
        this.area = new WorkbenchAreaView({ documentRef });
        this.projectExplorer = new ProjectExplorerView({ documentRef });
        this.startPage = new StartPageView({ documentRef });
        this.dspfEditor = new DspfEditorView({ documentRef });
        this.sourceCodeEditor = new SourceCodeEditorView({ documentRef });
    }

    mount () {
        const applicationHost = this.document.getElementById('app');
        if (!applicationHost) throw new Error('Application host #app was not found.');

        const contentHost = this.shell.mount(applicationHost);
        const { explorerHost, editorHost } = this.area.mount(contentHost);
        this.projectExplorer.mount(explorerHost);
        this.startPage.mount(editorHost);
        this.dspfEditor.mount({
            contentHost: editorHost,
            overlayHost: this.document.body,
        });
        this.sourceCodeEditor.mount(editorHost);
    }
}
