// Read-only DSPF document to Semantic IR conversion boundary.
// The builder creates new data, stable source identities, and diagnostics;
// it never mutates or emits the design document.

import { MODELS } from '../model/constants.js';
import { buildIdentityGraph } from './identityGraph.js';
import { classifyCapabilities } from './capabilities.js';

const SCHEMA_VERSION = '2.1.0';
const CONVERTER_VERSION = 'dspf-rad-semantic-ir-1';
const STATUS = 'converted';

function hashText (text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function sourceIdentity (recordName, kind, name, occurrence) {
    return `dspf:${recordName}:${kind}:${name || 'anonymous'}:occurrence:${occurrence}`;
}

function copyKeywords (keywords = []) {
    return keywords.map(keyword => ({
        ...keyword,
        args: (keyword.args ?? []).slice(),
        indicators: (keyword.indicators ?? []).slice(),
    }));
}

export function resolveDisplayProfile (source) {
    const snapshot = typeof source === 'string' ? { modelKey: source } : source;
    const dspsiz = (snapshot?.records ?? []).flatMap(record => record.keywords ?? [])
        .find(keyword => keyword.name === 'DSPSIZ');
    const args = dspsiz?.args ?? [];
    const rows = Number.parseInt(args[0], 10);
    const cols = Number.parseInt(args[1], 10);
    const keywordKey = `${rows}x${cols}`;
    if (MODELS[keywordKey]) {
        return {
            modelKey: keywordKey,
            rows,
            cols,
            status: 'resolved',
            source: 'DSPSIZ',
        };
    }
    const model = MODELS[snapshot?.modelKey];
    if (model) {
        return {
            modelKey: snapshot.modelKey,
            rows: model.rows,
            cols: model.cols,
            status: 'resolved',
            source: 'document-model',
        };
    }
    return {
        modelKey: 'unknown',
        rows: null,
        cols: null,
        status: 'manual-review',
        source: dspsiz ? 'DSPSIZ' : 'missing',
    };
}

function itemName (item) {
    if (item.kind === 'constant') return item.text || 'constant';
    if (item.kind === 'sysvalue') return item.name || 'system-value';
    return item.name || 'anonymous';
}

export function buildDspfSemanticIR (doc) {
    const snapshot = doc.toJSON();
    const resolvedProfile = resolveDisplayProfile(snapshot);
    const { source: profileSource, ...displayProfile } = resolvedProfile;
    const identityGraph = buildIdentityGraph(snapshot);
    const classified = classifyCapabilities(snapshot, identityGraph.identities);
    const records = [];
    const fields = [];
    const constants = [];
    const systemValues = [];
    const capabilities = [];
    const diagnostics = [];
    let occurrence = 0;

    if (displayProfile.status !== 'resolved') {
        diagnostics.push({
            code: 'UNKNOWN_DISPLAY_PROFILE',
            severity: 'manual-review',
            status: 'manual-review',
            message: `Unsupported display model: ${snapshot.modelKey}`,
            reason: 'The display profile is not known',
            action: 'resolve-display-profile',
            sourceIdentity: null,
            sourceLocation: null,
        });
    }

    for (const record of snapshot.records ?? []) {
        const recordIdentity = sourceIdentity(record.name, 'record', record.name, ++occurrence);
        records.push({
            sourceIdentity: recordIdentity,
            name: record.name,
            type: record.type,
            relations: [],
            keywords: copyKeywords(record.keywords),
        });
        capabilities.push({ sourceIdentity: recordIdentity, status: STATUS });

        for (const [itemIndex, item] of (record.items ?? []).entries()) {
            const name = itemName(item);
            const identity = sourceIdentity(
                record.name,
                item.kind,
                name,
                itemIndex + 1,
            );
            const itemStatus = displayProfile.status === 'resolved'
                ? STATUS
                : 'manual-review';
            capabilities.push({ sourceIdentity: identity, status: itemStatus });

            if (item.kind === 'constant') {
                constants.push({
                    sourceIdentity: identity,
                    record: record.name,
                    text: item.text || '',
                    row: Math.max(1, Number(item.row) || 1),
                    col: Math.max(1, Number(item.col) || 1),
                    length: Math.max(1, String(item.text || '').length),
                    indicators: (item.indicators ?? []).slice(),
                    keywords: copyKeywords(item.keywords),
                    status: itemStatus,
                });
            }
            if (item.kind === 'sysvalue') {
                systemValues.push({
                    sourceIdentity: identity,
                    record: record.name,
                    name: item.name || 'system-value',
                    row: Math.max(1, Number(item.row) || 1),
                    col: Math.max(1, Number(item.col) || 1),
                    length: Math.max(1, Number(item.length) || 1),
                    status: itemStatus,
                });
            }

             if (item.kind !== 'field') continue;
            fields.push({
                sourceIdentity: identity,
                record: record.name,
                name: item.name || '',
                role: item.usage || 'B',
                row: Math.max(1, Number(item.row) || 1),
                col: Math.max(1, Number(item.col) || 1),
                length: Math.max(1, Number(item.length) || 1),
                dataType: item.dataType || 'A',
                decimals: Math.max(0, Number(item.decimals) || 0),
                usage: item.usage || 'B',
                indicators: (item.indicators ?? []).slice(),
                keywords: copyKeywords(item.keywords),
                references: [],
                runtimeCapability: itemStatus,
                status: itemStatus,
            });
        }
    }

    return {
        schemaVersion: SCHEMA_VERSION,
        sourceRevision: {
            sourceHash: hashText(JSON.stringify(snapshot)),
            converterVersion: CONVERTER_VERSION,
        },
        displayProfile,
        displayProfileSource: profileSource,
        recordFormats: records,
        identities: identityGraph.identities,
        constants,
        systemValues,
        fields,
        symbols: [],
        references: identityGraph.references,
        indicators: [],
        aids: [],
        windows: [],
        subfiles: [],
        menus: [],
        messages: [],
        cursor: null,
        capabilities: [...capabilities, ...classified.capabilities],
        diagnostics: [...diagnostics, ...identityGraph.diagnostics, ...classified.diagnostics],
    };
}
