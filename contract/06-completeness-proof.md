# 06 Contract Completeness Proof

## 1. Claim boundary



This contract set does not claim that every unknown IBM i program behavior is known.

It claims a stronger and testable property:

```text
Every known supported case has a schema, rule, consumer, and test gate.
Every unknown case receives a status, reason, source identity, and review path.
No unsupported case produces silent executable output.
```

## 2. Coverage model



For each semantic category, require this tuple:

```text
source evidence
→ IR field or relation
→ mapping rule
→ output contract
→ diagnostic status
→ test fixture or property test
```

A category is not complete when one member of the tuple is missing.

## 3. Known-case coverage matrix



| Category | Source evidence | Contract | Output | Required proof |
|---|---|---|---|---|
| 24x80 | `TESTS/*.DSPF` | `layout-policy.json` | 12-grid layout | fixture + mapping test |
| 27x132 | `TESTS/SCROLL_BAR.DSPF` | `layout-policy.json` | 12-grid layout | fixture + profile test |
| Record formats | DSPF `R` lines | `record-relation.schema.json` | record/component | relation test |
| WINDOW | WINDOW keywords | record relation schema | offset component | offset test |
| SFL/SFLCTL | SFL keywords | `sfl-runtime.schema.json` | contract/manual-review | SFL fixture test |
| REFFLD | PF/DD reference | relation + runtime binding schema | resolved/manual-review | missing-source test |
| CHCCTL | choice keywords | relation schema | choice control | choice fixture test |
| AID | CA/CF/F-key keywords | OpenAPI `Aid` | action | action contract test |
| Indicators | conditioned keywords | Semantic IR + diagnostics | visible/enabled/review state | polarity test |
| External runtime | RPGLE or other source | `runtime-binding.schema.json` | binding/review hint | adapter fixture test |
| Identity | duplicate fields/records | `identity.schema.json` | source/runtime/DOM identity | collision test |
| Diagnostics | unsupported input | `diagnostic.schema.json` | report item | status matrix test |
| Security | runtime API context | `security.schema.json` | authorized request | auth contract test |

## 4. Unknown-case containment proof



For every object that the converter cannot resolve:

```text
IF the object has a known safe mapping:
    status = converted
ELSE IF the object has a mapping with recorded loss:
    status = converted-with-warning
ELSE IF owner input or external source is required:
    status = manual-review
ELSE IF no safe output exists:
    status = unsupported
ELSE:
    status = error
```

Every non-converted result must include:

```text
code
severity
status
message
reason
action
sourceIdentity
sourceLocation when available
```

The converter must stop executable output for `unsupported` and unresolved `error` results.

## 5. Completeness gates



### Gate C0: Schema gate

- Parse every JSON schema.
- Parse `openapi.yaml`.
- Check that every referenced schema path exists.
- Check that every example uses the declared field names.

### Gate C1: Semantic gate

- Test 24x80 and 27x132.
- Test duplicate field names.
- Test SFL/SFLCTL.
- Test WINDOW ownership.
- Test REFFLD with and without source.
- Test CHCCTL and menu relations.
- Test indicator polarity.
- Test external runtime binding.

### Gate C2: Conversion gate

- Test source-to-target traceability.
- Test target row/column and span.
- Test overlap, crop, reflow, and overflow.
- Test manual-review and unsupported output.
- Test deterministic output for the same input and profile.

### Gate C3: Legacy gate

- Run existing parser and writer round-trip tests.
- Run Canvas parity tests.
- Run React faithful preview tests.
- Run source-sync tests.
- Compare `DspfDocument.toJSON()` before and after conversion.

### Gate C4: Generated app gate

- Build the generated React app without the designer source.
- Validate the generated manifest hash.
- Load the generated app in Playwright.
- Test route, field, action, error, and manual-review states.
- Test the Spring Boot OpenAPI contract.

## 6. Proof evidence format



Store one evidence record for each gate:

```json
{
  "gate": "C1",
  "command": "npx vitest run --pool=threads --maxWorkers=1",
  "result": "passed",
  "exitCode": 0,
  "tests": 108,
  "timestamp": "2026-08-20T00:00:00Z",
  "artifacts": ["test-results/semantic-ir.json"]
}
```

## 7. Completeness decision



Declare the contract complete only when:

```text
all known categories have the coverage tuple
all unknown categories have containment rules
all blockers have acceptance tests
all consumers have compatible schemas
all legacy gates pass
all generated artifacts have traceability
```

If any condition is false, report the contract as incomplete and list the missing category. Do not convert an incomplete contract into a production-ready label.

---
