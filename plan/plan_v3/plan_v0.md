# DSPF·RAD V3 Plan v0

## Five Core Questions

1. **Outcome:** Convert a complete IBM i source set into a traceable Semantic IR, Mapping Contract, standalone React/Vite app, Spring Boot runtime contract, and browser/API evidence.
2. **Scope:** Include DSPF, PF, LF, RPGLE, CL, REFFLD, SFL/SFLCTL, indicators, runtime bindings, React output, Spring Boot output, E2E, diagnostics, and release gates. Exclude a complete RPG compiler, guessed external source mappings, guessed business permissions, and executable unresolved actions.
3. **Contract:** Preserve the single `DspfDocument`, existing parser, writer, Canvas, faithful React preview, Inspector, source synchronization, and legacy browser behavior. Keep source, runtime, and DOM identities separate.
4. **Constraints:** `http://localhost:5173/` is the DSPF-RAD controller. `http://localhost:8000/` is the template reference. Missing PF/DD source remains review-only. Each stage runs tests before commit and push.
5. **Acceptance:** `WCUSTSD2.DSPF` and its complete source set produce zero dropped source objects, resolved or actionable REFFLD evidence, complete SFL output, hidden H controls, successful React and Spring builds, Browser E2E, API contract evidence, and a deployment-blocking review gate.

## Problem

V2.1 proved the conversion chain and generated output, but real Custom-Account input exposed missing source closure, incomplete REFFLD resolution, weak SFL completeness evidence, and over-broad completion claims.

## Architecture

```text
ConversionProject
  ├── source inventory
  ├── dependency graph
  ├── PF/LF index
  ├── DSPF documents
  ├── runtime sources
  ├── DspfSemanticIR
  ├── Mapping Contract
  ├── conversion report
  └── generated artifacts
        ├── React/Vite app
        └── Spring Boot runtime contract
```

## Dependency-ordered waves

### Wave 0 — Source closure

1. Define source-set manifest.
2. Hash and classify every DSPF, PF, LF, RPGLE, CL, and external reference.
3. Report missing and ambiguous dependencies before conversion.

### Wave 1 — Semantic completeness

1. Parse PF/LF fields and keys.
2. Resolve REFFLD only against indexed sources or explicit approved aliases.
3. Assemble record, SFL, WINDOW, menu, message, and runtime relations.
4. Normalize H, P, I, O, B usage and indicator polarity.
5. Emit one status for every source object.

### Wave 2 — Preview completeness

1. Build source-to-target mappings.
2. Assemble complete SFL control/template screens.
3. Render visible fields, constants, system values, hidden controls, review states, and provenance.
4. Refresh integrated preview after every document change.

### Wave 3 — Generated applications

1. Generate React/Vite files, theme, routes, bindings, diagnostics, report, and traceability.
2. Generate Spring Boot files and OpenAPI-aligned runtime contracts.
3. Build both outputs outside the designer.

### Wave 4 — Verification and release

1. Run unit, component, contract, integration, and Browser E2E tests.
2. Run main-controller regression at `http://localhost:5173/`.
3. Run generated React Browser audit.
4. Run Spring Boot API tests.
5. Block deployment when unresolved review remains.

## Release gates

| Gate | Pass condition |
|---|---|
| Source complete | Every input has identity, hash, type, and encoding; dependencies are resolved or listed |
| Semantic complete | Every source object has a status; dropped count is zero |
| Preview complete | Active record and SFL relations are complete; H controls are hidden/non-editable |
| React complete | Clean Vite build and Browser audit pass |
| Runtime complete | Spring Boot OpenAPI, session, transaction, error, and idempotency tests pass |
| Deployable | Approved revision has no blocking manual-review, security, or source-closure issue |

## Regression contract

Run before and after each affected wave:

```text
root conversion tests
react-app Vitest suite
react-app Playwright suite
Vite production build
Maven build and integration tests
DSPF parse/write/parse checks
Canvas and faithful preview parity
DspfDocument immutability
```

## Rollback

Keep generated artifacts in a revision directory. Revert the Mapping Contract revision, not the legacy `DspfDocument`. Do not overwrite handwritten generated-app extension points.

## Open decisions

No high-impact decision is deferred. Use explicit manual-review states for missing source and stop at the relevant release gate.
