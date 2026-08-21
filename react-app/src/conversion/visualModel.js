// Read-only visual conversion model for the first Modern React slice.
// It maps supported display data into a new object and never mutates DspfDocument.

const COLOR_MAP = {
    BLU: '#0F3460',
    WHT: '#101828',
    GRN: '#16794A',
    RED: '#B42318',
    YLW: '#A15C00',
};

export function buildVisualModel (doc) {
    const cols = doc.cols;
    const rows = doc.rows;
    const records = doc.records.map((record) => ({
        name: record.name,
        type: record.type,
        keywords: record.keywords.map(copyKeyword),
        items: record.items.map((item) => toVisualItem(item, cols)),
    }));

    return {
        modelKey: doc.modelKey,
        rows,
        cols,
        activeRecordIndex: doc.activeRecordIndex,
        records,
        warnings: collectWarnings(doc),
    };
}

function toVisualItem (item, cols) {
    const length = item.kind === 'constant'
        ? Math.max(String(item.text ?? '').length, 1)
        : Math.max(Number(item.length) || 1, 1);
    const targetCol = sourceColumnToGrid(item.col ?? 1, cols);
    const span = Math.min(12 - targetCol + 1, Math.max(1, Math.round(length / cols * 12)));
    const colorName = keywordArg(item, 'COLOR');
    const attrs = keywordArgs(item, 'DSPATR');

    const hidden = item.kind === 'field' && item.usage === 'H';
    return {
        sourceId: item.id,
        kind: item.kind,
        name: item.name ?? '',
        text: item.text ?? '',
        sysName: item.sysName ?? '',
        row: item.row ?? 1,
        col: item.col ?? 1,
        targetCol,
        length,
        span,
        usage: item.usage ?? '',
        hidden,
        editable: !hidden && ['I', 'B'].includes(item.usage),
        dataType: item.dataType ?? '',
        decimals: item.decimals ?? 0,
        sourceIndicators: [...(item.indicators ?? [])],
        color: COLOR_MAP[colorName] ?? null,
        attributes: attrs,
        sourceKeywords: (item.keywords ?? []).map(copyKeyword),
    };
}

function sourceColumnToGrid (sourceCol, sourceCols) {
    const normalized = Math.max(1, Math.min(sourceCols, Number(sourceCol) || 1));
    return Math.max(1, Math.min(12, Math.floor((normalized - 1) / sourceCols * 12) + 1));
}

function collectWarnings (doc) {
    const warnings = [];
    for (const record of doc.records) {
        for (const item of record.items) {
            if (item.refField || item._lengthInferred) {
                warnings.push({
                    sourceId: item.id,
                    severity: 'inferred',
                    confidence: 'low',
                    message: `REFFLD length for ${record.name}.${item.name || item.kind} inferred from DSPF geometry.`,
                });
            }
            if (item.usage === 'P' && item.kind === 'field') {
                warnings.push({
                    sourceId: item.id,
                    severity: 'manual-review',
                    message: `${record.name}.${item.name} uses non-editable usage P.`,
                });
            }
        }
    }
    return warnings;
}

function copyKeyword (keyword) {
    return {
        name: keyword.name,
        args: [...(keyword.args ?? [])],
        indicators: [...(keyword.indicators ?? [])],
    };
}

function keywordArg (item, name) {
    const keyword = (item.keywords ?? []).find((entry) => entry.name === name);
    return keyword?.args?.[0]?.replace(/[()']/g, '').toUpperCase() ?? '';
}

function keywordArgs (item, name) {
    const keyword = (item.keywords ?? []).find((entry) => entry.name === name);
    return keyword?.args ?? [];
}
