import { autocompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView, basicSetup } from 'codemirror';

import { clCodeMirrorExtensions } from './clCodeMirrorLanguage.js';
import { ddsCodeMirrorExtensions } from './ddsCodeMirrorLanguage.js';

export class SourceCodeEditor {
    #states = new Map();
    #activeDocument = null;
    #internal = false;

    constructor ({
        parent,
        languageServices,
        onDocumentChanged,
        onCursorChanged,
    }) {
        if (!parent) throw new TypeError('SourceCodeEditor requires a parent element.');
        if (!languageServices) throw new TypeError('SourceCodeEditor requires language services.');
        this.parent = parent;
        this.languageServices = languageServices;
        this.onDocumentChanged = onDocumentChanged;
        this.onCursorChanged = onCursorChanged;
        this.view = new EditorView({
            state: this.#createState({ text: '', languageId: 'plaintext', readOnly: false }),
            parent,
        });
    }

    get activeDocumentId () {
        return this.#activeDocument?.id ?? null;
    }

    open (document) {
        if (!document) throw new TypeError('SourceCodeEditor requires a source document.');
        if (this.#activeDocument?.id === document.id) return;
        if (this.#activeDocument) {
            this.#states.set(this.#activeDocument.id, this.view.state);
        }
        this.#activeDocument = document;
        const state = this.#states.get(document.id) ??
            this.#createState(document);
        this.#states.set(document.id, state);
        this.#internal = true;
        try {
            this.view.setState(state);
        } finally {
            this.#internal = false;
        }
        this.view.focus();
    }

    close (documentId) {
        this.#states.delete(documentId);
        if (this.#activeDocument?.id === documentId) this.#activeDocument = null;
    }

    focus () {
        this.view.focus();
    }

    destroy () {
        this.#states.clear();
        this.#activeDocument = null;
        this.view.destroy();
    }

    #createState ({ text, languageId, readOnly = false }) {
        const languageExtensions = this.#languageExtensions(languageId);
        return EditorState.create({
            doc: text,
            extensions: [
                basicSetup,
                EditorState.readOnly.of(readOnly),
                EditorView.editable.of(!readOnly),
                ...languageExtensions,
                autocompletion({
                    override: [context => this.#complete(context, languageId)],
                    activateOnTyping: true,
                    closeOnBlur: true,
                }),
                EditorView.updateListener.of(update => this.#handleUpdate(update)),
                EditorView.theme({
                    '&': { height: '100%' },
                    '.cm-scroller': {
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        lineHeight: '1.55',
                        overflow: 'auto',
                    },
                    '.cm-content': { padding: '8px 0 24px' },
                    '.cm-gutters': { minWidth: '42px' },
                }, { dark: true }),
            ],
        });
    }

    #languageExtensions (languageId) {
        if (languageId === 'cl') return clCodeMirrorExtensions;
        if (languageId.startsWith('dds')) return ddsCodeMirrorExtensions;
        return [];
    }

    #complete (context, languageId) {
        const result = this.languageServices.completions.complete({
            languageId,
            source: context.state.doc.toString(),
            offset: context.pos,
            explicit: context.explicit,
        });
        if (!result.items.length && !context.explicit) return null;
        return {
            from: result.from,
            to: result.to,
            options: result.items.map(item => ({
                label: item.label,
                type: completionType(item.type),
                detail: item.detail,
                apply: item.insertText,
                boost: item.boost,
            })),
            validFor: /^[A-Za-z0-9_$#@&*%]*$/,
        };
    }

    #handleUpdate (update) {
        if (this.#internal || !this.#activeDocument) return;
        if (update.docChanged) {
            this.onDocumentChanged?.(
                this.#activeDocument,
                update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) {
            const position = update.state.selection.main.head;
            const line = update.state.doc.lineAt(position);
            this.onCursorChanged?.({
                line: line.number,
                column: position - line.from + 1,
            });
        }
    }
}

function completionType (type) {
    if (type === 'command' || type === 'keyword') return 'keyword';
    if (type === 'value') return 'constant';
    if (type === 'variable') return 'variable';
    return type;
}
