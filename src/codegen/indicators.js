// Pure DSPF indicator normalization.
// Positive and negative indicators retain polarity and their owning scope.

function parseIndicator (value, scope) {
    const text = String(value ?? '').trim().toUpperCase();
    const negative = text.startsWith('N');
    const number = Number.parseInt(negative ? text.slice(1) : text, 10);
    if (!Number.isInteger(number) || number < 1 || number > 99) return {
        value: text, number: null, polarity: 'unknown', scope, status: 'manual-review',
    };
    return { value: text, number, polarity: negative ? 'negative' : 'positive', scope, status: 'converted' };
}

export function normalizeIndicators (input = {}) {
    const normalize = (values, scope) => (values ?? []).map(value => parseIndicator(value, scope));
    const result = {
        record: normalize(input.recordIndicators, 'record'),
        keyword: normalize(input.keywordIndicators, 'keyword'),
        item: normalize(input.itemIndicators, 'item'),
        indara: Boolean(input.indara),
    };
    result.diagnostics = [...result.record, ...result.keyword, ...result.item]
        .filter(indicator => indicator.status !== 'converted')
        .map(indicator => ({
            code: 'UNKNOWN_INDICATOR', severity: 'manual-review', status: 'manual-review',
            message: `Unknown indicator: ${indicator.value}`, reason: 'Indicator must be reviewed',
            action: 'review-indicator', sourceIdentity: null, sourceLocation: null,
        }));
    return result;
}
