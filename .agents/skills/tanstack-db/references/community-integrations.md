# Community Integrations

## Dexie.js (`tanstack-dexie-db-collection`)

IndexedDB persistence via Dexie.js — offline-first local storage.

### Installation
```bash
npm install tanstack-dexie-db-collection @tanstack/react-db
```

### Repo
[https://github.com/HimanshuKumarDutt094/tanstack-dexie-db-collection](https://github.com/HimanshuKumarDutt094/tanstack-dexie-db-collection)

### API
```typescript
import { dexieCollectionOptions } from 'tanstack-dexie-db-collection';

const options = dexieCollectionOptions({
  id: 'my-collection',
  schema: mySchema,
  getKey: (row) => row.id,
  dbName: 'my-database', // Optional
  tableName: 'my-table', // Optional
  syncBatchSize: 100, // Optional
  rowUpdateMode: 'partial', // Optional (default uses table.update) or 'full' (uses table.put)
  ackTimeoutMs: 5000, // Optional
  awaitTimeoutMs: 1000, // Optional
  codec: { parse, serialize }, // Optional data transformation
});
```

### Features
- Auto-sync between in-memory collection and IndexedDB.
- `liveQuery` reactivity.
- Optimistic mutations with acknowledgement tracking.
- Batch sync.
- Sequential ID generation (`getNextId()`).
- Persistence handlers for backend sync.

### Utilities
- `getTable()`: Direct Dexie table access.
- `refresh()`, `refetch()`.
- `bulkInsertLocally()`.

---

## PGLite (`tanstack-db-pglite`)

PostgreSQL in the browser via WebAssembly + Drizzle ORM.

### Installation
```bash
npm install tanstack-db-pglite @tanstack/db drizzle-orm @electric-sql/pglite
```

### Repo
[https://github.com/letstri/tanstack-db-pglite](https://github.com/letstri/tanstack-db-pglite)

### API
```typescript
import { drizzleCollectionOptions } from 'tanstack-db-pglite';

const options = drizzleCollectionOptions({
  db: myDrizzleDb,
  table: myDrizzleTable,
  primaryColumn: myDrizzleTable.id,
  prepare: (db) => db.run('...'), // Optional migrations
  sync: async (collection) => { /* ... */ }, // Optional custom sync functions
  onInsert: async (row) => { /* ... */ }, // Optional cloud sync hook
  onUpdate: async (row) => { /* ... */ }, // Optional cloud sync hook
  onDelete: async (row) => { /* ... */ }, // Optional cloud sync hook
  startSync: true, // Optional
});
```

### Features
- Uses `drizzle-zod` for auto schema generation from Drizzle tables.
- Transaction support via `config.db.transaction()`.
- *Implementation detail:* Works around Drizzle ORM transaction commit issue (#1723) by selecting after mutation to force commit.

### Utilities
- `runSync()`: Manual sync triggers.