# Error Handling

## Transaction States

Transactions in TanStack DB follow a specific lifecycle:
1. `pending`: The mutation is applied locally.
2. `persisting`: The mutation is being sent to the backend.
3. `completed` / `failed`: The mutation has finished.

**Note:** There is no automatic retry mechanism for failed mutations.

## Error Types

TanStack DB exposes a variety of built-in errors for precise handling:

- `SchemaValidationError`: The schema failed validation. Client mutations only, not server data.
- `DuplicateKeyError`: An item with the same primary key already exists.
- `UndefinedKeyError`: The primary key was undefined.
- `UpdateKeyNotFoundError`: Attempting to update a non-existent item.
- `DeleteKeyNotFoundError`: Attempting to delete a non-existent item.
- `KeyUpdateNotAllowedError`: Attempting to change the primary key of an existing item.
- `CollectionInErrorStateError`: The collection has encountered a fatal error.
- `MissingHandlerError`: A required handler was not provided in the collection options creator pattern.
- Transaction Errors: Various errors related to transactions failing or rolling back.
