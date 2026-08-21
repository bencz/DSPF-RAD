# Query and Error UI Policy

## 1. TanStack Query ownership



Use TanStack Query for server state only.

Do not place `DspfDocument`, selection, Inspector draft, or local conversion state in the Query cache.

## 2. Query key policy



Use array keys with stable, serializable values:

```text
['screen', screenName, revision]
['conversion', conversionId]
['conversion-report', conversionId, revision]
```

Keep query keys beside the feature that consumes them. Use the same key factory in prefetch and component queries.

## 3. Cache policy



| Query | staleTime | Invalidation |
|---|---:|---|
| screen definition | 5 minutes | source revision change |
| conversion status | 0 | job update or manual refresh |
| conversion report | 1 minute | report revision change |
| runtime screen state | 0 | every transaction response |

Do not retry authentication, authorization, validation, or revision errors. Retry transient network and server errors with a bounded policy.

## 4. Mutation policy



Before a transaction mutation:

```text
cancel the matching screen query
read the current screen revision
send the idempotency key
send the correlation id
```

After the mutation:

```text
replace the screen state with the server response
invalidate the previous screen query
show messages and field errors
restore focus from the response cursor
```

Do not use optimistic updates for banking transaction authority. The server response is authoritative.

## 5. Error UI policy



| HTTP status | UI behavior |
|---|---|
| 400 | Show request error near the affected operation |
| 401 | Show sign-in/session state |
| 403 | Show forbidden state and keep the route context |
| 404 | Show not-found state |
| 409 | Show revision conflict and require reload or merge |
| 422 | Map field errors to fields and show a summary |
| 429 | Show retry state and bounded delay |
| 440 | Show session-expired state and return to sign-in |
| 500 | Show service error and correlation id |

Do not convert a 403 into a 404. Do not switch to local mode after a production authentication or authorization error.

## 6. Boundary components



Wrap each route data boundary with:

```text
ErrorBoundary
  └── Suspense
        └── route content
```

Show a stable loading state. Show a clear error state. Show a retry action only when retry can help.

---
