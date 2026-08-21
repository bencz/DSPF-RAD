# DSPF React Preview and Generation Methodology

## 1. Purpose

This methodology adapts the useful Penpot preview and generation practices to DSPF-RAD. It defines a repeatable path from DSPF source to a browser-tested React output.

The methodology does not import Penpot MCP APIs. It uses the existing DSPF parser, Semantic IR, Mapping Contract, Vite, and Playwright boundaries.

## 2. End-to-end flow

```text
requirements brief
    ↓
DSPF/PF-DD/runtime source selection
    ↓
DspfDocument
    ↓ read-only
DspfSemanticIR
    ↓
versioned Mapping Contract
    ↓
deterministic React output
    ↓
Vite dev server and HMR/reload
    ↓
Browser preview and screenshot
    ↓
production build and Playwright audit
    ↓
conversion receipt and report
```

## 3. Intermediate configuration

The Mapping Contract is the generator input. It must preserve source identity, target identity, layout semantics, bindings, diagnostics, and acceptance conditions.

Do not use a screenshot, generated CSS, or generated JSX as the source of truth.

```json
{
  "schemaVersion": "mapping/1.0",
  "sourceRevision": "R1",
  "conversionProfile": "modern-react-v1",
  "source": {
    "modelKey": "24x80",
    "record": "SIGNON"
  },
  "mappings": [],
  "tokens": "contract/target_design.md",
  "requirements": {
    "routes": [],
    "interactions": [],
    "responsive": [],
    "acceptance": []
  },
  "openQuestions": []
}
```

## 4. Change classification

Classify a change before selecting the preview action:

| Change | Preview action | Reason |
|---|---|---|
| Token value | HMR | Component identity does not change |
| Layout span or gap | HMR | The target layout can update in place |
| Content binding | HMR | The screen structure remains stable |
| Route | Full reload | Route initialization changes |
| Asset manifest | Full reload | Browser asset state can be stale |
| Provider or boot config | Full reload | Application initialization changes |
| Runtime server config | Restart | The server owns the configuration |
| Semantic IR schema | Regenerate | All derived mappings can change |

## 5. Preview and formal verification

Preview answers:

```text
What does the browser show now?
```

Formal verification answers:

```text
Does the generated app build, preserve mappings, and pass its acceptance contract?
```

Preview cannot replace:

```text
build
contract tests
round-trip tests
accessibility tests
runtime API tests
Playwright audit
```

## 6. Single-change repair loop

```text
fix one source, mapping, token, or layout difference
write the change to the Mapping Contract
classify the change
select HMR, reload, regenerate, or restart
open the fixed viewport and route
read console and network errors
capture a screenshot and diagnostic
compare the result with acceptance criteria
IF the result improves:
    keep the contract change
ELSE:
    restore the previous contract value
    inspect the next upstream boundary
```

Do not change source geometry, token values, component mapping, and generated markup in one repair loop. A single change keeps the cause of an improvement traceable.

## 7. Generated and handwritten ownership

Keep generated and handwritten output separate:

```text
src/generated/
src/features/
```

The generator can replace `src/generated/`. The generator must not overwrite `src/features/`.

Use explicit extension points for handwritten business logic:

```text
props
adapter
composition boundary
runtime API client
```

## 8. Conversion receipt

Save one receipt for each generation run:

```json
{
  "sourceRevision": "R1",
  "mappingRevision": "M3",
  "converterVersion": "1.0.0",
  "outputHash": "sha256:...",
  "viewport": "1600x1200",
  "route": "/screens/SIGNON",
  "checks": {
    "build": "passed",
    "contract": "passed",
    "playwright": "passed",
    "accessibility": "manual-review"
  },
  "unresolved": []
}
```

Keep failed receipts. Do not replace a failed result with a fallback output.

## 9. DSPF tool mapping

| Penpot method | DSPF-RAD method |
|---|---|
| `high_level_overview` | Read contract index and plan before conversion |
| `shapeStructure` | Read record/item structure from `DspfDocument` |
| design config | Mapping Contract |
| generated markup/style | React component model and design tokens |
| live preview | Vite dev server/HMR |
| export shape | Generated React artifact and screenshot |
| visual diff | Playwright screenshot and diagnostic comparison |
| plugin storage | Versioned conversion artifact store |

## 10. Delivery gate

Deliver a generated React result only when:

```text
Mapping Contract is versioned
all source objects have a mapping status
unknown objects have diagnostics
React output builds
browser route loads
critical interactions pass
screenshot uses the fixed viewport
traceability is complete
failed checks remain visible
```
