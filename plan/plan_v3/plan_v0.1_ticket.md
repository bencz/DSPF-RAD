# DSPF·RAD V3 Tickets

**Plan source:** `plan/plan_v3/plan_v0.1.md`

**Status:** Ready for execution. Each ticket must write tests first, run the required verification, update evidence, commit, and push before the next ticket starts.

## Ticket index

| ID | Title | Blocked by | Outcome |
|---|---|---|---|
| V3.0A | Define the conversion project source set | None | Versioned DSPF/PF/LF/RPGLE/CL manifest |
| V3.0B | Index PF and LF field metadata | V3.0A | Qualified field and key index |
| V3.0C | Resolve the external dependency closure | V3.0A, V3.0B | Resolved, missing, ambiguous, unsupported dependency graph |
| V3.0D | Enforce source readiness states | V3.0C | Preview/build/review/runtime/deploy readiness |
| V3.1A | Complete Semantic IR assembly | V3.0D | Source-complete semantic model with zero drops |
| V3.1B | Resolve REFFLD metadata | V3.0B, V3.0C | PF/DD metadata or actionable review |
| V3.1C | Assemble complete SFL and record relations | V3.1A, V3.1B | Complete SFL/SFLCTL and owner graph |
| V3.1D | Normalize field roles and indicators | V3.1A | H/P/I/O/B roles and indicator semantics |
| V3.2A | Generate schema-valid Mapping Contract | V3.1A–V3.1D | Complete source-to-target mapping |
| V3.2B | Enforce zero dropped source objects | V3.2A | Source-to-output completeness proof |
| V3.3A | Refresh integrated preview from Semantic IR | V3.2A | Current main-controller converted preview |
| V3.3B | Render complete SFL preview and provenance | V3.1C, V3.2A | Inspectable SFL and source evidence |
| V3.4A | Generate complete React screen components | V3.2B | Usable mapped React screen |
| V3.4B | Validate generated React artifact | V3.4A | Schema-valid, buildable, browser-audited app |
| V3.5A | Generate compilable Spring Boot runtime | V3.2B | Buildable backend project and OpenAPI |
| V3.5B | Implement session and security contract | V3.5A | Session, CSRF, authorization, and security errors |
| V3.5C | Implement transaction and idempotency contract | V3.5B | Runtime transaction and replay safety |
| V3.5D | Connect generated React to Spring Boot | V3.4B, V3.5C | Browser-to-live-API flow |
| V3.6A | Persist conversion receipts and revisions | V3.2B, V3.5A | Reproducible revision and gate evidence |
| V3.6B | Enforce approval and deployment gates | V3.5D, V3.6A | Approved, auditable, deployable revision |

## Shared ticket contract

Every ticket must satisfy:

```text
write a failing test for the new observable contract
implement the smallest compatible change
run focused tests
run affected regression tests
record command, result, exit code, timestamp, and artifact paths
commit the stage
push the stage
```

Every ticket must preserve:

```text
DspfDocument as the single legacy design document
parser, writer, Canvas, faithful preview, Inspector, and source sync
sourceIdentity, runtimeBindingKey, DOM id, and businessName as separate identities
explicit status for unknown, unsupported, manual-review, and error semantics
zero silent source-object drops
```

---

# V3.0 — Source set and dependency closure

## V3.0A — Define the conversion project source set

**What to build:** Create a versioned manifest for every DSPF, PF, LF, RPGLE, SQLRPGLE, CL, and declared external source.

**Acceptance criteria:**

- [ ] Every member has path, type, encoding, revision, SHA-256, and owner.
- [ ] The manifest identifies the project and selected conversion entry points.
- [ ] Missing paths are recorded before conversion starts.
- [ ] Manifest output is deterministic.

**Verification:** Unit test manifest construction and run it against the pulled Custom-Account source set. Record the missing `XAN4CDEM` members.

**Non-goals:** Do not parse business behavior or infer aliases.

**Failure condition:** Any supplied member is omitted or any missing dependency is hidden.

## V3.0B — Index PF and LF field metadata

**What to build:** Parse PF and LF definitions into a qualified index.

**Acceptance criteria:**

- [ ] The index preserves file, record, field, type, length, decimals, keys, select/omit rules, and source location.
- [ ] The index supports every DDS type found in the source set.
- [ ] Duplicate definitions produce an explicit conflict.
- [ ] The index is deterministic.

**Verification:** Test PF/LF fixtures, including packed, zoned, character, date, and time fields.

**Non-goals:** Do not convert PF/LF into JPA entities.

## V3.0C — Resolve the external dependency closure

**What to build:** Build a graph for REFFLD, SFL/SFLCTL, WINDOW, menu, CHCCTL, RPGLE display bindings, and CL program calls.

**Acceptance criteria:**

- [ ] Each dependency is `resolved`, `missing`, `ambiguous`, or `unsupported`.
- [ ] Each edge has source identity and source location.
- [ ] `XAN4CDEM/CUSTS` and `XAN4CDEM/SLMEN` remain explicit missing dependencies when absent.
- [ ] Missing dependencies block deployment readiness.

**Verification:** Run the graph against WCUSTSD2 and record all external references.

## V3.0D — Enforce source readiness states

**What to build:** Define readiness independently from conversion status.

**States:**

```text
previewable
buildable
review-required
runtime-ready
deployable
```

**Acceptance criteria:**

- [ ] Missing external source produces `review-required`.
- [ ] `review-required` cannot become `deployable` without resolution or approved override.
- [ ] Readiness is included in the conversion report.

**Verification:** Test WCUSTSD2 with and without its external PF/DD sources.

---

# V3.1 — Semantic completeness

## V3.1A — Complete Semantic IR assembly

**What to build:** Populate all Semantic IR groups from the source inventory and dependency graph.

**Acceptance criteria:**

- [ ] Record relations, fields, constants, references, indicators, AIDs, windows, subfiles, menus, messages, cursor, capabilities, and diagnostics are populated when present.
- [ ] Every source object has exactly one conversion status.
- [ ] `droppedObjectCount` is zero.
- [ ] Source revision hashes the complete source set, not only `DspfDocument.toJSON()`.

**Verification:** Schema validation and WCUSTSD2 zero-drop report.

## V3.1B — Resolve REFFLD metadata

**What to build:** Resolve REFFLD only against the indexed source set or an explicit approved alias map.

**Acceptance criteria:**

- [ ] Resolved references include type, length, decimals, validation, matched source, and source location.
- [ ] Missing references retain requested target, source identity, reason, required action, and release effect.
- [ ] The converter never substitutes a same-named local file without approval.

**Verification:** Test ZWE0NB, ZWJUN0, PNAME, ZWGIVA, ZZFT02, and ZZCNF1 references.

## V3.1C — Assemble complete SFL and record relations

**What to build:** Combine SFL control/template, owner, RRN, RTNCSRLOC, page, scroll, message, WINDOW, and menu relations.

**Acceptance criteria:**

- [ ] WCUSTSD2 preserves ZZCT01, ZZSF01, ZZFT01, and ZZFT02 relationships.
- [ ] Source reading order and all items are retained.
- [ ] SFL runtime absence is `contract-only` or `manual-review`, not fake runtime behavior.

**Verification:** Semantic and Browser tests using WCUSTSD2 and WCUSTSD2-related fixtures.

## V3.1D — Normalize field roles and indicators

**What to build:** Normalize H/P/I/O/B usage, indicator polarity, scope, INDARA, display state, enabled state, and action state.

**Acceptance criteria:**

- [ ] H fields are hidden, non-editable, and traceable.
- [ ] P fields are explicitly protected/reviewed.
- [ ] I, O, and B roles remain distinct.
- [ ] `Nxx` remains distinct from `xx`.
- [ ] Unknown scope receives `manual-review`.

**Verification:** Test SHWREC, SFIELD, RECNAM, visible input/output fields, and conditioned keywords.

---

# V3.2 — Mapping and completeness

## V3.2A — Generate schema-valid Mapping Contract

**What to build:** Generate mappings for every Semantic IR object.

**Acceptance criteria:**

- [ ] Every mapping contains source identity, target component, source geometry, target geometry, runtime binding key, DOM id, status, lossiness, and full traceability.
- [ ] Field bindings satisfy the frontend field-binding schema.
- [ ] Routes satisfy the route-manifest schema.
- [ ] Diagnostics satisfy the diagnostic schema.

**Verification:** Validate all selected JSON schemas and run deterministic repeated generation.

## V3.2B — Enforce zero dropped source objects

**What to build:** Compare source inventory, Semantic IR, Mapping Contract, and generated artifacts.

**Acceptance criteria:**

- [ ] Every source object appears as converted, warning, review, unsupported, or error.
- [ ] `droppedObjectCount = 0`.
- [ ] Any dropped object stops the affected gate.

**Verification:** WCUSTSD2 completeness report and missing-source report.

---

# V3.3 — Main controller preview

## V3.3A — Refresh integrated preview from Semantic IR

**What to build:** Refresh the converted preview at `http://localhost:5173/` from the current Semantic IR and Mapping Contract after every document change.

**Acceptance criteria:**

- [ ] Canvas changes refresh converted preview.
- [ ] Source-editor changes refresh converted preview.
- [ ] Converted preview never renders stale IR.
- [ ] Canvas, faithful preview, selection, source sync, and history remain unchanged.

**Verification:** Playwright mutation tests on the main controller.

## V3.3B — Render complete SFL preview and provenance

**What to build:** Show complete SFL control/template context, mapping evidence, source locations, relation status, and review reasons.

**Acceptance criteria:**

- [ ] ZZSF01 preview shows its control record and related records.
- [ ] Each item exposes source and target geometry.
- [ ] Each review item exposes target, missing dependency, reason, and action.
- [ ] H controls are not visible editable inputs.

**Verification:** WCUSTSD2 Browser screenshot and DOM assertions.

---

# V3.4 — Generated React/Vite

## V3.4A — Generate complete React screen components

**What to build:** Generate a usable screen component tree from the Mapping Contract.

**Acceptance criteria:**

- [ ] Generated output renders fields, constants, system values, SFL bands, diagnostics, and review states.
- [ ] H controls remain hidden/non-editable but addressable by identity.
- [ ] Generated output contains route, field binding, theme, and API boundaries.
- [ ] Generated app does not import mutable designer code.

**Verification:** Generate WCUSTSD2 output and assert visible component coverage and zero dropped visible items.

## V3.4B — Validate generated React artifact

**What to build:** Validate and audit the standalone app.

**Acceptance criteria:**

- [ ] Clean `npm install` succeeds.
- [ ] `npm run build` succeeds.
- [ ] Generated route, field-binding, diagnostic, and traceability artifacts validate.
- [ ] Browser tests cover route, reload, fields, H controls, review, unsupported, forbidden, conflict, and session-expiry states.

**Verification:** Run generated-app Playwright against the generated WCUSTSD2 app.

---

# V3.5 — Spring Boot runtime

## V3.5A — Generate compilable Spring Boot runtime

**What to build:** Generate the complete backend project boundary.

**Acceptance criteria:**

- [ ] Project contains `pom.xml`, application, controllers, domain, services, security, audit, repositories, tests, and OpenAPI.
- [ ] Maven build succeeds.
- [ ] OpenAPI is the selected runtime contract.

**Verification:** Clean Maven build and contract compilation.

## V3.5B — Implement session and security contract

**What to build:** Implement session acquisition, cookie/CSRF rules, authorization context, and deny-by-default behavior.

**Acceptance criteria:**

- [ ] Missing, expired, and invalid sessions return defined 401/440 responses.
- [ ] State-changing requests require CSRF protection.
- [ ] Missing permission returns 403.
- [ ] Security context includes actor, session, roles, and correlation ID.

**Verification:** Live Spring endpoint tests.

## V3.5C — Implement transaction and idempotency contract

**What to build:** Implement screen transaction, AID, cursor, subfile, message, validation, and atomic idempotency behavior.

**Acceptance criteria:**

- [ ] Same key and same payload replays the original response.
- [ ] Same key and different payload conflicts.
- [ ] Concurrent duplicate requests serialize atomically.
- [ ] Stale revision returns 409.
- [ ] Validation returns 422.

**Verification:** Live API tests for 200, 400, 409, 422, 429, 440, and concurrent replay.

## V3.5D — Connect generated React to Spring Boot

**What to build:** Connect generated API client and browser screen to the live runtime.

**Acceptance criteria:**

- [ ] Generated React reads screen state from Spring Boot.
- [ ] Generated React submits AID and field payload.
- [ ] Session, CSRF, validation, permission, revision, and transaction errors render correctly.
- [ ] Local and HTTP modes remain explicit.

**Verification:** Browser-to-live-Spring smoke test.

---

# V3.6 — Governance and release

## V3.6A — Persist conversion receipts and revisions

**What to build:** Persist revision-scoped metadata and per-gate receipts.

**Acceptance criteria:**

- [ ] Receipt stores command, result, exit code, tests, timestamp, artifact paths, source hash, mapping hash, and output hash.
- [ ] Repeated conversion of identical input is reproducible.
- [ ] Restart and concurrent revision tests preserve isolation.

**Verification:** SQLite or selected persistence integration test.

## V3.6B — Enforce approval and deployment gates

**What to build:** Enforce Draft, Generated, Manual Review, Approved, Rejected, Overridden, and Superseded states.

**Acceptance criteria:**

- [ ] Maker cannot approve their own conversion.
- [ ] Source revision change invalidates approval.
- [ ] Blocking manual review prevents deployment.
- [ ] Append-only audit and non-repudiation evidence are retained.
- [ ] Deployment requires all release gates to pass.

**Verification:** Approval state-machine, SoD, audit, revision invalidation, and forbidden deployment tests.

## Final release gate

V3 is complete only when all gates pass:

```text
source complete
semantic complete
preview complete
React complete
runtime complete
approval complete
deployable
```

A missing external source may produce a useful preview and a successful build. It must not produce a deployable status.

## V3.0A execution evidence

`src/codegen/sourceManifest.js` provides `buildSourceManifest(sourceFiles)`. The builder validates source types, records path, type, encoding, revision, owner, and SHA-256, and sorts output by path for deterministic results.

**Test:** `pnpm test -- --run src/codegen/sourceManifest.test.js` passed 27 tests across 6 files.

**Status:** V3.0A core manifest boundary complete. Full Custom-Account inventory execution remains the next integration check.

## V3.0C execution evidence

`src/codegen/dependencyClosure.js` provides `buildDependencyClosure()` and classifies each dependency as `resolved`, `missing`, `ambiguous`, or `unsupported`, while retaining `sourceIdentity`, target, kind, and reason.

**Test:** `pnpm test -- --run src/codegen/dependencyClosure.test.js` passed 29 tests across 7 files. The test proves that `XAN4CDEM/CUSTS.XWE0NB` remains an explicit missing dependency and cannot become a successful conversion by fallback.

**Status:** V3.0C core classifier complete. Full source-set graph integration remains part of V3.0D/V3.1A.
