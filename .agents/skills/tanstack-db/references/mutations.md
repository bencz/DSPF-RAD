# Mutations

## Optimistic Mutations

TanStack DB's optimistic mutations automatically update the local cache and revert changes if the backend request fails.

### Available Methods

- `insert`
- `update`
- `delete`

### Mutation Merging Truth Table

Mutations made to the same row are merged sequentially:
- `insert` + `update` = `insert` (with updated values)
- `insert` + `delete` = `removed` (never hits backend)
- `update` + `delete` = `delete`
- `update` + `update` = `update` (with merged values)

## Advanced Mutations

### Paced Mutations

TanStack Pacer powers `usePacedMutations` and `createPacedMutations`, allowing debouncing, throttling, or queuing strategies.

### Transactions

- `createTransaction`: Manual transaction control for atomic updates across collections.
- `createOptimisticAction`: Intent-based multi-collection mutations.

## Temporary ID Handling

When generating objects locally before backend synchronization, you must handle temporary IDs.

**Best Practices:**
1. Prefer UUIDs (`crypto.randomUUID()`) to avoid ID collisions.
2. Wait for backend persistence.
3. Maintain a view key mapping between temporary and canonical IDs.

## Direct Writes

`QueryCollection` bypasses the optimistic system when you execute direct writes:
- `writeInsert`
- `writeUpdate`
- `writeDelete`
- `writeUpsert`
- `writeBatch`

**Important Note:** `QueryCollection` treats the `queryFn` result as the complete state. Returning an empty array is equivalent to deleting all rows.
