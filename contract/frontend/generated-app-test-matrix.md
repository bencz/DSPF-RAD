# Generated App Test Matrix

## 1. Unit tests



| Area | Required proof |
|---|---|
| field binding | Source identity, runtime key, DOM id, type, usage |
| layout | Source row/col to target row/col/span |
| diagnostics | Status, reason, source identity, action |
| route manifest | Path, permission, loader, error, not-found |
| query keys | Stable serializable key shape |

## 2. Component tests



Test:

```text
ConvertedField states
ConvertedStatus states
OptionLegend mapping
FunctionAction permission/destructive state
Sidebar active route
StatusRegion announcements
```

## 3. Contract tests



Test the generated API client against `contract/openapi.yaml`.

Test these response groups:

```text
200 success
400 invalid request
401 unauthenticated
403 unauthorized
404 not found
409 revision conflict
422 field validation
429 rate limit
440 session expiry
500 server error
```

## 4. Integration tests



Test:

```text
generated React app without the designer source
HTTP client against a contract server
local client against fixture data
route loader with Query cache
transaction mutation with idempotency key
server error mapped to field and page state
```

## 5. Playwright tests



Test the generated app in a real browser:

```text
load the first route
show the screen
show fields and labels
show manual-review and unsupported states
navigate through the Sidebar
reload a deep link
submit a valid transaction
submit an invalid transaction
show a 403 state
show a 409 revision conflict
show session expiry
check keyboard focus
check 200% zoom
```

## 6. Regression tests



Run the existing designer checks after generated app work:

```text
npx vitest run --pool=threads --maxWorkers=1
npx playwright test --workers=1
npm run build
DSPF round-trip checks
Canvas/React faithful parity checks
DspfDocument immutability checks
```

## 7. Pass condition



The generated app passes unit, contract, integration, and browser tests. The existing designer regression suite remains green.
