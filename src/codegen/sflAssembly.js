// Pure SFL/SFLCTL record assembly for Semantic IR.
// The result preserves source records and describes runtime state without executing it.

function keyword (record, name) {
    return record?.keywords?.find(item => item.name === name);
}

function numberArg (record, name) {
    const value = Number.parseInt(keyword(record, name)?.args?.[0], 10);
    return Number.isFinite(value) ? value : null;
}

export function assembleSflScreens (source = {}) {
    const records = source.records ?? [];
    const byName = new Map(records.map(record => [record.name, record]));
    const screens = [];
    const diagnostics = [];
    for (const control of records.filter(record => record.type === 'SFLCTL')) {
        const targetName = keyword(control, 'SFLCTL')?.args?.[0] || null;
        const template = byName.get(targetName);
        const status = template ? 'contract-only' : 'manual-review';
        screens.push({
            controlRecord: control.name,
            templateRecord: targetName,
            messageRecord: null,
            pageSize: numberArg(control, 'SFLPAG'),
            totalSize: numberArg(control, 'SFLSIZ'),
            currentRrn: null,
            scrollState: null,
            displayIndicator: keyword(control, 'SFLDSP')?.indicators?.[0] ?? null,
            displayControlIndicator: keyword(control, 'SFLDSPCTL')?.indicators?.[0] ?? null,
            clearIndicator: keyword(control, 'SFLCLR')?.indicators?.[0] ?? null,
            endMode: keyword(control, 'SFLEND')?.args?.[0] ?? null,
            controlItems: (control.items ?? []).map(item => ({ ...item })),
            templateItems: (template?.items ?? []).map(item => ({ ...item })),
            status,
            reason: template ? 'SFL runtime rows are supplied by the external runtime' : 'SFL template is missing',
        });
        if (!template) diagnostics.push({
            code: 'SFL_TEMPLATE_MISSING', severity: 'manual-review', status,
            message: `SFL template ${targetName || 'missing'} is unavailable`,
            reason: 'SFLCTL relation cannot be completed', action: 'provide-sfl-template',
            sourceIdentity: control.name, sourceLocation: null,
        });
    }
    return { screens, diagnostics };
}
