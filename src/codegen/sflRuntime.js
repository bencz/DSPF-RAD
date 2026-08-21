// Pure first-release SFL runtime contract extraction.
// It describes display state without executing IBM i runtime behavior.

function keyword (record, name) {
    return (record?.keywords ?? []).find(item => item.name === name);
}

function numberArg (record, name) {
    const value = keyword(record, name)?.args?.[0];
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? number : null;
}

export function buildSflRuntime ({ controlRecord, templateRecord, messageRecord = null } = {}) {
    const controlName = controlRecord?.name || '';
    const templateName = templateRecord?.name || '';
    const valid = controlRecord?.type === 'SFLCTL' && templateRecord?.type === 'SFL';
    const result = {
        controlRecord: controlName,
        templateRecord: templateName,
        messageRecord: messageRecord?.name ?? null,
        pageSize: numberArg(controlRecord, 'SFLPAG'),
        totalSize: numberArg(controlRecord, 'SFLSIZ'),
        relativeRow: null,
        currentRrn: null,
        displayIndicator: keyword(controlRecord, 'SFLDSP')?.indicators?.[0] ?? null,
        displayControlIndicator: keyword(controlRecord, 'SFLDSPCTL')?.indicators?.[0] ?? null,
        clearIndicator: keyword(controlRecord, 'SFLCLR')?.indicators?.[0] ?? null,
        endMode: keyword(controlRecord, 'SFLEND')?.args?.[0] ?? null,
        scrollState: null,
        rows: [],
        status: valid ? 'contract-only' : 'manual-review',
        reason: valid ? 'Runtime rows and scroll state are supplied by the external runtime' : 'Invalid SFL/SFLCTL relation',
    };
    return result;
}
