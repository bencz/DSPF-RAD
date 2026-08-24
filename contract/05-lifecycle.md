# 05 Lifecycle and Integration Pipeline

## 1. Purpose

Define one repeatable path from an IBM i source set to a delivered generated React app. Every stage has explicit inputs, commands, gates, and artifacts so any stage can rerun alone or be replaced without breaking the others.

## 2. Stage model

```text
① SOURCE → ② EDIT → ③ CONVERT → ④ GENERATE → ⑤ VERIFY → ⑥ DELIVER
```

| Stage | Input | Command / owner | Output | Gate |
|---|---|---|---|---|
| ① Source | DSPF/PF/LF/RPG/CL set | source manifest + dependency closure (`sourceManifest.js`, `dependencyClosure.js`) | versioned manifest, closure graph, readiness state | missing sources stay explicit; readiness per `01-scope-and-sources.md` |
| ② Edit | `DspfDocument` | designer shell + OpenPencil overlay (`pnpm extract:overrides`) | edited doc + versioned `layout-overrides.json` | overrides touch target-side values only; identities unchanged |
| ③ Convert | doc + overrides | conversion core: IR → Mapping Contract | contract + diagnostics | `droppedObjectCount = 0`; gates C0–C2 of `02-conversion-core.md` |
| ④ Generate | serialized contract | `pnpm generate:react --` / `pnpm generate:spring --` (or `pnpm convert --`, see §8) | standalone React app, seed server, four artifacts | standalone build passes; generator imports no designer state |
| ⑤ Verify | generated output + suites | verification ladder (§4) | gate evidence records | every ladder level green; failures retained |
| ⑥ Deliver | everything above | receipt writer | receipt + artifact bundle | receipt hashes match; readiness label truthful |

Stage boundaries are file-based. Tools exchange versioned files (`.fig` exports, normalized JSON, seed JSON), never shared runtimes.

## 3. Identity and hash chain

The identity chain survives every stage:

```text
sourceIdentity → runtimeBindingKey → domId → businessName
```

Overrides bind only to `sourceIdentity`. The artifact hash chain anchors delivery:

```text
sourceHash (complete source set)
  → mappingHash (Mapping Contract)
  → overridesHash (layout-overrides.json; null when absent)
  → outputHash (generated tree)
```

A receipt that cannot recompute its own chain is invalid. Reproducibility check: converting the same input twice must produce identical hashes — this is why all artifacts sort deterministically and carry no timestamps.

Hash format rule: every hash value is written as `<algorithm>:<hex>`. Current tags: `fnv1a:` for `overridesHash` (browser-safe; also carried on the contract as `contract.overridesHash` + `contract.overridesApplied` after L4-0A). Receipt artifact hashes are sha256 from Node crypto and keep their `sha256:` tag in receipts; the legacy bare-hex `sourceRevision.sourceHash` inside IR artifacts is fnv1a and gets tagged when ticket L4-0B unifies the chain. Do not mix formats inside one receipt without the tag.

## 4. Verification ladder

Run fast levels first; a failed level blocks the next:

```text
L1 unit (node)          pnpm test                      pure conversion core
L2 component (jsdom)    npm test                       preview components, hooks
L3 build                npm run build                  generated app compiles standalone
L4 browser              npx playwright test            user-observable behavior
L5 integration          seed-server contract tests     screen/transaction endpoints (when server exists)
```

Evidence rules:

- Each level stores one evidence record in the receipt format of `02-conversion-core.md` §13.
- **Evidence must point at user-observable behavior** — a rendered grid, a computed style, an HTTP response — not at the existence of internal functions. A passing test against an unused module proves nothing and must not close a ticket.
- Failed receipts are kept; no fallback outputs replace failed results.

## 5. Receipt specification

One receipt per generation run (extends the preview receipt in `03-generated-react-app.md` §10):

```json
{
  "schemaVersion": "receipt/2",
  "sourceRevision": "R1",
  "mappingHash": "sha256:...",
  "overridesHash": "fnv1a:c690d034",
  "converterVersion": "1.0.0",
  "outputHash": "sha256:...",
  "command": "pnpm convert -- QDDSSRC/WCUSTSD2.DSPF",
  "checks": {
    "unit": "passed", "component": "passed", "build": "passed", "browser": "passed"
  },
  "readiness": "review-required",
  "counts": { "converted": 108, "warning": 12, "manualReview": 68, "unsupported": 0, "error": 0 },
  "unresolved": ["XAN4CDEM/CUSTS"],
  "timestamp": "2026-08-24T00:00:00Z"
}
```

Rules: the timestamp lives inside the receipt but never inside hashed artifacts; `readiness` comes from stage ① states and may be less advanced than the checks suggest, never more.

## 6. Failure policy

```text
IF a ladder level fails:
    stop the pipeline before the next level
    keep the failed receipt with exit codes and artifact paths
ELSE IF a gate reports dropped objects or unresolved errors:
    stop executable output for those objects
    continue only as preview/build with review labels
```

Do not downgrade a failed stage to a warning. Do not deliver with stale receipts.

## 7. Determinism rules

- Artifacts serialize with stable key order; lists sort by identity or path.
- No timestamps, random values, locale-dependent numbers, or absolute paths inside hashed artifacts.
- Same input + same converter version ⇒ byte-identical artifacts.

## 8. Rollout status (honest boundary)

| Stage element | State |
|---|---|
| ① manifest/closure/readiness | implemented (`src/codegen/*`) |
| ② extract:overrides CLI | implemented; real `.fig` adapter pending (L4-2A) |
| ③ convert core + override application | implemented; browser-verified via converted pane |
| ④ generators consuming overrides | **implemented 2026-08-24** — `buildMappingContract(ir, { overrides })` is the single path; CLI `--overrides`; manifests carry `effectiveProfile` and tagged `overridesHash` |
| ⑤ verification ladder | exists manually; CI workflow **implemented 2026-08-24** (`check:projections` + L1→C5 sweep→L4), first remote run pending push; **Gate C5 sweep live 2026-08-24** (70/70 fixtures, 0 escapes) |
| ⑥ receipts | in-memory store exists; disk persistence + orchestrator pending (L4-0B/L4-1A) |
| single entry `pnpm convert --` | **pending** — planned as L4-1A |

Execution tickets live in `plan/plan_v4_lifecycle_tickets.md`. This section is updated when a row changes state; do not mark pending rows complete without evidence per D-16.

---
