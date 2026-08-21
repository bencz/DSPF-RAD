// Revision-scoped conversion receipts and in-memory store.
// Receipts record evidence; they do not become business transaction state.

import { createHash } from 'node:crypto';

function hash (value) {
    return createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

export function makeConversionReceipt (input = {}) {
    return {
        revision: input.revision || 'unversioned',
        sourceHash: hash(input.source),
        mappingHash: hash(input.mapping),
        outputHash: hash(input.output),
        command: input.command || null,
        result: input.result || 'unknown',
        exitCode: input.exitCode ?? null,
        tests: [...(input.tests ?? [])],
        timestamp: input.timestamp || new Date().toISOString(),
        artifacts: [...(input.artifacts ?? [])],
    };
}

export function createReceiptStore () {
    const records = new Map();
    return {
        put (receipt) { records.set(receipt.revision, structuredClone(receipt)); },
        get (revision) { const receipt = records.get(revision); return receipt ? structuredClone(receipt) : null; },
    };
}
