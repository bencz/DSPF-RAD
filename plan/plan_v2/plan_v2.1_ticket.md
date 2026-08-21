# DSPF·RAD V2.1 Modern React First Slice Tickets

**Plan source:** `plan/plan_v2/updating_plan_v2.1.md`, Section 24

**Purpose:** Show a Modern React converted preview without changing the existing DSPF parser, document model, writer, Canvas preview, React faithful preview, Inspector, or source-sync behavior.

**Status:** Completed — owner authorized execution without another approval round.

## Contract references

All Semantic Layout tickets from V2.1-1A through V2.1-1G must read and preserve these contract files:

```text
contract/semantic-layout-design.md
contract/schemas/semantic-ir.schema.json
contract/schemas/semantic-diagnostics.json
contract/schemas/layout-policy.json
contract/schemas/traceability.schema.json
```

Use `semantic-layout-design.md` for the conversion boundary and ownership rules. Use `semantic-ir.schema.json` for the Semantic IR shape. Use `semantic-diagnostics.json` for conversion status and review state. Use `layout-policy.json` for source profile and target grid mapping. Use `traceability.schema.json` for source-to-target evidence.

If a ticket needs to change one of these contracts, update the contract file, the affected ticket acceptance criteria, and the verification evidence in the same change because the ticket must not implement a different contract from the plan.

**Evidence:** Contract paths were checked and the four JSON contract files parsed successfully.

## Ticket index

| ID | Title | Blocked by | Outcome |
|---|---|---|---|
| V2.1-0A | Record the legacy behavior baseline | None | Freeze the regression baseline before new conversion code |
| V2.1-0B | Build the read-only visual conversion adapter | V2.1-0A | Produce a visual model without mutating `DspfDocument` |
| V2.1-0C | Show the Modern React converted pane | V2.1-0B | Show the SIGNON fixture with MUI and a 12-column layout |
| V2.1-0D | Prove first-slice integration safety | V2.1-0C | Prove that the new pane does not change existing behavior |
| V2.1-0E | Improve preview workspace presentation | V2.1-0D | Hide/show faithful React Preview without changing legacy geometry |
| V2.1-0F | Correct modern source mapping and converted pane resize | V2.1-0E | Map source columns to 12-grid and let the converted pane grow left |
| V2.1-1A | Define the read-only DspfSemanticIR contract | V2.1-0F | Describe DSPF semantics without mutating legacy document data |
| V2.1-1B | Resolve DSPSIZ display profiles | V2.1-1A | Select 24x80 or 27x132 before layout conversion |
| V2.1-1C | Build qualified identity and reference graph | V2.1-1A | Prevent binding collisions across records and references |
| V2.1-1D | Classify conversion capabilities and review states | V2.1-1B, V2.1-1C | Classify supported, warning, manual-review, unsupported, and error semantics |
| V2.1-1E | Build profile-based semantic layout mapper | V2.1-1B, V2.1-1C | Preserve source geometry while producing target 12-grid layout |
| V2.1-1G | Define the RPGLE display binding adapter | V2.1-1A, V2.1-1C | Bind RPGLE runtime values and EXFMT workflow hints to DSPF fields |
| V2.1-1F | Show the complete semantic converted screen | V2.1-1D, V2.1-1E, V2.1-1G | Show the full active record with traceability and lossiness warnings |
| V2.1-1H | Resolve external PF/DD field references | V2.1-1A, V2.1-1C | Resolve REFFLD type, length, decimals, validation, or manual review |
| V2.1-1I | Resolve DSPF record-format relations | V2.1-1A, V2.1-1C | Resolve SFL, WINDOW, menu, and message record ownership |
| V2.1-1J | Define the first-release SFL runtime contract | V2.1-1I | Describe SFL page, RRN, scroll, indicator, and message state |
| V2.1-1K | Normalize DSPF indicator semantics | V2.1-1A, V2.1-1I | Preserve polarity and indicator scope |
| V2.1-1L | Build the OPTION/FUNCTION action graph | V2.1-1D, V2.1-1I, V2.1-1K | Preserve AID, target, permission, and destructive action metadata |
| V2.1-2A | Generate the source-to-target Mapping Contract | V2.1-1D, V2.1-1E, V2.1-1G, V2.1-1H, V2.1-1J, V2.1-1L | Produce versioned mapping and traceability |
| V2.1-2B | Generate standalone React output | V2.1-2A | Produce an independent React/Vite application |
| V2.1-2C | Start generated frontend and runtime API | V2.1-2B | Run the generated app with local or HTTP runtime mode |
| V2.1-2D | Audit generated React output in a browser | V2.1-2C | Prove output layout, binding, routes, errors, and interactions |
| V2.1-2E | Approve a conversion revision before deployment | V2.1-2D | Enforce review, audit, SoD, and revision approval |
| V2.1-2F | Add optional conversion service metadata | V2.1-2E | Add Node/SQLite metadata only when operational needs exist |
| V2.1-2G | Integrate generated React with Spring Boot | V2.1-2D, V2.1-2E | Prove runtime API, session, auth, idempotency, and errors |

---

# V2.1-0A — Record the legacy behavior baseline

**Plan source:** `updating_plan_v2.1.md` Section 24.3

**What to build:**

Record the current DSPF application behavior before the Modern React converted pane is added. Store the test commands, fixture list, result counts, and build result because later tickets must prove that existing behavior remains unchanged.

**Blocked by:**

None — this ticket can start immediately because it records the current behavior only.

**Decision contract:**

- Keep the existing `DspfDocument` as the only design document.
- Keep the existing Canvas and React faithful preview behavior.
- Keep the existing source synchronization behavior.

**Necessary conditions:**

- The current React application can start.
- The existing test dependencies are installed.
- The current `TESTS/` and `QDDSSRC/` fixtures are available.

**Acceptance criteria:**

- [ ] The baseline records 106 passing Vitest tests.
- [ ] The baseline records 20 passing Playwright tests.
- [ ] The baseline records a successful Vite build.
- [ ] The baseline records DSPF round-trip results.
- [ ] The baseline records Canvas and React faithful preview parity results.
- [ ] The baseline lists the exact fixture set and command output.

**Tests:**

- Unit: run `npx vitest run` and record the result.
- Browser: run `npx playwright test` and record the result.
- Build: run `npm run build` in `react-app` and record the result.
- Regression: run the existing DSPF round-trip and parity checks.

**Pass condition:**

All baseline commands pass, and the result is stored with the plan artifacts.

**Failure condition:**

Any baseline command fails, any expected test count is unknown, or any fixture result is missing.

**Evidence:**

Record the command output and the output path in the ticket completion report.

**Non-goals:**

Do not add MUI. Do not add a converted pane. Do not modify parser, model, writer, Canvas, React faithful preview, or source sync.

**Risk notes:**

A missing baseline prevents later tickets from proving that the new conversion code did not break existing behavior.

**Status:** Completed.

---

# V2.1-0B — Build the read-only visual conversion adapter

**Plan source:** `updating_plan_v2.1.md` Sections 20 and 24.4

**What to build:**

Build a read-only adapter that converts the existing `DspfDocument` into a small visual model for the first Modern React preview. The adapter supports constants, fields, system values, record names, row, column, length, usage, basic COLOR, and basic DSPATR because these values are already available in the current document.

**Blocked by:**

V2.1-0A — the baseline must exist because this adapter must pass the existing regression gate.

**Decision contract:**

- Read the existing `DspfDocument`.
- Return a new visual model.
- Do not create a second design document.
- Do not infer business workflow or runtime transaction behavior.
- Do not treat the visual model as the final Semantic IR.

**Necessary conditions:**

- V2.1-0A has a recorded passing baseline.
- The adapter input contract is documented.
- The adapter output contract is documented.

**Acceptance criteria:**

- [ ] The adapter returns visual records and visual items for the SIGNON fixture.
- [ ] The adapter preserves source record name, item kind, row, column, length, usage, and basic style data.
- [ ] The adapter does not call `doc.updateItem()`.
- [ ] The adapter does not call `doc.addItem()`.
- [ ] The adapter does not call `doc.adopt()`.
- [ ] The adapter does not call `doc.emit()`.
- [ ] The adapter does not change item IDs, record types, record keywords, or `activeRecordIndex`.
- [ ] Unsupported data is reported as a warning or manual-review value instead of silently omitted.

**Tests:**

- Unit: test constants, fields, system values, usage, COLOR, and basic DSPATR mapping.
- Immutability: clone `doc.toJSON()` before the adapter call and compare it with `doc.toJSON()` after the adapter call.
- Fixture: run the adapter against the SIGNON fixture and assert the visual item count.
- Regression: run the V2.1-0A commands without changing their expected results.

**Pass condition:**

The adapter produces the expected visual model, and the document snapshot before and after the adapter call is identical.

**Failure condition:**

The adapter mutates the document, changes an existing test result, loses a supported visual item, or hides unsupported data without a report value.

**Evidence:**

Store the unit test result and the document snapshot comparison in the ticket completion report.

**Non-goals:**

Do not implement Semantic IR. Do not implement AID, CHCCTL, SFL runtime, business workflow, Spring Boot, or production data binding.

**Risk notes:**

The adapter must remain separate from the faithful preview so that a conversion rule cannot alter the existing Canvas or React preview.

**Status:** Completed.

---

# V2.1-0C — Show the Modern React converted pane

**Plan source:** `updating_plan_v2.1.md` Sections 1, 4, 8, 24.5

**What to build:**

Add a feature-controlled converted pane that shows the SIGNON fixture with Material UI components, the target design tokens, and a 12-column layout. Keep the Canvas and React faithful preview visible and unchanged because this ticket adds a new presentation rather than replacing an existing presentation.

**Blocked by:**

V2.1-0B — the pane must consume the read-only visual model because it must not read or mutate the document with its own conversion rules.

**Decision contract:**

- Use the target design tokens from `contract/target_design.md`.
- Use `#0F3460` as the primary accent.
- Use a 16px base font.
- Use the selected single font family.
- Use a 12-column target layout.
- Keep the converted pane separate from the 5250 faithful preview.
- Keep the feature behind a feature flag until the integration gate passes.

**Necessary conditions:**

- V2.1-0B returns a valid visual model.
- The target design token file exists.
- MUI dependencies are available in the converted UI package.
- V2.1-0A remains green.

**Acceptance criteria:**

- [ ] The user can open the converted pane.
- [ ] The converted pane shows the SIGNON constant items.
- [ ] The converted pane shows the SIGNON field items.
- [ ] The converted pane shows system values when the fixture contains them.
- [ ] The converted fields use a 12-column layout.
- [ ] The converted pane uses the target design tokens.
- [ ] The Canvas remains visible and unchanged.
- [ ] The React faithful preview remains visible and unchanged.
- [ ] The feature flag can disable the converted pane without affecting the existing application.
- [ ] Unsupported visual data shows an explicit status instead of executable behavior.

**Tests:**

- Component: test that the visual model produces the expected converted components.
- Component: test the 12-column span for representative field lengths.
- Component: test the design token application for primary color, base font, and spacing.
- Browser: use Playwright to open the converted pane and assert that the SIGNON fields and constants are visible.
- Regression: run the existing Canvas, React faithful preview, Inspector, and source-sync tests.

**Pass condition:**

The converted pane shows the SIGNON fixture with the target tokens and 12-column layout, and all existing regression tests pass.

**Failure condition:**

The converted pane replaces or changes an existing preview, the feature flag cannot disable it, or any regression test fails.

**Evidence:**

Record the Playwright result, screenshot path, build result, and regression command output.

**Non-goals:**

Do not implement business transactions, Spring Boot runtime, production export, automatic OPTION/FUNCTION actions, or a Node conversion service.

**Risk notes:**

Material UI styles must be scoped to the converted pane because global MUI styles can alter the existing 98.css and faithful preview.

**Status:** Completed.

---

# V2.1-0D — Prove first-slice integration safety

**Plan source:** `updating_plan_v2.1.md` Sections 20.4, 20.5, and 24.6–24.8

**What to build:**

Add the final integration checks for the first visible Modern React slice. Prove that the converted pane shows the modern result and does not change the existing document, preview, selection, or source synchronization behavior.

**Blocked by:**

V2.1-0C — the converted pane must exist before browser integration can test it.

**Decision contract:**

- Treat the Converted pane as read-only visual output.
- Keep the Canvas and React faithful preview contracts unchanged.
- Keep source synchronization one-way into the React code view.
- Do not create a DSPF source → React code → DSPF source loop.

**Necessary conditions:**

- V2.1-0C is complete.
- The baseline commands from V2.1-0A are available.
- The SIGNON fixture is available.

**Acceptance criteria:**

- [ ] Playwright confirms that the Canvas still displays.
- [ ] Playwright confirms that the React faithful preview still displays.
- [ ] Playwright confirms that the converted pane displays.
- [ ] Playwright confirms that the converted pane uses 12-column layout.
- [ ] Playwright confirms that opening the converted pane does not change `activeRecordIndex`.
- [ ] Playwright confirms that selection remains functional.
- [ ] Playwright confirms that source synchronization remains functional.
- [ ] The document snapshot before and after converted pane usage is identical.
- [ ] The complete existing test suite remains green.

**Tests:**

- Integration: load the SIGNON fixture and compare document snapshots before and after opening the converted pane.
- Browser: run the complete converted-pane Playwright flow.
- Regression: run the complete Vitest suite, complete Playwright suite, build, round-trip checks, and faithful parity checks.
- Failure path: disable the converted feature flag and confirm that the original application still works.

**Pass condition:**

All acceptance criteria have evidence, all required tests pass, and the document snapshot remains unchanged.

**Failure condition:**

Any existing preview, source-sync, selection, round-trip, parity, build, or test result changes unexpectedly.

**Evidence:**

Record the final command output, Playwright report path, screenshot path, and document snapshot comparison path.

**Non-goals:**

Do not start Semantic IR, identity graph, capability matrix, Spring Boot runtime, production Node service, or banking approval workflow in this ticket.

**Risk notes:**

This ticket is the release gate for the first visible Modern React slice. Later conversion work must remain blocked until this ticket passes.

**Status:** Completed.

---

## Dependency graph

```text
V2.1-0A Legacy baseline
    ↓
V2.1-0B Read-only visual conversion adapter
    ↓
V2.1-0C Modern MUI converted pane
    ↓
V2.1-0D Playwright integration safety gate
```

## Original owner approval questions

The owner authorized execution without another approval round. The questions below remain as design notes for future ticket refinement.

1. Is the four-ticket granularity correct?
2. Do the blocking edges describe real prerequisites?
3. Should the SIGNON fixture remain the first visual demo?
4. Should the converted pane use a feature flag during the first release?
5. Should V2.1-0D block Semantic IR work until the complete regression suite passes?

**Final status:** Completed — all four tickets executed and verified.

## Execution record

The owner authorized execution without another approval round. The four first-slice tickets are complete.

### V2.1-0A

**Status:** Completed.

**Evidence:** `npm run build` succeeded. `npx vitest run` passed 15 test files and 106 tests. `npx playwright test` passed 20 tests before the converted pane was added.

### V2.1-0B

**Status:** Completed.

**Evidence:** `src/conversion/visualModel.js` provides a read-only adapter. `react-app/src/conversion/__tests__/visualModel.test.js` passed 2 tests. The tests compare `doc.toJSON()` before and after adapter execution.

### V2.1-0C

**Status:** Completed.

**Evidence:** `react-app/src/converted/ConvertedPane.jsx` provides the feature-controlled MUI pane. `react-app/src/converted/convertedTheme.js` provides the scoped theme. `npm run build` succeeded. The converted-pane Playwright test passed 2 tests.

### V2.1-0D

**Status:** Completed.

**Evidence:** The final `npx vitest run` passed 16 test files and 108 tests. The final `npx playwright test --reporter=list` passed 22 tests. The final `npm run build` succeeded.

### Integration correction

The first full Playwright audit found that the additional 430px pane made the default compact workspace too narrow for the faithful Canvas parity calculation. The converted pane now hides below 1450px viewport width because the faithful Canvas must retain measurable geometry. The converted pane remains visible in the 1600px Modern React audit viewport.

### Final acceptance

```text
Modern Converted pane shows the SIGNON fixture
Converted fields use the MUI token system
Converted layout exposes the 12-column contract
The document snapshot remains unchanged when the pane toggles
108 Vitest tests pass
22 Playwright tests pass
vite build succeeds
Existing Canvas and faithful React parity pass
```

**Final status:** Completed. Evidence is recorded above because the ticket document now describes the executed result instead of a draft-only breakdown.

## V2.1-0E — Improve preview workspace presentation

**Plan source:** `updating_plan_v2.1.md` Section 24 and the Playwright screenshot review.

**What to build:**

Allow the user to hide and show the faithful React Preview from the toolbar. Preserve the Canvas and Modern React converted pane because the user can focus on one visual result when the workspace is compact.

**Issue found:**

The Playwright screenshot at `react-app/e2e/workspace.png` showed that Palette, Canvas, React Preview, Inspector, Converted pane, and Source compete for horizontal space. The faithful React Preview became difficult to read. The first full audit also showed that the additional converted pane made the compact Canvas geometry too narrow. The converted pane hides below 1450px because the faithful Canvas must retain measurable geometry.

**Blocked by:**

V2.1-0D — the existing preview and parity contracts must pass before the workspace presentation changes.

**Necessary conditions:**

- V2.1-0D is complete.
- The toolbar contains a control that remains available when the faithful preview is hidden.
- The hide operation does not write to `DspfDocument`.

**Acceptance criteria:**

- [x] The faithful React Preview is visible by default at a wide viewport.
- [x] The user can click `Hide React` to hide the faithful React Preview.
- [x] The user can click `Show React` to restore the faithful React Preview.
- [x] The Canvas remains visible while the faithful React Preview is hidden.
- [x] The Modern React converted pane remains visible at the wide audit viewport.
- [x] The document snapshot before and after hide/show is identical.
- [x] At compact widths, the converted pane hides instead of reducing Canvas geometry to an invalid size.

**Tests:**

- Playwright: `e2e/preview-visibility.spec.js` proves hide, show, Canvas visibility, converted pane visibility, and document immutability.
- Playwright: `e2e/parity.spec.js` proves that compact workspace geometry remains finite.
- Regression: run the complete Playwright suite with one worker because the MUI bundle can exceed the available parallel browser resource budget.
- Build: run `npm run build` and record the result.

**Pass condition:**

The hide/show flow passes, the document remains unchanged, the full Playwright audit passes, and the production build succeeds.

**Failure condition:**

The faithful preview cannot be restored, the Canvas geometry becomes invalid, the converted pane changes the document, or any existing parity test fails.

**Evidence:**

The screenshot was written to `react-app/e2e/workspace.png`. The final single-worker audit passed 23 Playwright tests. The final single-worker Vitest run passed 16 test files and 108 tests. `npm run build` succeeded.

**Non-goals:**

Do not change the faithful React rendering semantics. Do not replace the faithful preview with the Modern React converted pane. Do not add zoom in this ticket.

**Status:** Completed.

## Presentation issue decision

The screenshot issue is a workspace presentation issue, not a failed conversion contract. Keep the faithful preview logic unchanged. Use the toolbar visibility control for compact workspaces, and use the converted pane at the wide audit viewport. Add a separate zoom ticket only if the user requires magnification after the hide/show control is reviewed.

## V2.1-0F — Correct modern source mapping and converted pane resize

**Plan source:** `updating_plan_v2.1.md` Section 24 and the Modern React screenshot review.

**Issue found:**

The first visual spike placed the DSPF source column directly into the 12-column target grid. This caused source columns above 12 to clamp to the last target column. The converted pane also had a fixed width and no left splitter. The result did not show a complete or readable modern layout.

**What to build:**

Map the source column and source length to a target 12-column position. Add a left splitter to the converted pane so a left drag increases the Modern React pane and reduces the flexible Canvas width.

**Blocked by:**

V2.1-0E — the workspace must have a safe visibility control before the converted pane receives another layout control.

**Acceptance criteria:**

- [x] Source column 3 in an 80-column document maps to target column 1.
- [x] A source field with length 40 in an 80-column document maps to span 6.
- [x] The visual adapter exposes `targetCol` separately from source `col`.
- [x] The converted pane has a visible `converted-resize-handle` at the wide audit viewport.
- [x] Dragging the converted splitter left increases the converted pane width.
- [x] Dragging the converted splitter left reduces the Canvas width.
- [x] The resize operation does not mutate `DspfDocument`.
- [x] The 5250 faithful preview remains separate from the modern layout.

**Tests:**

- Unit: `react-app/src/conversion/__tests__/visualModel.test.js` tests source column mapping and document immutability.
- Browser: `react-app/e2e/converted-pane.spec.js` tests the converted pane, grid contract, toggle, and left resize.
- Regression: run `npx vitest run --pool=threads --maxWorkers=1`.
- E2E audit: run `npx playwright test --workers=1 --reporter=list`.
- Build: run `npm run build`.

**Pass condition:**

The source mapping test passes, the converted pane grows left, the Canvas reduces width, the document remains unchanged, and the full regression suite passes.

**Failure condition:**

The source column is used as a raw target column, the splitter does not change pane width, the Canvas becomes invalid, or any legacy parity test fails.

**Evidence:**

The adapter test passed 2 tests. The final Vitest run passed 16 files and 108 tests. The final Playwright audit passed 24 tests with one worker. The final Vite build succeeded.

**Non-goals:**

Do not claim that this ticket completes Semantic IR, SFL runtime semantics, OPTION/FUNCTION action conversion, or full business layout conversion. This ticket corrects the first visual mapping and resize behavior only.

**Status:** Completed.

## Updated execution chain

```text
V2.1-0A Legacy baseline
    ↓
V2.1-0B Read-only visual conversion adapter
    ↓
V2.1-0C Modern MUI converted pane
    ↓
V2.1-0D Playwright integration safety gate
    ↓
V2.1-0E Preview hide/show and compact workspace protection
    ↓
V2.1-0F Source-to-12-grid mapping and converted pane resize
```

**Final status:** Completed. The Modern React pane is now resizable from its left edge, and the source column is no longer used as a raw 12-grid column.

## V2.1-1A — Define the read-only DspfSemanticIR contract

**Plan source:** `updating_plan_v2.1.md` Sections 5, 15, 20, and 21.

**What to build:**

Define a versioned read-only semantic IR that describes DSPF display semantics without replacing `DspfDocument` or mutating legacy data.

**Blocked by:**

V2.1-0F — the first visual conversion boundary and regression protection must be complete.

**Acceptance criteria:**

- [ ] The IR schema has a version.
- [ ] The IR includes source revision and display profile fields.
- [ ] The IR includes record formats and record relations.
- [ ] The IR includes fields, constants, references, indicators, AIDs, windows, subfiles, menus, messages, and capabilities.
- [ ] The IR builder returns new objects.
- [ ] The IR builder leaves `DspfDocument.toJSON()` unchanged.
- [ ] The IR distinguishes unknown, unsupported, and manual-review semantics.

**Tests:**

- Schema test: parse a 24x80 fixture and assert the required IR groups.
- Schema test: parse a 27x132 fixture and assert the display profile.
- Immutability test: compare document snapshots before and after IR construction.
- Regression test: run the existing 108 Vitest tests.

**Pass condition:**

The versioned IR describes the required DSPF groups and the legacy document remains identical.

**Failure condition:**

The IR mutates the document, omits a required semantic group, or treats an unknown value as a successful conversion.

**Status:** Draft — blocked by V2.1-0F.

## V2.1-1B — Resolve DSPSIZ display profiles

**Plan source:** `updating_plan_v2.1.md` Sections 2, 7, 15, and 20.

**What to build:**

Resolve the source display profile before the semantic layout mapper calculates any target grid position.

**Blocked by:**

V2.1-1A — the display profile must be stored in the semantic IR.

**Acceptance criteria:**

- [ ] The resolver identifies 24x80.
- [ ] The resolver identifies 27x132.
- [ ] The resolver records the source of the profile decision.
- [ ] The resolver handles DSPSIZ profile keywords without relying on the UI file-open flow.
- [ ] The resolver reports an unknown profile as manual-review instead of silently using 24x80.

**Tests:**

- Unit test: 24x80 and 27x132 profile fixtures.
- Edge test: missing DSPSIZ and symbolic DSPSIZ values.
- Integration test: conversion core receives the resolved column count.
- Regression test: faithful Canvas model selection remains unchanged.

**Pass condition:**

Every conversion has an explicit source column count or a manual-review status.

**Failure condition:**

The converter silently uses 80 columns for a 132-column source.

**Status:** Draft — blocked by V2.1-1A.

## V2.1-1C — Build qualified identity and reference graph

**Plan source:** `updating_plan_v2.1.md` Sections 6, 13, 18, and 20.

**What to build:**

Create qualified source identities and a reference graph for fields, records, windows, SFL templates, REFFLD, CHCCTL, and menu relations.

**Blocked by:**

V2.1-1A — identity belongs in the semantic IR.

**Acceptance criteria:**

- [ ] Duplicate field names in different records receive different source identities.
- [ ] SFL template occurrences receive distinct identities.
- [ ] WINDOW child and owner paths remain traceable.
- [ ] REFFLD references are represented as graph edges.
- [ ] CHCCTL references are represented as graph edges.
- [ ] Binding collisions produce an explicit error or manual-review result.
- [ ] DOM id is separate from source identity and business identity.

**Tests:**

- Unit test: duplicate field names across records.
- Fixture test: SFL and SFLCTL relation.
- Fixture test: WINDOW relation.
- Edge test: REFFLD with unknown PF/DD source.
- Collision test: two source occurrences that produce the same proposed DOM id.

**Pass condition:**

Every converted object has a qualified source identity and all known references resolve or report a review state.

**Failure condition:**

The converter uses a bare field name as a global key or silently overwrites a collision.

**Status:** Draft — blocked by V2.1-1A.

## V2.1-1D — Classify conversion capabilities and review states

**Plan source:** `updating_plan_v2.1.md` Sections 8, 14, 15, and 19.

**What to build:**

Classify every source object and action as `converted`, `converted-with-warning`, `manual-review`, `unsupported`, or `error`.

**Blocked by:**

V2.1-1B and V2.1-1C — capability decisions need a known display profile and source reference graph.

**Acceptance criteria:**

- [ ] CHOICE, CHCCTL, CA, CF, ENTER, MNUBARCHC, PULLDOWN, and PSHBTNCHC have capability entries.
- [ ] SFL runtime limitations produce review states.
- [ ] REFFLD with unresolved source data produces review state.
- [ ] Unsupported actions do not generate executable handlers.
- [ ] Every review state includes a reason and source identity.

**Tests:**

- Capability matrix test using CHOICE and MENU_BAR fixtures.
- Action test using push-button and CA/CF fixtures.
- Unsupported semantics test.
- Report test that checks source identity and reason fields.

**Pass condition:**

Every source object has an explicit conversion status and reason.

**Failure condition:**

The converter creates an executable action for an unresolved or unsupported semantic.

**Status:** Draft — blocked by V2.1-1B and V2.1-1C.

## V2.1-1E — Build profile-based semantic layout mapper

**Plan source:** `updating_plan_v2.1.md` Sections 7, 15, 20, and 21.

**What to build:**

Map source row, source column, source length, window offset, and display profile into a target 12-column layout while preserving source traceability.

**Blocked by:**

V2.1-1B and V2.1-1C — layout requires the source profile and qualified source identity.

**Acceptance criteria:**

- [ ] The mapper uses 80 for a 24x80 source.
- [ ] The mapper uses 132 for a 27x132 source.
- [ ] The mapper preserves source row and source column.
- [ ] The mapper returns target row, target column, planned span, and actual span.
- [ ] The mapper reports overlap, crop, reflow, and overflow.
- [ ] The mapper produces deterministic output for the same input and profile.
- [ ] The mapper does not change the source document.

**Tests:**

- Table-driven test for 24x80 lengths and columns.
- Table-driven test for 27x132 lengths and columns.
- Edge test for column 1, last column, overlong fields, overlap, and same-row overflow.
- WINDOW offset test.
- Snapshot test for traceability and lossiness status.

**Pass condition:**

The same semantic input produces the same target layout and every lossy change has a report entry.

**Failure condition:**

The mapper drops source geometry, produces non-deterministic packing, or hides overflow.

**Status:** Draft — blocked by V2.1-1B and V2.1-1C.

## V2.1-1F — Show the complete semantic converted screen

**Plan source:** `updating_plan_v2.1.md` Sections 15, 16, 19, and 24.

**What to build:**

Show the complete active record from the semantic IR in the Modern React pane. Display source traceability, layout lossiness, manual-review states, and unsupported objects without claiming full runtime conversion.

**Blocked by:**

V2.1-1D and V2.1-1E — the pane must consume classified semantics and the final profile-based layout.

**Acceptance criteria:**

- [ ] The complete active record appears in the converted pane.
- [ ] Labels, constants, fields, and system values preserve their source order.
- [ ] Source row, source column, and target span are available for inspection.
- [ ] Overlap, crop, reflow, and unsupported states are visible.
- [ ] The pane keeps record, WINDOW, and SFL relationships visible.
- [ ] The pane does not create executable business actions for unresolved semantics.
- [ ] The document snapshot remains unchanged.

**Tests:**

- Component test for a complete SIGNON record.
- Integration test for WINDOW and SFL fixtures.
- Playwright test for traceability and manual-review states.
- Regression test for Canvas and React faithful preview parity.
- Full test, build, and audit commands.

**Pass condition:**

The converted pane shows the complete classified screen and every lossiness or unsupported item has visible evidence.

**Failure condition:**

An active record item disappears without a report state, a source relation is lost, or existing preview behavior changes.

**Status:** Draft — blocked by V2.1-1D and V2.1-1E.

## Semantic layout dependency graph

```text
V2.1-0F source mapping and converted resize
    ↓
V2.1-1A DspfSemanticIR
    ├── V2.1-1B DSPSIZ profiles
    └── V2.1-1C identity and references
             ↓             ↓
          V2.1-1D capability matrix
          V2.1-1E semantic layout mapper
                    ↓
                V2.1-1F complete semantic screen
```

## Semantic layout owner questions

1. Is the seven-ticket decomposition correct?
2. Must SFL runtime state be rendered in V2.1-1F, or must V2.1-1F show only the runtime contract and review state?
3. Should a source row with total target span greater than 12 wrap deterministically, or stop with manual review?
4. Should unresolved REFFLD stop the whole record, or mark only the affected field for manual review?
5. Should V2.1-1G support only explicit external runtime assignment and display-workflow patterns in the first release?

## V2.1-1G — Define the external runtime binding contract

**Plan source:** `plan/plan_v2/plan_v2.1_ticket_comment.md` feedback item 3 and `updating_plan_v2.1.md` Sections 15, 18, and 25.

**What to build:**

Define a generic binding contract for runtime source code that supplies DSPF field values, control values, indicators, messages, and display-workflow hints. The first implementation can use RPGLE as one input example, but the contract must not depend on one program name, record name, or syntax pattern.

**Blocked by:**

V2.1-1A and V2.1-1C — the binding contract needs Semantic IR fields and qualified source references.

**Input examples:**

```text
INPUT/IBM-i-RPG-Free-CLP-Code/Z_Exp1/B2.DSPF
INPUT/IBM-i-RPG-Free-CLP-Code/Z_Exp1/B2R.RPGLE
```

These files are examples for the generic contract. They are not the contract scope.

**Acceptance criteria:**

- [ ] The contract identifies the display source and runtime source separately.
- [ ] The contract maps runtime assignments to qualified DSPF field identities.
- [ ] The contract distinguishes display values, hidden control values, indicators, messages, and workflow hints.
- [ ] The contract represents display operations such as `EXFMT` without claiming that the display file defines business workflow.
- [ ] The contract supports external runtime source types through an adapter boundary.
- [ ] Unknown runtime syntax receives `manual-review` instead of false converted status.
- [ ] The binding result includes source path, source location when available, target identity, value role, and status.
- [ ] The binding adapter does not mutate `DspfDocument`.

**Tests:**

- Contract test: validate a generic display binding example against the contract shape.
- Fixture test: use B2.DSPF/B2R.RPGLE as one example of field values, control values, and display workflow.
- Role test: distinguish visible field, hidden control field, indicator, message, and workflow hint.
- Unknown syntax test: produce a manual-review diagnostic.
- Immutability test: compare `DspfDocument.toJSON()` before and after binding.
- Regression test: run the existing parser, writer, Canvas, faithful preview, and source-sync tests.

**Pass condition:**

The generic contract maps known runtime values to qualified source identities and reports unknown runtime behavior without changing the existing document.

**Failure condition:**

The contract names one example program as a required implementation, treats a runtime value as static DSPF design data, loses a control field, or changes the existing document.

**Non-goals:**

Do not implement a complete RPGLE compiler. Do not execute external runtime source. Do not decide banking permissions or business transaction results.

**Status:** Draft — blocked by V2.1-1A and V2.1-1C.
## Downstream ticket designs

The following tickets complete the plan coverage after the first visual slice. Each ticket must use the contract references at the top of this file and must include acceptance and tests before implementation starts.

### V2.1-1H — Resolve external PF/DD field references

**Blocked by:** V2.1-1A and V2.1-1C.

**What to build:** Resolve `REFFLD` references from available PF/DD sources. Return resolved type, length, decimals, validation, source location, and reference status.

**Acceptance:** Existing PF/DD resolves without warning. Missing PF/DD returns `manual-review`. Multiple matches return a conflict diagnostic. The document snapshot remains unchanged.

**Tests:** PF/DD fixture test, missing-source test, multiple-match test, immutability test, and full legacy regression.

### V2.1-1I — Resolve DSPF record-format relations

**Blocked by:** V2.1-1A and V2.1-1C.

**What to build:** Resolve `SFLCTL → SFL`, `WINDOW → child`, `MNUBAR → PULLDOWN`, message records, and owner relations.

**Acceptance:** Each known relation has a source and target identity. An unresolved relation receives `manual-review`. A record is not silently converted into a route.

**Tests:** `WCONHDRD.DSPF`, `SCROLL_BAR.DSPF`, `MENU_BAR.DSPF`, WINDOW relation, SFL relation, and unknown relation tests.

### V2.1-1J — Define the first-release SFL runtime contract

**Blocked by:** V2.1-1I.

**What to build:** Describe SFL page, RRN, scroll, indicator, message subfile, and runtime row state without claiming full IBM i execution.

**Acceptance:** `SFLPAG`, `SFLSIZ`, `SFLEND`, `SFLDSP`, `SFLDSPCTL`, `SFLCLR`, `SFLNXTCHG`, `SFLMSGRCD`, and RRN have defined states. Missing runtime rows return `contract-only` or `manual-review`.

**Tests:** SFL fixture, message subfile fixture, variable page-size fixture, indicator fixture, and schema tests.

### V2.1-1K — Normalize DSPF indicator semantics

**Blocked by:** V2.1-1A and V2.1-1I.

**What to build:** Preserve indicator number, polarity, scope, `INDARA`, display state, enabled state, and action state as separate values.

**Acceptance:** Item, keyword, and record indicator scopes remain distinct. `Nxx` polarity remains distinct from `xx`. Unknown scope receives `manual-review`.

**Tests:** indicator polarity matrix, conditioned keyword test, `INDARA` test, SFL indicator test, and immutability test.

### V2.1-1L — Build the OPTION/FUNCTION action graph

**Blocked by:** V2.1-1D, V2.1-1I, and V2.1-1K.

**What to build:** Model CHOICE, CHCCTL, PSHBTNCHC, CA, CF, ENTER, menu, row scope, page scope, permission, destructive state, confirmation, and idempotency.

**Acceptance:** Every action has a source identity and AID or receives `manual-review`. Unsupported actions do not generate executable handlers.

**Tests:** CHOICE, MENU_BAR, push-button, CA/CF, destructive action, and unknown target tests.

### V2.1-2A — Generate the source-to-target Mapping Contract

**Blocked by:** V2.1-1D, V2.1-1E, V2.1-1G, V2.1-1H, V2.1-1J, and V2.1-1L.

**What to build:** Generate versioned source-to-target mappings for every converted object.

**Acceptance:** Each mapping contains source identity, target component, source geometry, target geometry, binding key, DOM id, status, lossiness, and traceability.

**Tests:** Mapping schema test, duplicate identity test, 24x80/27x132 mapping test, lossiness test, and deterministic output test.

### V2.1-2B — Generate standalone React output

**Blocked by:** V2.1-2A.

**What to build:** Generate an independent React/Vite app from the Mapping Contract.

**Acceptance:** The generated app builds outside the designer. The app includes MUI theme, route manifest, binding map, diagnostics, traceability, and conversion report. The app does not import mutable designer code.

**Tests:** generated file test, clean-install build, generated app unit tests, and manifest hash test.

### V2.1-2C — Start generated frontend and runtime API

**Blocked by:** V2.1-2B.

**What to build:** Start the generated frontend and a local runtime API through explicit `local` or `http` mode.

**Acceptance:** The app loads from a clean server. The API base URL is configurable. Local mode is explicit. HTTP errors remain visible.

**Tests:** clean server startup, environment configuration, local mode, HTTP mode, and API error tests.

### V2.1-2D — Audit generated React output in a browser

**Blocked by:** V2.1-2C.

**What to build:** Run the generated app through a real browser audit.

**Acceptance:** The browser shows the complete mapped screen, field bindings, route, diagnostics, review states, and responsive layout. The browser audit records screenshots and console/network results.

**Tests:** Playwright at 24x80, 27x132, compact, wide, 100% zoom, 200% zoom, error, forbidden, not-found, and manual-review states.

### V2.1-2E — Approve a conversion revision before deployment

**Blocked by:** V2.1-2D.

**What to build:** Add conversion review, approval, rejection, override, supersession, maker-checker, SoD, and audit state.

**Acceptance:** The same actor cannot approve their own conversion. Any source revision change invalidates approval. Unsupported output cannot deploy.

**Tests:** approval state machine, role separation, revision invalidation, artifact hash, audit append-only, and forbidden deployment tests.

### V2.1-2F — Add optional conversion service metadata

**Blocked by:** V2.1-2E.

**What to build:** Add optional Node and SQLite metadata only for multi-user, batch, retention, or review needs.

**Acceptance:** The service calls shared conversion core. SQLite stores revisions and metadata only. Concurrent revisions remain isolated.

**Tests:** API contract, revision isolation, artifact retention, restart recovery, and no-business-data-in-metadata tests.

### V2.1-2G — Integrate generated React with Spring Boot

**Blocked by:** V2.1-2D and V2.1-2E.

**What to build:** Integrate the generated React app with the Spring Boot runtime contract.

**Acceptance:** Screen, transaction, session, AID, field validation, idempotency, correlation ID, and defined error responses work through the OpenAPI contract.

**Tests:** OpenAPI contract tests, session tests, 401/403/409/422/440 tests, idempotency test, and browser transaction test.

## Complete plan-to-ticket mapping

| Plan area | Ticket coverage |
|---|---|
| Regression firewall and visual slice | V2.1-0A to V2.1-0F |
| Semantic IR | V2.1-1A |
| DSPSIZ profile | V2.1-1B |
| Identity and references | V2.1-1C, V2.1-1H, V2.1-1I |
| Capability classification | V2.1-1D, V2.1-1L |
| Semantic layout | V2.1-1E, V2.1-1J, V2.1-1K |
| External runtime binding | V2.1-1G |
| Complete converted screen | V2.1-1F |
| Mapping Contract | V2.1-2A |
| Generated React output | V2.1-2B |
| Generated server and runtime | V2.1-2C, V2.1-2G |
| Browser audit | V2.1-2D |
| Governance | V2.1-2E |
| Optional Node/SQLite | V2.1-2F |

## Ticket status

```text
V2.1-0A to V2.1-0F: Completed
V2.1-1A to V2.1-2G: Designed, not implemented
Next task: V2.1-1A
```

```text
V2.1-1A DspfSemanticIR
    ├── V2.1-1B DSPSIZ profiles
    └── V2.1-1C identity and references
             ├── V2.1-1D capability matrix
             └── V2.1-1G external runtime binding
                    ↓
                 V2.1-1F complete semantic screen
```

**Reason:** The complete Modern React screen must combine static DSPF layout, external source bindings, and runtime display hints. The screen must not show a runtime value as static design data without a traceable source.