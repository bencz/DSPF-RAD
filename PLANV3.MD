# DSPF·RAD V3 Execution Plan

## 1. Goal

Deliver a source-complete DSPF conversion pipeline that can produce:

```text
Semantic IR
Mapping Contract
Modern React/Vite application
Spring Boot runtime contract
conversion report
traceability evidence
```

V3 does not replace the existing DSPF editor until the new pipeline passes all gates.

## 2. Non-negotiable boundaries

```text
DspfDocument remains the single legacy design document.
Conversion reads the document and does not mutate it.
Spring Boot owns session, authorization, transactions, idempotency, and audit.
Generated React does not import mutable designer code.
Unknown semantics never become executable behavior.
Production HTTP failure never silently falls back to local mode.
```

## 3. Phase 0 — Source set and inventory

### V3-0A Define conversion project source set

Input types:

```text
DSPF
PF
LF
RPGLE / SQLRPGLE
CL
external source references
```

Acceptance:

```text
Every input has path, type, encoding, revision, and source hash.
Missing referenced files are listed before conversion.
```

### V3-0B Build dependency closure

Resolve:

```text
REFFLD
SFLCTL → SFL
WINDOW ownership
MNUBAR → PULLDOWN
CHCCTL
runtime display bindings
```

Acceptance:

```text
resolved
missing
ambiguous
unsupported
```

Every dependency has one explicit state.

## 4. Phase 1 — Semantic conversion

### V3-1A Build qualified identity graph

Keep separate:

```text
sourceIdentity
runtimeBindingKey
domId
businessName
```

### V3-1B Resolve PF/LF metadata

Preserve:

```text
dataType
length
decimals
usage
validation
sourceLocation
```

### V3-1C Assemble complete record graph

Support:

```text
RECORD
SFL
SFLCTL
WINDOW
MNUBAR
PULLDOWN
message records
```

### V3-1D Normalize controls and indicators

Support:

```text
H hidden-control
P protected
I input
O output
B both
Nxx negative indicator
INDARA
AID
RRN
RTNCSRLOC
```

### V3-1E Emit semantic diagnostics

Every diagnostic contains:

```text
code
severity
status
sourceIdentity
sourcePath
sourceLocation
reason
action
releaseEffect
```

## 5. Phase 2 — Layout and Mapping Contract

### V3-2A Map source geometry

Preserve:

```text
source row/column/length
source record
window offset
target row/column
planned span
actual span
lossiness
```

Report:

```text
overlap
crop
reflow
row overflow
reading-order change
```

### V3-2B Enforce source-object completeness

For every source object, require exactly one result:

```text
converted
converted-with-warning
manual-review
unsupported
error
```

Acceptance:

```text
dropped source object count = 0
```

## 6. Phase 3 — Main controller preview

### V3-3A Integrate refresh chain

```text
DspfDocument.emit()
    → Semantic IR
    → Mapping Contract
    → screen model
    → integrated MUI preview
```

### V3-3B Render complete SFL screens

The preview must show:

```text
control record
subfile template
visible fields
hidden controls as metadata only
RRN/cursor metadata
page and scroll state
manual-review evidence
```

### V3-3C Main-controller E2E

Run against `http://localhost:5173/`:

```text
open fixture
select record
change Canvas field
change source
verify preview refresh
verify settings
verify Inspector
verify record relations
verify source sync
```

## 7. Phase 4 — Generated React application

### V3-4A Generate application

Generate:

```text
package.json
vite.config.js
React entry
MUI theme
route manifest
screen components
field bindings
error states
traceability
conversion report
```

### V3-4B Build and browser audit

```text
npm install
npm run build
npm run dev
Playwright audit
```

Required states:

```text
normal
manual-review
unsupported
validation error
not found
forbidden
revision conflict
session expiry
```

## 8. Phase 5 — Spring Boot runtime

### V3-5A Generate backend contract

Generate:

```text
pom.xml
RuntimeApplication
ScreenController
TransactionController
ErrorResponse
session service
transaction service
idempotency service
authorization service
audit service
```

### V3-5B Implement runtime contract

Verify:

```text
GET screen
POST transaction
session
AID
cursor
subfiles
messages
field validation
Idempotency-Key
X-Correlation-Id
```

HTTP cases:

```text
200
400
401
403
404
409
422
429
440
500
```

## 9. Phase 6 — Governance and release

Require:

```text
Draft
Generated
Manual Review
Approved
Rejected
Overridden
Superseded
```

Enforce:

```text
maker-checker
SoD
append-only audit
non-repudiation
revision invalidation
deployment gate
```

## 10. Verification matrix

```text
Vitest conversion contracts
React component tests
Spring contract tests
Playwright main-controller tests
Playwright generated-app tests
Vite production build
Maven build and integration tests
DSPF round-trip
Canvas/faithful preview parity
DspfDocument immutability
source-object completeness
```

## 11. Release gates

### Gate A — Source complete

```text
source inventory exists
dependency closure reported
no unknown external source hidden
```

### Gate B — Semantic complete

```text
all source objects classified
no dropped object
SFL/record relations retained
REFFLD resolved or explicitly reviewed
```

### Gate C — Preview complete

```text
main controller refreshes
complete SFL screen visible
hidden controls are not editable
mapping evidence visible
```

### Gate D — React complete

```text
standalone build succeeds
browser audit succeeds
route and error states work
traceability is present
```

### Gate E — Runtime complete

```text
Spring Boot contract implemented
session/auth/idempotency work
transaction errors work
browser-to-API flow works
```

### Gate F — Deployable

```text
approved revision
maker-checker passed
SoD passed
audit evidence retained
no manual-review blocker
```

## 12. First V3 execution ticket

```text
V3-0A — Define conversion project source set
```

Use the pulled Custom-Account input as the first fixture project, including all DSPF, PF, LF, RPGLE, and CL files. Do not resolve an external `XAN4CDEM` reference by guessing a local alias.
