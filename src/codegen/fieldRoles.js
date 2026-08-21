// Pure DSPF field usage and indicator normalization.
// Role, visibility, editability, and indicator meaning remain separate.

const ROLES = {
    H: ['hidden-control', false, false],
    P: ['protected', false, true],
    I: ['input', true, true],
    O: ['output', false, true],
    B: ['input-output', true, true],
};

function indicator (value) {
    const text = String(value ?? '').toUpperCase();
    const negative = text.startsWith('N');
    const number = Number.parseInt(negative ? text.slice(1) : text, 10);
    return {
        value: text,
        number: Number.isInteger(number) ? number : null,
        polarity: Number.isInteger(number) ? (negative ? 'negative' : 'positive') : 'unknown',
        scope: 'item',
        status: Number.isInteger(number) && number >= 1 && number <= 99 ? 'converted' : 'manual-review',
    };
}

export function normalizeFieldSemantics (field = {}) {
    const usage = String(field.usage || '').toUpperCase();
    const [role, editable, visible] = ROLES[usage] ?? ['unknown', false, true];
    return { ...field, usage, role, editable, visible, indicators: (field.indicators ?? []).map(indicator) };
}
