import { generateCobol } from '../../codegen/cobol.js';
import { generateRpgle } from '../../codegen/rpgle.js';
import { usesIndara } from '../../codegen/analysis.js';
import { ibmiName } from '../../model/factories.js';
import { validateDspf } from '../../validation/validateDspf.js';

export function bindCodeGenerationActions ({
    doc, host, flash, flushSource, elementById = defaultElementById,
}) {
    elementById('genRpgle')?.addEventListener('click', () => exportRpgle(false));
    elementById('regenRpgle')?.addEventListener('click', () => exportRpgle(true));
    elementById('genCobol')?.addEventListener('click', () => exportCobol(false));
    elementById('regenCobol')?.addEventListener('click', () => exportCobol(true));
    elementById('exportJson')?.addEventListener('click', exportModelJson);

    async function exportRpgle (mergeExisting) {
        flushSource?.();
        if (!confirmValidGeneration(doc, 'rpgle', flash)) return;
        const dspfName = ibmiName(doc.sourceName, 'DSPFILE');
        const programName = requestProgramName('RPGLE', dspfName + 'R');
        if (!programName) return;

        try {
            const previousSource = mergeExisting
                ? await selectSourceFile(host, '.rpgle,.sqlrpgle,.txt')
                : null;
            if (mergeExisting && previousSource == null) {
                flash('RPGLE regeneration cancelled.', 'error');
                return;
            }
            const source = generateRpgle(doc, {
                programName, dspfName, previousSource,
            });
            await host.saveTextFile({
                suggestedName: `${programName}.RPGLE`, text: source,
            });
            flash(`${mergeExisting ? 'Regenerated' : 'Generated'} ${programName}.RPGLE.`, 'ok');
        } catch (error) {
            reportFailure('RPGLE', error, flash);
        }
    }

    async function exportCobol (mergeExisting) {
        flushSource?.();
        if (!ensureCobolIndara(doc, flash)) return;
        if (!confirmValidGeneration(doc, 'cobol', flash)) return;
        const dspfName = ibmiName(doc.sourceName, 'DSPFILE');
        const programName = requestProgramName('COBOL', dspfName + 'C');
        if (!programName) return;

        try {
            const previousSource = mergeExisting
                ? await selectSourceFile(host, '.cblle,.cobol,.cbl,.txt')
                : null;
            if (mergeExisting && previousSource == null) {
                flash('COBOL regeneration cancelled.', 'error');
                return;
            }
            const source = generateCobol(doc, {
                programName, dspfName, previousSource,
            });
            await host.saveTextFile({
                suggestedName: `${programName}.CBLLE`, text: source,
            });
            flash(`${mergeExisting ? 'Regenerated' : 'Generated'} ${programName}.CBLLE.`, 'ok');
        } catch (error) {
            reportFailure('COBOL', error, flash);
        }
    }

    async function exportModelJson () {
        const json = JSON.stringify(doc.toJSON(), null, 2);
        console.log(json);
        try {
            await navigator.clipboard.writeText(json);
            flash('Internal model copied to clipboard.', 'ok');
        } catch {
            flash('Internal model dumped to console.', 'ok');
        }
    }
}

function ensureCobolIndara (doc, flash) {
    if (usesIndara(doc)) return true;
    const add = confirm(
        'ILE COBOL needs a stable separate indicator area. ' +
        'Add the file-level INDARA keyword before generating?');
    if (!add) {
        flash('COBOL generation cancelled: INDARA is required.', 'error', 4000);
        return false;
    }
    doc.records[0].keywords.unshift({
        name: 'INDARA', args: [], indicators: [], scope: 'file',
    });
    doc.emit();
    return true;
}

function requestProgramName (language, suggestedName) {
    return ibmiName(
        prompt(`Program name (max 10 chars, ${language}):`, suggestedName), '');
}

async function selectSourceFile (host, accept) {
    const file = await host.openTextFile({ accept });
    return file?.text ?? null;
}

function confirmValidGeneration (doc, language, flash) {
    const diagnostics = validateDspf(doc, { language });
    const errors = diagnostics.filter(item => item.severity === 'error');
    if (errors.length) {
        const detail = errors.slice(0, 8)
            .map(item => `${item.code}: ${item.message}`).join('\n');
        alert(`Code generation stopped: ${errors.length} DSPF error(s).\n\n${detail}`);
        flash(`Generation stopped: ${errors.length} DSPF error(s).`, 'error', 5000);
        return false;
    }
    const warnings = diagnostics.filter(item => item.severity === 'warning');
    if (!warnings.length) return true;
    const detail = warnings.slice(0, 8)
        .map(item => `${item.code}: ${item.message}`).join('\n');
    return confirm(`Generate with ${warnings.length} warning(s)?\n\n${detail}`);
}

function reportFailure (language, error, flash) {
    console.error(`[ironterm] ${language} generation failed:`, error);
    flash(`${language} generation failed: ${error.message}`, 'error', 5000);
}

function defaultElementById (id) {
    return document.getElementById(id);
}
