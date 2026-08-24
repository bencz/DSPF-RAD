import { generateCobol } from '../../codegen/cobol.js';
import { generateRpgle } from '../../codegen/rpgle.js';
import { usesIndara } from '../../codegen/analysis.js';
import { ibmiName } from '../../model/factories.js';
import { HostCapability } from '../../platform/host/capabilities.js';
import { validateDspf } from '../../validation/validateDspf.js';
import { WorkbenchCommand } from '../../workbench/commands/commandIds.js';

export class CodeGenerationController {
    #unregister = [];

    constructor ({
        doc,
        host,
        commands,
        coordinator,
        flash,
        flushSource,
        navigatorRef = globalThis.navigator,
        dialogs,
        logger = globalThis.console,
    }) {
        if (!doc) throw new TypeError('CodeGenerationController requires a document.');
        if (!host) throw new TypeError('CodeGenerationController requires a host bridge.');
        if (!commands) throw new TypeError('CodeGenerationController requires commands.');
        if (!coordinator) throw new TypeError('CodeGenerationController requires a coordinator.');
        if (!dialogs) throw new TypeError('CodeGenerationController requires dialogs.');
        this.doc = doc;
        this.host = host;
        this.commands = commands;
        this.coordinator = coordinator;
        this.flash = flash;
        this.flushSource = flushSource;
        this.navigator = navigatorRef;
        this.dialogs = dialogs;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#unregister.push(
            this.#registerGeneration(
                WorkbenchCommand.GENERATE_RPGLE,
                'Generate RPGLE',
                () => this.#exportRpgle(false)),
            this.#registerGeneration(
                WorkbenchCommand.GENERATE_COBOL,
                'Generate COBOL',
                () => this.#exportCobol(false)),
            this.#registerGeneration(
                WorkbenchCommand.REGENERATE_RPGLE,
                'Regenerate RPGLE',
                () => this.#exportRpgle(true),
                { requiresOpen: true }),
            this.#registerGeneration(
                WorkbenchCommand.REGENERATE_COBOL,
                'Regenerate COBOL',
                () => this.#exportCobol(true),
                { requiresOpen: true }),
            this.commands.register({
                id: WorkbenchCommand.DEBUG_COPY_MODEL,
                title: 'Copy model as JSON',
                category: 'Debug',
                execute: () => this.#exportModelJson(),
                isEnabled: () => this.coordinator.isActive,
            }),
        );
    }

    stop () {
        for (const unregister of this.#unregister.splice(0)) unregister();
    }

    #registerGeneration (id, title, execute, { requiresOpen = false } = {}) {
        return this.commands.register({
            id,
            title,
            category: 'Generate',
            execute,
            isEnabled: () => this.coordinator.isActive &&
                this.host.supports(HostCapability.SAVE_LOCAL_TEXT) &&
                (!requiresOpen || this.host.supports(HostCapability.OPEN_LOCAL_TEXT)),
        });
    }

    async #exportRpgle (mergeExisting) {
        this.flushSource?.();
        if (!await this.#confirmValidGeneration('rpgle')) return;
        const dspfName = ibmiName(this.doc.sourceName, 'DSPFILE');
        const programName = await this.#requestProgramName('RPGLE', dspfName + 'R');
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
        if (!await this.#ensureCobolIndara()) return;
        if (!await this.#confirmValidGeneration('cobol')) return;
        const dspfName = ibmiName(this.doc.sourceName, 'DSPFILE');
        const programName = await this.#requestProgramName('COBOL', dspfName + 'C');
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

    async #ensureCobolIndara () {
        if (usesIndara(this.doc)) return true;
        const add = await this.dialogs.confirm({
            title: 'COBOL indicator area',
            message: 'ILE COBOL needs a stable separate indicator area.',
            detail: 'Add the file-level INDARA keyword before generating?',
            acceptLabel: 'Add INDARA',
        });
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

    async #requestProgramName (language, suggestedName) {
        const value = await this.dialogs.prompt({
            title: `Generate ${language}`,
            message: 'Choose the IBM i program name for the generated source.',
            label: 'Program name',
            value: suggestedName,
            maxLength: 10,
            acceptLabel: 'Generate',
        });
        return ibmiName(value, '');
    }

    async #selectSourceFile (accept) {
        const file = await this.host.openTextFile({ accept });
        return file?.text ?? null;
    }

    async #confirmValidGeneration (language) {
        const diagnostics = validateDspf(this.doc, { language });
        const errors = diagnostics.filter(item => item.severity === 'error');
        if (errors.length) {
            const detail = errors.slice(0, 8)
                .map(item => `${item.code}: ${item.message}`).join('\n');
            await this.dialogs.alert({
                title: 'Code generation stopped',
                message: `${errors.length} DSPF error(s) must be fixed before generation.`,
                detail,
            });
            this.flash(`Generation stopped: ${errors.length} DSPF error(s).`, 'error', 5000);
            return false;
        }
        const warnings = diagnostics.filter(item => item.severity === 'warning');
        if (!warnings.length) return true;
        const detail = warnings.slice(0, 8)
            .map(item => `${item.code}: ${item.message}`).join('\n');
        return this.dialogs.confirm({
            title: 'Generation warnings',
            message: `Generate with ${warnings.length} warning(s)?`,
            detail,
            acceptLabel: 'Generate anyway',
        });
    }

    #reportFailure (language, error) {
        this.logger.error(`[ironterm] ${language} generation failed:`, error);
        this.flash(`${language} generation failed: ${error.message}`, 'error', 5000);
    }
}
