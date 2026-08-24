# Contract Decision Log

Each decision records conflict or scope change, selection, reason, and verification. Superseded decisions stay listed with their replacement. Old contract files remain retrievable in git history.

## D-01 OpenAPI base path

**Decision:** Keep `servers.url: /api`. Define paths without the `/api` prefix.
**Reason:** Client and server construct one stable URL.
**Verification:** Parse `openapi.yaml`; final URL of a path = server URL + path.

## D-02 Design token source

**Decision:** `contract/target_design.md` is the only token source.
**Reason:** Converted pane and generated app must consume one value set.

## D-03 DOM identity format

**Decision:** Use `Z-XMG3tX` form for DOM ids. Keep `sourceIdentity`, `runtimeBindingKey`, and `businessName` separate.
**Reason:** Hyphen form is safe for HTML, CSS, and test selectors; the DOM id is not a business key.

## D-04 Semantic schema location

**Decision:** `contract/schemas/` owns semantic schemas. Plan-directory copies are design records only.
**Reason:** One schema location prevents divergence.

## D-05 Authentication contract — DEFERRED by D-11

Original decision: Spring Security session cookie + CSRF header for state-changing requests. With the 2026-08 scope reduction there is no production runtime to authenticate. The decision text is preserved here for reuse when a production backend returns.

## D-06 Frontend schema ownership

**Decision:** Component, field-binding, and route-manifest schemas live in `contract/schemas/`. Their prose policies merged into `03-generated-react-app.md`.
**Reason:** Generated React consumers need machine-readable contracts beside the other projections.

## D-07 Normative source layering

**Decision:** Separate layers: schema → shape; policy → decision and release meaning; rationale → architecture explanation; README → SSOT index.
**Reason:** Separation reduces duplicate definitions and eases review.

## D-08 Runtime binding layering

**Decision:** `runtime-binding.schema.json` is the generic base; `rpg-display-binding.schema.json` extends it for RPG-specific fields.
**Reason:** One reference program must not become a product-specific design.

## D-09 SFL first-release boundary

**Decision:** Describe SFL runtime data; return `manual-review` when rows/indicators are unavailable. Do not claim full SFL execution.
**Reason:** Static DSPF data cannot prove runtime page, row, scroll, or indicator state.

## D-10 Markdown SSOT

**Decision:** Markdown contract files are the single source of truth. JSON schemas and OpenAPI files are derived projections. If a derived file conflicts with Markdown: stop implementation, fix the Markdown first, then regenerate the projection and record evidence.
**Reason:** One location must own meaning, defaults, ownership, and boundaries.

## D-11 Scope reduction: frontend-first, seed-data demo backend

**Date:** 2026-08-24. **Type:** Owner decision.

**Change:** The product of this repository is frontend conversion. A generated Spring Boot server exists only as a seed-data demo fixture server (`04-seed-backend.md`). Production concerns are out of scope until re-scoped:

```text
session / CSRF / authentication / authorization
idempotency and transaction authority
audit trails and append-only evidence
approval, maker-checker, deployment gates as product features
```

**Reason:** Full runtime governance was specified before any end-to-end frontend flow worked. Seed data lets generated screens show effects now; governance can be layered later from `openapi.yaml`.

**Consequences:**

- `01-backend-interfaces.md` and `02-backend-file-template.md` (conversion API, runtime security classes) are removed; their reusable shapes moved into `04-seed-backend.md` and `openapi.yaml`.
- `security.schema.json` is deleted. Security-related semantics become `manual-review` diagnostics until a real backend exists.
- Gate "banking readiness" is retired; release gates are L/S/G in `01-scope-and-sources.md`.
- The demo server labels every response `mode: "seed-demo"`. Local demos must not impersonate a production backend.

## D-12 Contract set consolidation

**Date:** 2026-08-24. **Type:** Owner-approved restructuring.

**Change:** The ten numbered documents plus `frontend/` policies merged into four topic documents:

```text
00-system-design            → 01-scope-and-sources
03-conversion-rules         → 02-conversion-core
semantic-layout-design      → 02-conversion-core
06-completeness-proof       → 02-conversion-core
04-frontend-design-system   → 03-generated-react-app
05-frontend-file-template   → 03-generated-react-app
09-preview-methodology      → 03-generated-react-app
frontend/*.md               → 03-generated-react-app
target-react-admin-components-used.md → condensed inventory in 03 (full table kept in references/react-admin)
07-conflict-decisions       → this log
08-rpg-to-react-system      → seed-extraction section of 04-seed-backend
01/02 backend documents     → superseded by 04-seed-backend (D-11)
```

**Rule going forward:** one new concern = one section in the matching document, or one new numbered document if no match exists. Never recreate parallel documents for the same concern.

## D-13 Test corpora designation

**Date:** 2026-08-24. **Type:** Owner decision.

`TESTS/`, `QDDSSRC/`, and `INPUT/` are reference applications used as test inputs: unit fixtures, Playwright loads, dependency-closure checks, and seed extraction trials. They contain zero runtime code references. Missing external members (for example `XAN4CDEM/CUSTS`) must surface as explicit diagnostics.

## D-14 Runtime binding repurposed

**Date:** 2026-08-24. **Type:** Owner decision.

RPG/RPGLE sources feed **seed extraction** (display values, indicators, messages, workflow hints → seed JSON), not live runtime binding and not business-logic migration. The adapter never executes external code. Original binding categories and statuses remain valid as extraction roles.

## D-15 OpenPencil adopted as the design-overlay tool

**Date:** 2026-08-24. **Type:** Owner decision.

**Change:** The embedded `open-pencil/` checkout (OpenPencil — MIT, Vue 3 + CanvasKit design editor with `.fig` IO, headless CLI, MCP server) is the approved tool for setting target-side layout, components, and templates.

**Selected level:** L1 file exchange through the CLI (`bun open-pencil tree/export --json` → `pnpm extract:overrides` → `design-overrides/layout-overrides.json` → mapping-contract overrides). L2 (MCP live service) deferred. L3 (embedding the editor in react-app) rejected for now — Vue SDK vs React 19 mismatch.

**Guardrails:**

- OpenPencil documents are a presentation overlay only; they never edit DSPF semantics and never replace `DspfDocument` or the Mapping Contract as sources of truth.
- Override nodes bind by name prefix `dspf:<sourceIdentity>`; overrides set target geometry/component only.
- Extraction output is deterministic, total (unknown nodes become diagnostics), and hashed into conversion receipts.
- Repo hygiene: `open-pencil/` is gitignored like `contract/target-react-admin/`; integration code calls its CLI or reads exported JSON, never imports its source.

**Verification:** Run `pnpm extract:overrides -- <exported.json>`, confirm deterministic output across two runs and that every override carries a resolvable `sourceIdentity` shape plus an allowed component name.

## D-16 Lifecycle adoption and evidence observability

**Date:** 2026-08-24. **Type:** Owner decision.

**Change:** The six-stage pipeline in `05-lifecycle.md` (source → edit → convert → generate → verify → deliver) is the official lifecycle. Two rules become binding:

1. **Verification ladder as release mechanism**: unit → component → build → browser (→ integration when a server exists). A stage may not claim completion from a lower level alone.
2. **Evidence observability**: ticket and gate evidence must point at user-observable behavior — rendered output, computed styles, HTTP responses, artifact hashes — never at the existence of internal functions or Node-side policy modules alone.

**Reason:** V3 review showed tickets marked complete while the generated product stayed empty; the drift came from accepting internal-module evidence. Hash-chained receipts make delivery claims auditable.

**Verification:** Every completed ticket's evidence section cites an observable artifact; receipts recompute their hash chain.

## D-17 CI adoption

**Date:** 2026-08-24. **Type:** Owner decision (direction recorded ahead of implementation).

**Change:** GitHub Actions runs the verification ladder on every push/PR to `master`: root vitest, react-app vitest, production build, Playwright (chromium). No deploy workflows until the seed server exists.

**Reason:** The ladder currently depends on manual discipline; automation converts it into a mechanism. Playwright needs a build first (`vite preview` serves `dist/`), so CI order is fixed: install → L1 → L2 → L3 → L4.

**Status:** Designed in `plan/plan_v4_lifecycle_tickets.md` (ticket L4-1B); implementation pending.

---
