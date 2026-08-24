# DSPF·RAD V4 Lifecycle Tickets

**Plan source:** `contract/05-lifecycle.md` · **Decisions:** D-11…D-17

**Status:** Updated 2026-08-24 after expert review. DONE: L4-0E → L4-0C → L4-0A (+ review fixes) → L4-1B → L4-0D. Remaining, in recommended order:

```text
L4-0B receipts    disk persistence + sha256 unification
L4-1A convert     single entry (depends on L4-0B)
L4-2A .fig        real OpenPencil adapter
Backlog           seed server epic · MUI component swap · loader error surfacing
```

## Shared ticket contract

```text
write a failing test for the new observable contract
implement the smallest compatible change
run the focused tests, then the affected ladder levels
record command, result, exit code, and artifact path
commit the stage
```

Evidence must point at user-observable behavior — rendered output, computed style, HTTP response, or artifact hash (D-16). An internal module existing is not evidence.

## Ticket index

| ID | Title | Blocked by | Outcome |
|---|---|---|---|
| L4-0A | Generators consume design overrides | None | ✅ DONE 2026-08-24 — overrides flow end-to-end |
| L4-0B | Receipt persistence (receipt/2) | None | Receipts survive process exit; chain recomputable |
| L4-1A | `pnpm convert` single-entry orchestrator | L4-0A, L4-0B | One command runs ③④⑤ and prints a receipt |
| L4-1B | CI workflow running the verification ladder | None | ✅ IMPLEMENTED 2026-08-24 — PR #1 opened; first remote run awaiting owner approval (first-time-contributor policy) |
| L4-2A | OpenPencil `.fig` adapter via CLI | None | Real exports flow through `extract:overrides` |
| L4-0C | Semantic profile evidence | None | ✅ DONE 2026-08-24 — manifests self-declare semantic rules |
| L4-0D | Containment sweep (Gate C5) | None | ✅ DONE 2026-08-24 — 70/70 fixtures, 0 escapes; caught 2 real identity/revision bugs |
| L4-0E | Pipeline hygiene pack | None | ✅ DONE 2026-08-24 — see design doc §2 |
| Backlog | Seed server implementation (`04-seed-backend.md`) | L4-1A | Live demo API for generated apps |

---

# Wave 0 — Generator and receipt foundations

## L4-0A — Generators consume design overrides ✅ DONE

**Completed 2026-08-24.** `buildMappingContract(ir, { overrides })` is the single application path (preview and generators share it — `semanticPreview.js` refactored onto the same entry point). Both CLI scripts accept `--overrides <json>` (BOM-tolerant), print `overridesHash`, and `App.jsx` export buttons pass the loaded design state.

**Expert-review fixes folded in (same day):**

- Evidence chain closed: the contract now carries `overridesHash` + `overridesApplied`, and both generators copy them into `conversion-manifest.json` — previously the hash existed only in the CLI console line.
- Hash format tagging: `overridesHash` emits as `fnv1a:<hex>`; contract 05 §3 gained the `<algorithm>:<hex>` rule to stop sha256/fnv mixing inside receipts.
- Payload tolerance: the contract entry point accepts wrapped `{ overrides: [...] }` payloads via `normalizeOverrideInput` — a programmatic caller passing the extractor file shape no longer silently no-ops.

**Evidence:** root vitest **81 passed** (`overridesAndProfile.test.js`: apply + tagged-hash assertions, wrapped-payload tolerance, manifest carry-through on both generators, baseline identity); live WCUSTSD2 run: 188 mappings, overridden component visible in generated `src/App.jsx`, identical `fnv1a:` hash from both generators.

## Expert review record — 2026-08-24

Full re-read of the round's diff found 3 issues, all fixed before closing:

| Finding | Severity | Resolution |
|---|---|---|
| overridesHash absent from manifests (ticket claim vs reality gap) | High | Contract carries it; generators propagate; tests assert format |
| sha256/fnv1a mixed untagged in one future receipt | High | `<algorithm>:<hex>` contract rule; fnv1a prefix now; sha256 unify in L4-0B |
| Strict array-only override entry → silent no-op for file-shaped payloads | Medium | `normalizeOverrideInput` at the entry point |

Accepted-as-is list lives in the review conversation: render-phase ref mirror in `App.jsx`, hidden-item override counts, script-level CLI tests deferred to L4-1A, unprefixed legacy `sourceRevision.sourceHash` noted in contract 05 §3.

## L4-0B — Receipt persistence (receipt/2)

**What to build:** Extend `src/codegen/receipts.js` with a filesystem store: `persistReceipt(dir, receipt)` / `loadReceipts(dir)` writing one JSON per run into `<outdir>/.receipts/`, implementing `schemaVersion: "receipt/2"` exactly as `05-lifecycle.md` §5 (hash chain + readiness + counts).

**Acceptance criteria:**

- [ ] Persisted receipts re-read identically; corrupt files surface as unreadable entries, never crash.
- [ ] Hash-chain validation helper rejects receipts whose hashes do not recompute from artifacts.
- [ ] Failed runs persist with failed checks retained.

**Verification:** Unit tests over tmp dirs including corruption and reproducibility cases.

**Non-goals:** No SQLite, no server storage — deferred with governance (D-11).

---

# Wave 1 — Pipeline entry and automation

## L4-1A — `pnpm convert` single-entry orchestrator

**What to build:** `scripts/convert.mjs` exposed as `pnpm convert -- <DSPF path> [--overrides <json>] [--out <dir>] [--skip-spring]`:

```text
read source → parseDspf → buildCompleteSemanticIR → buildMappingContract(+overrides)
    → validateMappingContract + assessObjectCompleteness (C0/C2 subset)
    → generateReactApp (+ generateSpringBootApp unless --skip-spring)
    → writeGeneratedReactApp into <dir>/react-app, spring tree into <dir>/spring-runtime
    → write conversion-manifest.json, binding-map.json, traceability.json,
      conversion-report.md, layout-overrides copy, receipt into <dir>/.receipts/
    → print one JSON summary line { outputPath, mappings, diagnostics, readiness, receiptPath }
```

**Acceptance criteria:**

- [ ] Running twice on identical input produces identical trees and identical receipt hashes except the timestamp.
- [ ] Missing-source readiness (`review-required`) appears in both summary and receipt.
- [ ] A failing completeness gate blocks generation of that target and exits non-zero with the report written.

**Verification:** Node integration tests over tmp dirs using `TESTS/*.DSPF`; manual browser smoke loading the generated app.

**Non-goals:** Do not run the verification ladder inside this script (L3/L4 stay external); do not add a watch mode.

## L4-1B — CI workflow running the verification ladder ✅ IMPLEMENTED

**Implemented 2026-08-24.** `.github/workflows/ci.yml`: push/PR on master → pnpm 11 + Node 22 (pnpm cache) → `npm ci` in react-app → **projection consistency check** (`pnpm check:projections`, folded in per design doc §4.4) → L1 → L2 → L3 build → chromium install → L4 Playwright. Concurrency cancel, `contents: read`, 20-min timeout, no deploy jobs (D-17).

**Verification so far:** every command sequence executed green locally on the current tree (81 + 112 + build + 31 browser checks; js-yaml parses the workflow; `check:projections` returns ok with 14 schemas). **Pending:** the first real GitHub Actions run. PR #1 (bencz/DSPF-RAD, branch `v4-contract-and-gates`) was opened 2026-08-24; as a first-time-contributor PR it needs owner approval in the Actions tab before the ladder executes — or enable Actions for the repo.

**Non-goals:** No deploy jobs, no release automation until the seed server epic lands (D-17).

---

# Wave 2 — Tool fidelity

## L4-0C — Semantic profile evidence ✅ DONE

**Completed 2026-08-24.** `describeConversionProfile()` in `src/codegen/conversionProfile.js` records layout policy, status vocabulary, component rules, authority order, and their contract sources; `buildConversionManifest()` embeds it as `effectiveProfile` in every generated manifest.

**Evidence:** root vitest 79 passed; live WCUSTSD2 manifest shows `profile=true` with 11 files listed.

**Tuning note:** making profile values adjustable stays blocked behind the D-10 process — contract Markdown first, then implementation.

## L4-0D — Containment sweep (Gate C5) ✅ DONE

**Completed 2026-08-24.** `src/codegen/containmentSweep.js` (pure auditor, E1–E3) + `scripts/verify-sources.mjs` (`pnpm verify:sources`, adds E4 determinism + E5 throws over the corpora). Wired into CI after L1.

**The gate proved itself on day one** — first real run caught two genuine defects that unit tests had normalized away:

1. **Identity naming drift**: layoutMapper derived identities as `…:sysvalue:sysvalue:…` while semantic IR used `…:sysvalue:system-value:…` for unnamed system values → 4 mappings marked `converted` with no target. Fixed by extracting the shared `sourceIdentities.js` module (`itemNameOf`/`itemSourceIdentity`) used by IR, layout mapper, and design overrides.
2. **Unstable source revisions**: `sourceRevision.sourceHash` hashed the snapshot including parse-counter item ids, so the same DSPF text produced a different revision every parse; SFL `controlItems` leaked ids too. Fixed with id-stripped stable snapshots in `semanticIR.js` and `sflAssembly.js`.

**Evidence:** sweep over 70 fixtures (TESTS 20 + QDDSSRC 50): `{"total":70,"passed":70,"failed":0}` escapes=0 exit 0; deterministic `coverage-matrix.json`; root vitest 86 passed including 5 auditor tests with E1/E2/E3 negative injections.

**Follow-up tickets from findings:** none open — both root causes fixed in-ticket because they were identity/revision infrastructure this ticket owns.

## L4-0E — Pipeline hygiene pack ✅ DONE

**Completed 2026-08-24** (evidence in `design_v4a_mapping_visibility_semantic_containment.md` §2):

- [x] `generated/` gitignored
- [x] `window.dspfRad.semantic()` / `.designOverrides` console mapping view
- [x] Four evidence artifacts from both generators (`artifacts.test.js`, 5 tests)

---

# Wave 2 — Tool fidelity (continued)

## L4-2A — OpenPencil `.fig` adapter

**What to build:** Normalize real OpenPencil output into the extractor's node shape. Preferred path: invoke `bun open-pencil tree --json <doc.fig>` (or `export`) from `scripts/extract-design-overrides.mjs` behind a `--from-cli` flag; fall back to reading an already-exported JSON file.

**Acceptance criteria:**

- [ ] One real hand-authored `.fig` containing `dspf:`-prefixed nodes yields expected overrides end-to-end.
- [ ] Adapter is skipped (not silently wrong) when bun/OpenPencil is unavailable; skip reason printed.
- [ ] Deterministic output across two extractions of the same document.

**Verification:** Guarded integration test (skips without bun) plus a recorded fixture JSON committed for CI determinism testing.

**Non-goals:** Do not import open-pencil source packages; CLI/file boundary only (D-15).

## Backlog (not scheduled here)

- Seed-data Spring Boot server per `04-seed-backend.md` (unblocks L5 integration level).
- Overridden component swap renders real MUI components in the converted pane (currently metadata-only).
- Surface `designOverridesLoader` error states in the pane UI instead of silent disable.
