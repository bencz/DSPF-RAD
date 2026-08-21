// Pure output semantics for legacy DSPF field usage and REFFLD evidence.
// Hidden controls remain traceable but never become editable visible fields.

export function buildFieldOutput (field = {}) {
    const hidden = field.usage === 'H';
    return {
        role: hidden ? 'hidden-control' : 'display-value',
        editable: !hidden && ['I', 'B'].includes(field.usage),
        visible: !hidden,
        status: hidden ? 'converted-with-warning' : 'converted',
    };
}

export function collectReffldEvidence (field = {}, sources = {}) {
    return (field.keywords ?? []).filter(keyword => keyword.name === 'REFFLD').map(keyword => {
        const [referencedField, sourceName] = keyword.args ?? [];
        const target = sourceName && referencedField ? `${sourceName}.${referencedField}` : null;
        const metadata = target ? sources[target] : null;
        return metadata ? {
            sourceIdentity: `dspf:${field.record}:field:${field.name}`,
            target, ...metadata, status: 'converted', reason: null,
        } : {
            sourceIdentity: `dspf:${field.record}:field:${field.name}`,
            target, status: 'manual-review',
            reason: 'PF/DD source metadata is unavailable',
        };
    });
}
