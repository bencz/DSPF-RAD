import { PRODUCT } from '../../product.js';
import { WorkbenchDocumentKind } from '../documents/WorkbenchDocument.js';

export class WorkbenchLayoutController {
    #disposeDocuments = null;

    constructor ({
        documents,
        startPage,
        dspfSurface,
        sourceCodeSurface,
        dspfStatusElements = [],
        sourceCodeStatusElements = [],
        interactionHint = null,
        documentRef = globalThis.document,
        windowRef = globalThis.window,
        onDspfShown = null,
    }) {
        if (!documents) throw new TypeError('WorkbenchLayoutController requires documents.');
        if (!startPage) throw new TypeError('WorkbenchLayoutController requires a start page.');
        if (!dspfSurface) throw new TypeError('WorkbenchLayoutController requires a DSPF surface.');
        if (!sourceCodeSurface) {
            throw new TypeError('WorkbenchLayoutController requires a source-code surface.');
        }
        this.documents = documents;
        this.startPage = startPage;
        this.dspfSurface = dspfSurface;
        this.sourceCodeSurface = sourceCodeSurface;
        this.dspfStatusElements = dspfStatusElements;
        this.sourceCodeStatusElements = sourceCodeStatusElements;
        this.interactionHint = interactionHint;
        this.document = documentRef;
        this.window = windowRef;
        this.onDspfShown = onDspfShown;
    }

    start () {
        this.stop();
        this.#disposeDocuments = this.documents.onDidChange(() => this.render());
        this.render();
    }

    stop () {
        this.#disposeDocuments?.();
        this.#disposeDocuments = null;
    }

    render () {
        const active = this.documents.activeDocument;
        const dspfActive = active?.kind === WorkbenchDocumentKind.DSPF_DESIGNER;
        const sourceCodeActive = active?.kind === WorkbenchDocumentKind.SOURCE_CODE;
        this.startPage.hidden = dspfActive || sourceCodeActive;
        this.dspfSurface.hidden = !dspfActive;
        this.sourceCodeSurface.hidden = !sourceCodeActive;
        this.document.body.classList.toggle(
            'start-page-active', !dspfActive && !sourceCodeActive);
        this.document.body.classList.toggle('dspf-designer-active', dspfActive);
        this.document.body.classList.toggle('source-code-active', sourceCodeActive);
        for (const element of this.dspfStatusElements) element.hidden = !dspfActive;
        for (const element of this.sourceCodeStatusElements) {
            element.hidden = !sourceCodeActive;
        }

        if (this.interactionHint) {
            this.interactionHint.textContent = dspfActive
                ? 'drag·click·arrows·Del'
                : sourceCodeActive
                    ? 'Ctrl+Space complete · Ctrl+S save'
                    : 'Ctrl+N new · Ctrl+O open';
            this.interactionHint.title = dspfActive
                ? 'Drag from palette · Click to select · Arrow keys to nudge (Shift = ×5) · Del to remove'
                : sourceCodeActive
                    ? 'Trigger contextual completion with Ctrl+Space and save with Ctrl+S'
                    : 'Create a new artifact with Ctrl+N or open a local source with Ctrl+O';
        }

        this.document.title = active
            ? `${active.isDirty ? '* ' : ''}${active.title} - ${PRODUCT.name}`
            : `${PRODUCT.name} - ${PRODUCT.description}`;

        if (dspfActive && typeof this.onDspfShown === 'function') {
            this.window.requestAnimationFrame(() => this.onDspfShown());
        }
    }
}
