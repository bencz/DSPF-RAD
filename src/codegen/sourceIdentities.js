// Shared item-naming and source-identity rules.
// Single implementation so semantic IR, layout mapping, and the design
// overlay can never drift apart (the sysvalue identity drift caught by the
// C5 sweep is exactly what this module prevents).

export function itemNameOf (item) {
    if (item.kind === 'constant') return item.text || 'constant';
    if (item.kind === 'sysvalue') return item.name || 'system-value';
    return item.name || 'anonymous';
}

export function itemSourceIdentity (recordName, kind, name, occurrence) {
    return `dspf:${recordName}:${kind}:${name || 'anonymous'}:occurrence:${occurrence}`;
}

export function identityForItem (recordName, item, occurrence) {
    return itemSourceIdentity(recordName, item.kind, itemNameOf(item), occurrence);
}
