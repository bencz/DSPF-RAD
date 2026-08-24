# 02 Conversion Core: Semantic IR, Layout, Mapping, Completeness

## Normative source boundary

This document defines semantic decisions and policy. Machine-readable shapes live in `contract/schemas/`:

```text
Semantic IR shape       → schemas/semantic-ir.schema.json
Identity shape          → schemas/identity.schema.json
Relation shape          → schemas/record-relation.schema.json
SFL contract shape      → schemas/sfl-runtime.schema.json
Layout formula          → schemas/layout-policy.json
Diagnostic shape        → schemas/diagnostic.schema.json
Diagnostic policy       → schemas/semantic-diagnostics.json
Traceability shape      → schemas/traceability.schema.json
Field binding shape     → schemas/field-binding.schema.json
Route manifest shape    → schemas/route-manifest.schema.json
Component state shape   → schemas/component-state.schema.json
Runtime binding shape   → schemas/runtime-binding.schema.json (generic base)
RPG binding extension   → schemas/rpg-display-binding.schema.json
Workflow hints          → schemas/workflow-hint.schema.json
```

Do not duplicate schema fields here. Add rationale and examples only.

## 1. Conversion flow

```text
parseDspf()
    ↓
DspfDocument                      (existing designer model)
    ↓ read-only adapter           never mutates the document
DspfSemanticIR                    schemaVersion + sourceRevision + converterVersion
    ↓ profile resolver            24x80 / 27x132 / manual-review
    ↓ identity + reference graph  sourceIdentity, relations, REFFLD authority
    ↓ capability classification   statuses and diagnostics
ModernLayoutModel                 layout policy applied
    ↓
Mapping Contract → generated React + seed extraction + report
```

The IR must include `schemaVersion`, `sourceRevision`, and `converterVersion`. The source revision hashes the complete source set, not only `DspfDocument.toJSON()`.

## 2. Document boundary

The conversion layer must not call:

```text
doc.updateItem()  doc.addItem()  doc.removeItem()  doc.adopt()  doc.emit()
```

The conversion layer must not change:

```text
item.id  record.type  record.keywords  activeRecordIndex
```

Regression checks run before and after conversion:

```text
parse → write → parse round-trip
DspfDocument snapshot before/after IR build
Canvas parity, faithful-preview parity, source sync, selection sync
```

A conversion test fails when conversion changes the existing document or an existing faithful-preview result.

## 3. Display profile rule

```text
IF DSPSIZ resolves to 24x80:
    sourceCols = 80
ELSE IF DSPSIZ resolves to 27x132:
    sourceCols = 132
ELSE:
    status = manual-review; do not assume 80 columns
```

The conversion core resolves DSPSIZ itself. It must not depend on the file-open UI.

## 4. Identity rule

Keep these identities separate:

```text
sourceIdentity       project:revision:record:field:occurrence:role
runtimeBindingKey    runtime payload key
domId                HTML/test selector ("Z-XXXX" form)
businessName         business-level name
```

Do not use a bare field name as a global key. Do not use a DOM id as a business key.

## 5. Reference and metadata authority rule

Build graph edges for:

```text
REFFLD  CHCCTL  MNUBARCHC → PULLDOWN  WINDOW parent/child  SFLCTL → SFL
```

Resolve reference metadata in this priority order (metadata authority):

```text
1. compiled DDS metadata          highest priority
2. exact PF/LF source             offline fallback
3. explicitly approved alias      traceable override
4. none of the above              status = missing-source → manual-review,
                                  blocks runtime/deployment readiness claims
```

Never substitute a same-named local file without approval. A reference that does not resolve produces a review item with target, reason, and required action — never a placeholder success.

## 6. Record relation rule

Do not treat every DSPF record as a route. Classify records first:

```text
display-record  window  subfile-template  subfile-control
menu-bar        pulldown  message-record
```

Store owner and relation edges before generating routes or components.

## 7. Semantic field model

Each field preserves:

```text
sourceIdentity  record  name  role  row  col  length  dataType  decimals
usage  indicators  keywords  references  runtimeCapability  conversionStatus
```

`usage` keeps the parser vocabulary (`I`, `O`, `B`, `H`, `P`, `M` when present). Normalize roles so that:

- `H` fields are hidden, non-editable, and traceable.
- `P` fields are protected or reviewed.
- `I`, `O`, `B` remain distinct.
- `Nxx` indicator polarity stays distinct from `xx`; unknown scope receives `manual-review`.

## 8. Layout policy

```text
sourceCols    = displayProfile.cols
sourceCol     = clamp(item.col, 1, sourceCols)
sourceLength  = effectiveLength(item)
targetCol     = floor((sourceCol - 1) / sourceCols * 12) + 1
plannedSpan   = clamp(round(sourceLength / sourceCols * 12), 1, 12)
actualSpan    = clamp(plannedSpan, 1, 13 - targetCol)
```

Preserve both geometries:

```text
sourceRow  sourceCol  sourceLength  sourceRecord  windowOffset
targetRow  targetCol  plannedSpan   actualSpan     lossiness
```

Process items in source reading order. If the next item does not fit, apply the selected policy:

```text
wrap | compress | manual-review
```

The default is `manual-review` for overlap or a changed reading order. Never silently move a field to another row.

## 9. OPTION and FUNCTION rule

Classify an action by semantic capability, not by component kind:

```text
command identity  AID  record/resource target  row/page scope
permission        isDestructive  confirmation  idempotency
```

If the action target or AID cannot be resolved, return `manual-review` or `unsupported`. Unsupported actions must not generate executable handlers.

## 10. SFL first-release boundary

Describe SFL runtime data; do not pretend to implement the IBM i subfile runtime.
Capture `SFLPAG SFLSIZ SFLEND SFLDSP SFLDSPCTL SFLCLR SFLNXTCHG SFLMSGRCD RRN page scroll`.
If runtime rows or indicators are unavailable, return the runtime contract plus `manual-review`. Do not generate a normal table with false paging behavior.

## 11. Conversion status

Every source object receives exactly one status:

```text
converted | converted-with-warning | manual-review | unsupported | error
```

Unknown-case containment:

```text
IF the object has a known safe mapping:                converted
ELSE IF mapping with recorded loss:                    converted-with-warning
ELSE IF owner input or external source required:       manual-review
ELSE IF no safe output exists:                         unsupported
ELSE:                                                  error
```

Every non-converted result includes `code severity status message reason action sourceIdentity` and `sourceLocation` when available. The converter stops executable output for `unsupported` and unresolved `error`. `droppedObjectCount = 0` is a hard gate: any dropped object fails the affected gate.

## 12. Coverage model

For each semantic category require this tuple:

```text
source evidence → IR field/relation → mapping rule → output contract → diagnostic status → test fixture
```

| Category | Source evidence | Output | Required proof |
|---|---|---|---|
| 24x80 / 27x132 | `TESTS/*.DSPF` | 12-grid layout | fixture + profile test |
| Record formats | DSPF `R` lines | record/component | relation test |
| WINDOW | WINDOW keywords | offset component | offset test |
| SFL/SFLCTL | SFL keywords | contract/manual-review | SFL fixture test |
| REFFLD | PF/DD reference | resolved/manual-review | missing-source test |
| CHCCTL | choice keywords | choice control | choice fixture test |
| AID | CA/CF/F-key keywords | action | action contract test |
| Indicators | conditioned keywords | visible/enabled/review state | polarity test |
| External runtime | RPGLE or other source | seed values/hints or review | adapter fixture test |
| Identity | duplicates | separate identities | collision test |
| Diagnostics | unsupported input | report item | status matrix test |

## 13. Completeness gates

### Gate C0: Schema gate

Parse every JSON schema and `openapi.yaml`. Check referenced paths exist. Check examples use declared fields.

### Gate C1: Semantic gate

Test both display profiles, duplicate names, SFL/SFLCTL, WINDOW ownership, REFFLD with and without source, CHCCTL/menu relations, indicator polarity, external runtime binding.

### Gate C2: Conversion gate

Test traceability, target geometry, overlap/crop/reflow/overflow, review and unsupported output, deterministic repeated generation.

### Gate C3: Legacy gate

Round-trip tests, Canvas parity, faithful-preview parity, source sync, `DspfDocument` immutability.

### Gate C4: Generated app gate

Build the generated React app without designer source. Validate artifact hashes and schemas. Load in Playwright. Test route, field, action, error, and manual-review states against the seed API.

### Gate C5: Containment sweep gate

Run the full pipeline over every corpus fixture (`TESTS/`, `QDDSSRC/`). Assert zero throws; every source object carries exactly one legal status; inventory, mapping, and diagnostic identities reconcile; repeated runs produce identical hashes. Any escape — an object absent from mappings and diagnostics, an illegal status, a `converted` outside the coverage matrix, or a hash mismatch — fails the gate. Runner: `scripts/verify-sources.mjs`; output `coverage-matrix.json` is referenced by the receipt. See `plan/design_v4a_mapping_visibility_semantic_containment.md` §4 for the escape definitions.

Store one evidence record per gate:

```json
{
  "gate": "C1",
  "command": "pnpm test",
  "result": "passed",
  "exitCode": 0,
  "tests": 63,
  "timestamp": "2026-08-24T00:00:00Z",
  "artifacts": ["test-results/semantic-ir.json"]
}
```

Declare the contract complete only when every known category has the coverage tuple, unknown categories have containment rules, blockers have acceptance tests, consumers have compatible schemas, legacy gates pass, and generated artifacts have traceability. Otherwise report incomplete and list the missing category. Do not label an incomplete contract production-ready.

---
