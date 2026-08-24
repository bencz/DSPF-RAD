# 01 Scope, Boundaries, and Sources

## 1. System purpose

DSPF·RAD converts an IBM i DSPF design into a reviewable modern React application.
The system keeps the existing 5250 design experience unchanged.

The product of this repository is **frontend conversion**. A generated Spring Boot server exists only to supply seed data so a generated React app shows realistic effects when the reference application has no backend or not enough data.

## 2. Scope table

| Area | Status | Reason |
|---|---|---|
| DSPF parse → Semantic IR → Mapping Contract → generated React | In scope | This is the core product. |
| Converted preview in the designer shell | In scope | Reviewers need a live target view. |
| Spring Boot seed-data demo server | In scope | Generated screens need data to show effects. |
| Seed extraction from RPG/RPGLE reference sources | In scope | Reference apps carry display values and hints that can seed demos. |
| Production session, CSRF, authorization, idempotency, audit | Out of scope (deferred) | Owner decision D-11. The demo server must not impersonate production authority. |
| Approval / maker-checker / deployment gates as product features | Out of scope (deferred) | Owner decision D-11. |
| RPG business-logic migration | Out of scope | Only display values, indicators, messages, and workflow hints are extracted. |

## 3. System flow

```text
DSPF source (+ PF/DD where available)
    ↓ read-only
DspfDocument (existing designer model)
    ↓ conversion core
DspfSemanticIR → Mapping Contract
    ↓                     ↓
converted pane       React generator
(designer shell)         ↓
                    generated React app
                         ↓ HTTP
                    seed-data demo server
```

## 4. Responsibility boundaries

| Area | Responsibility | Must not do |
|---|---|---|
| Existing parser/model/writer | Parse, edit, and round-trip DSPF | Infer business workflow |
| `DspfDocument` | Hold the canonical design document | Become a second runtime store |
| Conversion core (`src/codegen/`) | Build Semantic IR, mapping contract, generators, reports | Mutate `DspfDocument` |
| Designer shell (`react-app/`) | Canvas, faithful preview, converted pane, source sync | Own conversion policy |
| React generator | Produce source files and traceability | Invent unsupported actions |
| Generated React app | Show screens; submit demo transactions | Decide permissions or business results |
| Seed-data server | Serve deterministic seeded screen state | Reimplement DSPF rules or impersonate a production backend |

There is no conversion-time HTTP server today. The CLI scripts (`pnpm generate:react`, `pnpm generate:spring`) and the browser are the only conversion consumers.

## 5. State ownership

| State | Owner |
|---|---|
| DSPF design | `DspfDocument` |
| Selection | Existing designer selection bus |
| Converted visual model | Derived pure result |
| Generated code | Export artifact |
| Demo screen state | Seed-data server response |
| Server cache | TanStack Query |
| URL navigation state | TanStack Router |
| Form draft | Local component state |

Do not put `DspfDocument` into the Query cache.

## 6. Test corpora (reference apps)

These directories are test inputs. No runtime code references them.

```text
TESTS/      curated DSPF fixtures for round-trip and layout tests
QDDSSRC/    real-world DSPF sources; primary conversion fixtures (for example WCUSTSD2.DSPF)
INPUT/      external RPG/RPGLE/CL reference applications; sources for dependency-closure tests and seed extraction
```

Rules:

- Use these corpora for unit fixtures, Playwright e2e loads, and seed-extraction trials.
- Record every missing external member (for example `XAN4CDEM/CUSTS`) as an explicit diagnostic. Do not hide it and do not fall back to a same-named local file.

## 7. Release gates

### Gate L: Legacy safety

- Root vitest suite passes.
- react-app vitest and Playwright suites pass.
- DSPF round-trip passes; Canvas and faithful-preview parity passes.
- Conversion does not mutate `DspfDocument`.

### Gate S: Semantic safety

- DSPSIZ is explicit; source identity is qualified.
- References resolve or receive review status with metadata authority applied.
- Unsupported semantics are visible; layout lossiness is reported.
- Zero silent source-object drops.

### Gate G: Generated app safety

- Generated app builds standalone.
- Route, field-binding, diagnostic, and traceability artifacts validate against schemas.
- Demo mode is labeled; the app never presents seed data as production data.

---
