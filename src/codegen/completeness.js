// Source-object completeness gate for conversion artifacts.
// Every source identity must be mapped or explicitly diagnosed.

export function assessObjectCompleteness (inventory = {}, contract = {}) {
    const covered = new Set([
        ...(contract.mappings ?? []).map(item => item.sourceIdentity),
        ...(contract.diagnostics ?? []).filter(item => item.status).map(item => item.sourceIdentity),
    ]);
    const dropped = (inventory.objects ?? []).map(item => item.sourceIdentity)
        .filter(identity => !covered.has(identity));
    return { valid: dropped.length === 0, droppedObjectCount: dropped.length, dropped };
}
