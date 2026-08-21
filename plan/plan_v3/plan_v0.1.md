# DSPF·RAD V3 Plan v0.1

## Status

Refined from `plan/plan_v3/plan_v0.md` after IBM i, React/Vite, and Spring Boot/QA reviews. This document is a plan. It does not claim that V3 implementation is complete.

## Locked decisions

| Decision | Selected option | Reason |
|---|---|---|
| Conversion input | A versioned project source set | A single DSPF cannot resolve PF/LF/runtime dependencies |
| Missing external source | Preview/build may continue; deployment must stop | The converter must not guess field metadata or business behavior |
| Legacy boundary | Keep the existing `DspfDocument`, parser, writer, Canvas, faithful preview, and source sync | Existing behavior is a regression contract |
| React boundary | Generated app consumes serialized Mapping Contract only | Generated code must not import mutable designer state |
| Spring boundary | Spring Boot owns session, authorization, transaction, idempotency, and audit | Runtime authority must not be duplicated in React or conversion code |
| Review state | Keep `manual-review` with actionable provenance | Removing warnings would hide conversion loss |
| TypeScript | Use TypeScript for new generated app/API boundaries when the build pipeline owns them; keep legacy static JS unchanged | This gives type safety without destabilizing the no-build editor |

## Known evidence and blockers

```text
V2.1 root conversion tests: 26 passed
React app Vitest: 110 passed before V3 changes
React app Playwright: 24 passed before V3 changes
WCUSTSD2 browser E2E: 5 passed
WCUSTSD2 React Vite build: succeeded
Spring Boot generated scaffold Maven package: succeeded
```

The pulled Custom-Account source contains `CUSTMAST.PF`, `ACCTMAST.PF`, `CUSTMASTL1.LF`, and `ACCTMASTL1.LF`. `WCUSTSD2.DSPF` references `XAN4CDEM/CUSTS` and `XAN4CDEM/SLMEN`, which are absent. The V3 source gate must record this mismatch before conversion.

Current implementation gaps identified by review:

```text
Semantic IR leaves several groups empty.
PF index does not yet cover all source field forms or LF definitions.
REFFLD integration does not pass the populated index into the preview path.
Generated React emits a shell and binding JSON, not complete mapped components.
Generated route, field-binding, and traceability artifacts do not yet satisfy schemas.
Spring output is a contract scaffold, not a live runtime.
```

## Architecture

```text
ConversionProject
  ├── sourceSetManifest
  ├── sourceInventory
  ├── dependencyClosure
  ├── pfLfIndex
  ├── dspfDocuments
  ├── runtimeSources
  ├── DspfSemanticIR
  ├── MappingContract
  ├── conversionReport
  ├── generatedReact
  └── generatedSpringRuntime
```

## Wave 0 — Source set and dependency closure

### V3-0A Define source-set manifest

Record path, source type, encoding, revision, SHA-256, and owner for every DSPF, PF, LF, RPGLE, SQLRPGLE, and CL source.

**Gate:** The manifest lists every supplied file and every external reference discovered in DSPF/RPG/CL sources.

### V3-0B Build PF/LF source index

Parse PF record fields, keys, types, lengths, decimals, validation hints, and source locations. Parse LF based-on files, keys, select/omit rules, and source locations.

**Gate:** Duplicate definitions are conflicts. Unsupported definitions are explicit diagnostics.

### V3-0C Build dependency closure

Resolve `REFFLD`, SFL/SFLCTL, WINDOW, menu, CHCCTL, RPG display bindings, and CL program references.

**Gate:** Each dependency is `resolved`, `missing`, `ambiguous`, or `unsupported`. No unresolved dependency is hidden.

### V3-0D Define readiness states

Use separate states:

```text
previewable
buildable
review-required
runtime-ready
deployable
```

**Gate:** `review-required` cannot be reported as `deployable`.

## Wave 1 — Semantic IR completeness

### V3-1A Complete Semantic IR groups

Populate record relations, fields, constants, references, indicators, AIDs, windows, subfiles, menus, messages, cursor, capabilities, diagnostics, and source revision.

**Gate:** Every source object has one status and `droppedObjectCount = 0`.

### V3-1B Resolve REFFLD

Use only the indexed source or an explicit approved alias. Preserve requested source, matched source, metadata, source location, reason, and status.

**Gate:** `XAN4CDEM` references remain actionable `manual-review` until their actual source or approved alias is supplied.

### V3-1C Assemble SFL and record graph

Combine SFL control/template, RRN, `RTNCSRLOC`, page size, total size, indicators, message records, and owner paths.

**Gate:** WCUSTSD2 control/template source order and relation count are preserved.

### V3-1D Normalize field roles

Map `H` to hidden-control/non-editable/non-visible. Map `P`, `I`, `O`, and `B` without conflation.

**Gate:** No H field renders as an editable visible input.

## Wave 2 — Complete Mapping Contract

### V3-2A Generate schema-valid mappings

Every mapping contains source identity, target component, source geometry, target geometry, runtime binding key, DOM id, status, lossiness, and full traceability.

**Gate:** Validate mapping, field-binding, route, diagnostic, and traceability schemas.

### V3-2B Enforce no-drop invariant

Compare source inventory objects with Semantic IR, Mapping Contract, and generated output. Emit an error for any missing object.

**Gate:** `droppedObjectCount = 0`.

## Wave 3 — Main controller and generated React

### V3-3A Refresh integrated preview

At `http://localhost:5173/`, rebuild the conversion chain after Canvas and source-editor mutation. Preserve Canvas, faithful preview, selection, source sync, and the single document.

### V3-3B Generate complete React components

Generate visible fields, constants, system values, hidden controls, SFL bands, diagnostics, provenance, route manifest, field bindings, error states, and conversion report. Generate a Vite config with the complete dependency closure.

### V3-3C Build and audit generated app

Run `npm install`, `npm run build`, and Playwright against the generated app. Test routes, reload, fields, hidden controls, manual review, unsupported, validation, forbidden, conflict, and session-expiry states.

## Wave 4 — Spring Boot runtime

### V3-4A Generate compilable Spring project

Generate controllers, domain objects, services, repositories, security, audit, tests, `pom.xml`, `application.yml`, and OpenAPI.

### V3-4B Implement runtime contract

Implement screen, transaction, session, authorization, validation, idempotency, correlation ID, and audit behavior.

**Gate:** Run live Spring Boot tests for 200, 400, 401, 403, 404, 409, 422, 429, 440, and 500.

### V3-4C Connect generated React to Spring Boot

Run a browser-to-API smoke test. The API base URL and local mode must be explicit. Production authentication must not fall back to local mode.

## Wave 5 — Governance and deployment

Implement revision hash, artifact receipt, approval state, maker-checker, SoD, append-only audit, non-repudiation, and deployment gate.

**Gate:** A changed source revision invalidates approval. A blocking manual review cannot deploy.

## Verification matrix

| Layer | Required proof |
|---|---|
| Source | Manifest, hashes, encoding, dependency closure |
| Semantic | Schema validation, no-drop count, relation and REFFLD tests |
| Preview | Main-controller browser mutation and SFL tests |
| React | Clean Vite build, generated-app Playwright, traceability |
| Spring | Maven build, OpenAPI contract, live endpoint and error tests |
| Governance | Approval, SoD, audit, revision invalidation, deployment block |
| Regression | Existing root and React suites, DSPF round-trip, parity, immutability |

## Rollback

Keep source manifest, Semantic IR, Mapping Contract, generated React, generated Spring, and receipt in revision directories. Roll back the revision artifact. Never roll back by mutating the legacy `DspfDocument` or overwriting handwritten extension points.

## First executable ticket

```text
V3-0A — Define source-set manifest
```

The first fixture is the pulled Custom-Account project. `WCUSTSD2.DSPF` remains review-required for absent `XAN4CDEM` PF/DD sources until the source or an approved alias is supplied.

## Expert review record

Reports:

```text
plan_v0_expert1.md — IBM i domain review
plan_v0_expert2.md — React/Vite delivery review
plan_v0_expert3.md — Spring Boot and QA review
```

Accepted findings:

```text
source closure must precede conversion
Semantic IR groups must be populated and integrated
REFFLD must consume the indexed source set
generated React must be schema-valid and component-complete
Spring scaffold is not runtime completion
runtime and deployable gates must remain separate
```

Deferred by explicit blocker:

```text
XAN4CDEM/CUSTS and XAN4CDEM/SLMEN metadata cannot be resolved until the source members or an approved alias mapping are supplied.
```

The primary plan changed its first executable task to `V3-0A Define source-set manifest`. The plan does not claim expert agreement beyond the findings recorded in the three reports.

## Additional React review findings

The generated app must render mapped screen components, not only a metadata dump. The generated route manifest must satisfy `contract/frontend/route-manifest.schema.json`, including route identity, permission, loader, error, not-found, and dirty-state behavior. Generated bindings must preserve `output.role`, `editable`, `visible`, `valueType`, `usage`, and `readOnly`. Generated traceability must include source, target, status, lossiness, target component, and DOM identity. The main controller must consume Semantic IR and Mapping Contract rather than only the legacy visual model. Add clean generated-app build and Browser E2E gates for these requirements.

## Additional Spring and QA review findings

The Spring scaffold cannot pass the runtime gate while endpoints return `contract-only`. V3 must define session cookie and CSRF behavior, deny-by-default authorization, atomic idempotency key scope/fingerprint/replay/TTL rules, error response mapping, append-only audit, maker-checker, SoD, non-repudiation, artifact receipts, and revision invalidation. A live generated-React-to-Spring smoke test must exercise the OpenAPI contract before runtime-ready status.
