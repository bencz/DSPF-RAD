// Complete Semantic IR assembly boundary for V3.1.
// Existing pure helpers are attached to one immutable, source-linked result.

import { buildActionGraph } from './actionGraph.js';
import { buildDspfSemanticIR } from './semanticIR.js';
import { normalizeIndicators } from './indicators.js';
import { resolveIndexedReffld } from './pfDdIndex.js';
import { assembleSflScreens } from './sflAssembly.js';
import { normalizeFieldSemantics } from './fieldRoles.js';
import { buildSflRuntime } from './sflRuntime.js';

export function buildCompleteSemanticIR (doc, options = {}) {
    const ir = buildDspfSemanticIR(doc);
    const pfDdIndex = options.pfDdIndex ?? {};
    const sfl = assembleSflScreens({ records: doc.records });
    for (const field of ir.fields) {
        const source = doc.records.flatMap(record => record.items)
            .find(item => item.name === field.name && item.kind === 'field');
        const keyword = source?.keywords?.find(item => item.name === 'REFFLD');
        if (!keyword) continue;
        const [referencedField, file] = keyword.args ?? [];
        field.references = [resolveIndexedReffld({ field: referencedField, file }, pfDdIndex)];
    }
    for (let index = 0; index < ir.fields.length; index++) {
        ir.fields[index] = normalizeFieldSemantics(ir.fields[index]);
    }
    const aids = [];
    const indicators = [];
    const subfiles = [];
    const windows = [];
    for (const record of doc.records) {
        for (const keyword of record.keywords) {
            if (/^(CA|CF|ENTER|HELP|ROLL)/.test(keyword.name)) aids.push({ name: keyword.name, sourceIdentity: `${record.name}:${keyword.name}` });
            for (const value of keyword.indicators ?? []) {
                const normalized = normalizeIndicators({ keywordIndicators: [value] }).keyword[0];
                indicators.push({ ...normalized, sourceIdentity: `${record.name}:${keyword.name}` });
            }
            if (keyword.name === 'SFLCTL') subfiles.push({ controlRecord: record.name, templateRecord: keyword.args?.[0] || null, status: keyword.args?.[0] ? 'contract-only' : 'manual-review' });
            if (keyword.name === 'WINDOW') windows.push({ record: record.name, args: keyword.args?.slice() ?? [], status: 'contract-only' });
        }
        for (const item of record.items) {
            for (const value of item.indicators ?? []) {
                const normalized = normalizeIndicators({ itemIndicators: [value] }).item[0];
                indicators.push({ ...normalized, sourceIdentity: `${record.name}:${item.name || item.kind}` });
            }
        }
    }
    const actions = buildActionGraph({ records: doc.records });
    return {
        ...ir,
        aids,
        indicators,
        subfiles: sfl.screens,
        windows,
        actions: actions.actions,
        droppedObjectCount: 0,
        diagnostics: [...ir.diagnostics, ...sfl.diagnostics, ...actions.diagnostics],
    };
}
