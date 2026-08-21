// Pure source-grid to target-grid mapping for Semantic IR.
// Source geometry is preserved; every lossy mapping receives a review entry.

const TARGET_COLUMNS = 12;

function clamp (value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function lengthOf (item) {
    if (item.kind === 'constant') return Math.max(1, String(item.text || '').length);
    return Math.max(1, Number(item.length) || 1);
}

export function mapSemanticLayout (source, displayProfile) {
    const layouts = [];
    const diagnostics = [];
    const sourceCols = displayProfile.cols;
    if (!sourceCols) {
        return { targetColumns: TARGET_COLUMNS, items: [], diagnostics: [{
            code: 'LAYOUT_UNKNOWN_PROFILE', severity: 'manual-review', status: 'manual-review',
            message: 'Cannot map layout without source columns', reason: 'Display profile is unresolved',
            action: 'resolve-display-profile', sourceIdentity: null, sourceLocation: null,
        }] };
    }
    for (const record of source.records ?? []) {
        const occupied = new Map();
        for (const [index, item] of (record.items ?? []).entries()) {
            const sourceRow = Math.max(1, Number(item.row) || 1);
            const rawCol = Number(item.col) || 1;
            const sourceCol = clamp(rawCol, 1, sourceCols);
            const sourceLength = lengthOf(item);
            const targetCol = Math.floor((sourceCol - 1) / sourceCols * TARGET_COLUMNS) + 1;
            const plannedSpan = clamp(Math.round(sourceLength / sourceCols * TARGET_COLUMNS), 1, TARGET_COLUMNS);
            const actualSpan = clamp(plannedSpan, 1, TARGET_COLUMNS - targetCol + 1);
            const windowOffset = item.windowOffset ?? { row: 0, col: 0 };
            const lossiness = [];
            if (rawCol !== sourceCol) lossiness.push('crop');
            if (actualSpan !== plannedSpan) lossiness.push('crop');
            const key = `${sourceRow}:${targetCol}`;
            if (occupied.has(key)) lossiness.push('overlap');
            occupied.set(key, true);
            if (sourceRow > displayProfile.rows) lossiness.push('row-overflow');
            if (windowOffset.row || windowOffset.col) lossiness.push('window-offset');
            const sourceIdentity = `dspf:${record.name}:${item.kind}:${item.name || item.text || item.kind}:occurrence:${index + 1}`;
            const status = lossiness.some(value => value !== 'window-offset') ? 'manual-review' : 'converted';
            layouts.push({
                sourceIdentity,
                sourceRecord: record.name,
                sourceRow,
                sourceCol,
                sourceLength,
                windowOffset: { ...windowOffset },
                targetRow: sourceRow,
                targetCol,
                plannedSpan,
                actualSpan,
                lossiness,
                status,
            });
            for (const loss of lossiness) {
                if (loss === 'window-offset') continue;
                diagnostics.push({
                    code: `LAYOUT_${loss.replace('-', '_').toUpperCase()}`,
                    severity: 'manual-review', status: 'manual-review',
                    message: `Semantic layout requires ${loss} review`, reason: loss,
                    action: 'review-layout', sourceIdentity, sourceLocation: null,
                });
            }
        }
    }
    return { targetColumns: TARGET_COLUMNS, items: layouts, diagnostics };
}
