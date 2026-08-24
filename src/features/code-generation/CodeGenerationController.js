import { generateCobol } from '../../codegen/cobol.js';
import { generateRpgle } from '../../codegen/rpgle.js';
import { usesIndara } from '../../codegen/analysis.js';
import { ibmiName } from '../../model/factories.js';
import { validateDspf } from '../../validation/validateDspf.js';

export class CodeGenerationController {
    #abortController = null;

    constructor ({
        doc,
        host,
        flash,
        flushSource,
        documentRef = globalThis.document,
        navigatorRef = globalThis.navigator,
        promptRef = globalThis.prompt,
        confirmRef = globalThis.confirm,
        alertRef = globalThis.alert,
        logger = globalThis.console,
    }) {
        if (!doc) throw new TypeError('CodeGenerationController requires a document.');
        if (!host) throw new TypeError('CodeGenerationController requires a host bridge.');
        this.doc = doc;
        this.host = host;
        this.flash = flash;
        this.flushSource = flushSource;
        this.document = documentRef;
        this.navigator = navigatorRef;
        this.prompt = promptRef;
        this.confirm = confirmRef;
        this.alert = alertRef;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;
        this.#bind('genRpgle', () => this.#exportRpgle(false), signal);
        this.#bind('regenRpgle', () => this.#exportRpgle(true), signal);
        this.#bind('genCobol', () => this.#exportCobol(false), signal);
        this.#bind('regenCobol', () => this.#exportCobol(true), signal);
        this.#bind('exportJson', () => this.#exportModelJson(), signal);
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
    }

    #bind (elementId, listener, signal) {
        this.document.getElementById(elementId)?.addEventListener('click', listener, { signal });
    }

    async #exportRpgle (mergeExisting) {
        this.flushSource?.();
        if (!this.#confirmValidGeneration('rpgle')) return;
        const dspfName = ibmiName(this.doc.sourceName, 'DSPFILE');
        const programName = this.#requestProgramName('RPGLE', dspfName + 'R');
        if (!programName) return;

        try {
            const previousSource = mergeExisting
                ? await this.#selectSourceFile('.rpgle,.sqlrpgle,.txt')
                : null;
            if (mergeExisting && previousSource == null) {
                this.flash('RPGLE regeneration cancelled.', 'error');
                return;
            }
            const source = generateRpgle(this.doc, {
                programName, dspfName, previousSource,
            });
            await this.host.saveTextFile({
                suggestedName: `${programName}.RPGLE`, text: source,
            });
            this.flash(`${mergeExisting ? 'Regenerated' : 'Generated'} ${programName}.RPGLE.`, 'ok');
        } catch (error) {
            this.#reportFailure('RPGLE', error);
        }
    }

    async #exportCobol (mergeExisting) {
        this.flushSource?.();
        if (!this.#ensureCobolIndara()) return;
        if (!this.#confirmValidGeneration('cobol')) return;
        const dspfName = ibmiName(this.doc.sourceName, 'DSPFILE');
        const programName = this.#requestProgramName('COBOL', dspfName + 'C');
        if (!programName) return;

        try {
            const previousSource = mergeExisting
                ? await this.#selectSourceFile('.cblle,.cobol,.cbl,.txt')
                : null;
            if (mergeExisting && previousSource == null) {
                this.flash('COBOL regeneration cancelled.', 'error');
                return;
            }
            const source = generateCobol(this.doc, {
                programName, dspfName, previousSource,
            });
            await this.host.saveTextFile({
                suggestedName: `${programName}.CBLLE`, text: source,
            });
            this.flash(`${mergeExisting ? 'Regenerated' : 'Generated'} ${programName}.CBLLE.`, 'ok');
        } catch (error) {
            this.#reportFailure('COBOL', error);
        }
    }

    async #exportModelJson () {
        const json = JSON.stringify(this.doc.toJSON(), null, 2);
        this.logger.log(json);
        try {
            await this.navigator.clipboard.writeText(json);
            this.flash('Internal model copied to clipboard.', 'ok');
        } catch {
            this.flash('Internal model dumped to console.', 'ok');
        }
    }

    #ensureCobolIndara () {
        if (usesIndara(this.doc)) return true;
        const add = this.confirm(
            'ILE COBOL needs a stable separate indicator area. ' +
            'Add the file-level INDARA keyword before generating?');
        if (!add) {
            this.flash('COBOL generation cancelled: INDARA is required.', 'error', 4000);
            return false;
        }
        this.doc.records[0].keywords.unshift({
            name: 'INDARA', args: [], indicators: [], scope: 'file',
        });
        this.doc.emit();
        return true;
    }

    #requestProgramName (language, suggestedName) {
        return ibmiName(
            this.prompt(`Program name (max 10 chars, ${language}):`, suggestedName), '');
    }

    async #selectSourceFile (accept) {
        const file = await this.host.openTextFile({ accept });
        return file?.text ?? null;
    }

    #confirmValidGeneration (language) {
        const diagnostics = validateDspf(this.doc, { language });
        const errors = diagnostics.filter(item => item.severity === 'error');
        if (errors.length) {
            const detail = errors.slice(0, 8)
                .map(item => `${item.code}: ${item.message}`).join('\n');
            this.alert(`Code generation stopped: ${errors.length} DSPF error(s).\n\n${detail}`);
            this.flash(`Generation stopped: ${errors.length} DSPF error(s).`, 'error', 5000);
            return false;
        }
        const warnings = diagnostics.filter(item => item.severity === 'warning');
        if (!warnings.length) return true;
        const detail = warnings.slice(0, 8)
            .map(item => `${item.code}: ${item.message}`).join('\n');
        return this.confirm(`Generate with ${warnings.length} warning(s)?\n\n${detail}`);
    }

    #reportFailure (language, error) {
        this.logger.error(`[ironterm] ${language} generation failed:`, error);
        this.flash(`${language} generation failed: ${error.message}`, 'error', 5000);
    }
}
