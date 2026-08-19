# TanStack DB Core Concepts

## Collections
Collections are typed sets of objects populated via TanStack Query (`queryCollectionOptions`), sync engines (Electric, TrailBase, RxDB, PowerSync), or local storage.

### Sync Modes
Collections support three synchronization modes:
- **eager (default)**: Best for `<10k` rows. Loads all data into memory at once.
- **on-demand**: Best for `>50k` rows. Query-driven loading. Predicate push-down is applied (`parseLoadSubsetOptions`, `parseWhereExpression`, `parseOrderByExpression`, `extractSimpleComparisons`).
- **progressive**: Loads a subset first, then the full dataset in the background.

## Schemas
Schemas are StandardSchema-compatible (Zod, Valibot, ArkType, Effect) and validate client mutations only, not server data.

**Critical Constraint:** `TInput` must be a superset of `TOutput` for updates to work. Use union types for transformations.
```typescript
import { z } from 'zod';
// If your date comes in as a string from JSON but is stored as a Date object:
const dateSchema = z.union([z.string(), z.date()]);
```

## React Router Pattern
The optimal pattern for loading data with TanStack DB and React Router:
1. Preload data in the route loader (`await collection.preload()`)
2. Consume via `useLiveQuery` in the component

```typescript
// loader
export const loader = async () => {
  await myCollection.preload();
  return null;
};

// component
export const Component = () => {
  const { data } = useLiveQuery((db) => db.from(myCollection).select());
  return <div>{data?.map(item => <div key={item.id}>{item.name}</div>)}</div>;
};
```

## Collection Options Creator Pattern
Custom integrations use the collection options creator pattern:
- **Pattern A**: User-provided handlers
- **Pattern B**: Built-in handlers