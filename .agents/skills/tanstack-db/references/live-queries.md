# Live Queries

Live queries in TanStack DB use a SQL-like fluent API powered by differential dataflow (`d2ts`), providing sub-millisecond incremental updates (~0.7ms for 100k items).

## Query API Features

- **Operators**: `from`, `where`, `select`, `join` (left/right/inner/full), `groupBy`, `having`, `orderBy`, `limit`, `offset`, `findOne`, `distinct`, `subqueries`.
- **Functional Variants**: `fn.where`, `fn.select`, `fn.having`.

### Expression Functions

- **Comparison**: `eq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `inArray`, `isNull`, `isUndefined`
- **Logical**: `and`, `or`, `not`
- **String**: `upper`, `lower`, `length`, `concat`
- **Math**: `add`, `coalesce`
- **Aggregate**: `count`, `sum`, `avg`, `min`, `max`

## React Hooks

- `useLiveQuery`: Base hook. Supports conditional queries via returning undefined. Provides `isLoading`, `status`, and `isEnabled`.
- `useLiveSuspenseQuery`: Suspense-ready query hook. Data is always defined. Automatically re-suspends when dependencies change.
- `useLiveInfiniteQuery`: For pagination with `pageSize` and `getNextPageParam`.

### Dependency Arrays

The last parameter on all query hooks is the dependency array. It behaves identically to `useEffect` dependencies.
- **Required**: Include all external values used inside the query function.
- **Empty Array (`[]`)**: Denotes a static query that never changes structure.
- **Omitted**: Interpreted as no dependencies, re-creating the query object on every render.

### Conditional Queries

Return `undefined` or `null` from the callback to disable the query.
```typescript
const { data, status, isEnabled } = useLiveQuery(
  (db) => userId ? db.from(users).where('id', 'eq', userId) : undefined,
  [userId]
);
// When userId is undefined: status is 'disabled', isEnabled is false
```

### Alternative Returns

Query callbacks can return:
- Query builder (standard pattern)
- Pre-created collection
- `LiveQueryCollectionConfig` object with custom `id` / `gcTime`

## Key Patterns

### $selected Namespace
Use `$selected` for ordering or filtering by `SELECT` fields.
```typescript
db.from(users)
  .select((u) => ({
    fullName: fn.concat(u.firstName, ' ', u.lastName),
  }))
  .orderBy('$selected.fullName', 'asc');
```

### Reusable Query Callbacks
Type reusable queries with `Ref<T>`.

### Composable Queries
Live query results are collections, which can be the source for another query.

### Subquery Deduplication
The same subquery used multiple times in a single query is executed only once.
