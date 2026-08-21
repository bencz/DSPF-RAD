# System Architecture: Legacy Modernisation Platform (LegacyGraph)

Version 0.2 (draft) — 21 August 2026
This document is the complete, self-contained architecture reference. It supersedes and merges the earlier system-design draft, and adds the single-source-of-truth (SSoT) design. The PRD (legacy-modernisation-platform-prd.md) remains the source for product requirements and open product questions; this document is the source for how the system is built.

---

## 1. Overview

LegacyGraph converts IBM i RPG and COBOL codebases into a modern Java Spring Boot backend and a React and Vite frontend. It does this through an eight-stage pipeline, built on four design principles:

1. **Many language front-ends, one shared model.** RPG, COBOL, and any language added later all lower into one language-agnostic semantic intermediate representation (IR). Everything downstream of the IR is written once and never touches source-language syntax.
2. **One shared model, many possible outputs.** The same principle applies on the output side: one UI abstraction layer, many pluggable component-library adapters (Material UI, Ant Design, shadcn/ui, or others).
3. **Every artefact is inspectable, versioned, and status-tracked.** The AST, the IR, the code graph, the service specification, the mapping configuration, and the UI specification are each distinct, storable artefacts. A single-source-of-truth index (section 5) tracks the status of every source unit across all of them.
4. **Validation gates sit at every stage boundary.** An error introduced early must be caught before it silently propagates into generated code five stages later.

---

## 2. Full pipeline

```
Source ingestion
  -> Language front-ends (RPG adapter, COBOL adapter, + pluggable)
       [gate: parse-complete]
  -> Semantic IR (shared, language-agnostic)
  -> Code graph
       [gate: graph-complete]
  -> Service identification & spec generation
  -> Mapping configuration (engineer-editable)
       [gate: mapping-valid]
  -> UI abstraction layer + library adapters
  -> Code generation (Spring Boot backend + React/Vite frontend)
       [gate: build + behavioural equivalence]
```

The single-source-of-truth index (section 5) runs alongside every stage, recording status rather than sitting inline in the data flow.

---

## 3. Stage architecture

### 3.1 Source ingestion

- Accepts uploaded source member sets for Phase 0: RPG III, RPG IV (fixed and free-format), COBOL 85+, and DDS (display and physical/logical file definitions, since RPG and COBOL programs bind to DDS-defined files).
- Defined behind a `SourceProvider` interface with two implementations: `FileSetProvider` (Phase 0, an uploaded archive) and `IbmiConnectionProvider` (later, live source access over SSH or a database connection to QSYS source physical files). No stage past ingestion depends on which implementation supplied the source.
- Every parsed unit carries origin metadata: library, source file, member name, line range. This metadata travels through every later stage and is what makes traceability (section 3.8) and the SSoT index (section 5) possible.

### 3.2 Language front-ends

Each source language has its own adapter implementing two operations:

- `parse(source) -> LanguageAST`: uses an existing open-source parser where one exists (ProLeap or Koopa for COBOL, both ANTLR/BSD-based with AST and data/control-flow output), or a purpose-built ANTLR grammar where one does not. RPG currently has no mature open-source semantic parser; existing open-source RPG tooling (Code for IBM i, vscode-rpgle) covers editing, linting, and outline views, not a full AST with data-flow analysis, so this is treated as a specific engineering task rather than an assumed solved problem.
- `lower(LanguageAST) -> IR nodes`: converts the language-specific tree into the shared semantic IR (section 3.3).

A dialect-detection step runs before parsing and routes each source member to the correct adapter and dialect ruleset, since RPG II, RPG III, and RPG IV free-form need different lexing even though they lower into the same IR shape.

**Extensibility contract**: adding a new language requires only a new adapter (`parse` + `lower`), a type-normalisation table (section 3.3), and a conformance test suite (section 3.2.1). No change to any stage past the IR.

**3.2.1 Adapter conformance testing**: each adapter ships with a suite of known source snippets and their expected IR output, run in CI on every change. This is what guarantees that adapters stay interchangeable in practice, not just in principle.

**Validation gate — parse-complete**: any source member that fails to parse fully is reported by name. Partial or silently-dropped parses are not permitted to continue downstream.

### 3.3 Semantic IR

The shared, language-agnostic data model every adapter lowers into:

| Node type | Represents | Key fields |
|---|---|---|
| `Program` | A compilation unit (RPG or COBOL program) | name, origin, entry points |
| `Procedure` | A subprocedure, subroutine, or paragraph | name, parameters, parent program |
| `Call` | A program-to-program or procedure-to-procedure invocation | caller, callee, call kind (static/dynamic), parameters passed |
| `FileAccess` | A read, write, or update against a file | program, file, access mode, key fields used |
| `DataStructure` | A record format, data structure, or copybook-defined structure | name, fields, origin (DDS, copybook, inline) |
| `Field` | A single data item | name, type, length, precision, parent structure |
| `Parameter` | A value passed between procedures or programs | name, type, direction (in/out/inout) |

Every node carries a stable identifier, a back-reference to its originating source location, and an optional `extension` map for language-specific detail that does not generalise (embedded CICS or SQL blocks, RPG's program-cycle semantics). The core schema stays small; the extension map is the escape hatch so information is never silently dropped.

**Type normalisation** happens per adapter: COBOL `PIC` clauses and RPG data-structure types each map to one of a small set of canonical IR types (decimal with precision and scale, fixed-length string, variable-length string, date, time, indicator/boolean). Every stage past this point, including the mapping configuration (3.6), works only against these canonical types.

**Schema versioning**: the IR schema is versioned explicitly; each adapter declares which version it targets, so the schema can evolve without silently breaking adapters built against an earlier version.

### 3.4 Code graph - graphify (now now)

- A property graph projected directly from the IR: `Program`, `DataStructure`, and `Field` nodes become graph nodes; `Call` and `FileAccess` relationships become edges.
- Stored in a graph database (Neo4j Community Edition is a reasonable Phase 0 default) so service identification can run graph queries (connected-component analysis, shared-file clustering) instead of re-walking the IR.
- Exportable as JSON or a graph-database dump.

**Validation gate — graph-complete**: every `Call` must resolve to a known `Program` unless explicitly flagged dynamic; every `Field` referenced anywhere downstream must trace to a `DataStructure` in the graph. Unresolved references are reported, not dropped.

### 3.5 Service identification and specification generation

- Clusters the code graph (connected components weighted by shared file access and call density) to propose service boundaries.
- The engineer accepts, merges, splits, or manually redraws proposed boundaries.
- For each confirmed service, generates a data-model document (from the `DataStructure`/`Field` nodes in scope) and an operations document (from the `Procedure`/`Call` nodes in scope), in a structured format such as OpenAPI plus a companion data-model schema.

### 3.6 Mapping configuration

- One engineer-editable configuration object per service, keyed by IR field identifiers, not by generated code identifiers, so it survives regeneration.
- Defines target field name, target canonical type, and any conversion rule (packed decimal to a Java numeric type, legacy date formats to ISO 8601).
- Stored independently of generated code.

**Validation gate — mapping-valid**: every field required by the service specification must have a mapping entry; type and range compatibility is checked against sample data where available.

### 3.7 UI abstraction layer and library adapters

A specification layer between the service specification and the generated frontend, describing three things independently:

- **Layout**: pages, sections, and arrangement primitives (stack, grid, form, table, detail view), with spacing and breakpoints. The service specification suggests defaults (a one-to-many relationship suggests a list-plus-detail view); the engineer overrides these in a visual editor rather than hand-writing JSX.
- **Components**: abstract types (TextField, Select, DataTable, Button, Card), not tied to any library.
- **Data flow**: each component's binding to a specific service operation or field, plus the validation rules already defined in the mapping configuration (3.6), so the frontend's data model never diverges from the backend's.

**Library adapters** mirror the language-adapter pattern on the output side: each adapter maps abstract component types to a concrete library (Material UI, Ant Design, shadcn/ui, or a custom design system). Choosing a library means choosing an adapter, not regenerating the abstraction layer.

**Ownership tracking**: each component in the specification carries a flag showing whether it is generator-controlled or has been manually customised. Regeneration skips or merges around manually owned components. Without this, a manual layout tweak would be silently overwritten on the next regeneration.

### 3.8 Code generation

- **Backend**: for each confirmed service, generates a Spring Boot project (entities, repository layer, service layer, REST controllers) from the service specification and the mapping configuration. JHipster (Apache 2.0) is a reasonable base to adapt; Telosys is a lighter-weight alternative if JHipster's opinionated structure proves too heavy.
- **Frontend**: generates a React and Vite project from the UI abstraction layer, rendered through the selected library adapter.
- Every generated file carries a traceability comment linking back to the originating IR node, and through it, back to the original RPG or COBOL source location.

**Validation gate — build and behavioural equivalence**: generated backend and frontend must compile and lint clean. Separately, representative inputs are run through the original RPG or COBOL program and the generated service, and the outputs are diffed (a golden-file approach). This is the gate that checks against the mainframe as ground truth rather than against the platform's own model of the code, and is the most likely to catch what earlier stages cannot see.

---

## 4. Multi-language and multi-library extensibility

The same plugin boundary is used on both sides of the pipeline:

- **Input side**: a language adapter registry keyed by detected file type or dialect. Each entry supplies `parse()` and `lower()`. Adding a language means adding one registry entry; no change to the IR consumer, the graph builder, service identification, mapping, the UI layer, or code generation.
- **Output side**: a UI library adapter registry keyed by the engineer's selection. Each entry supplies a component-type mapping. Adding a library means adding one registry entry; no change to the UI abstraction schema or anything upstream of it.

If adding a language or a library ever requires touching a shared stage, the abstraction boundary has leaked and needs revisiting before the change ships.

---

## 5. Single source of truth (SSoT): the migration index

The IR is the source of truth for what a program *means*. It is not a source of truth for what has *happened* to that program as it moves through the pipeline. That is the job of the migration index: one authoritative record per source unit (a program, later a service), tracking status and artefact linkage across every stage.

### 5.1 Record schema

| Field | Purpose |
|---|---|
| `unit_id` | Stable identifier for the source unit |
| `origin` | Library, source file, member, source language (mirrors the IR's own origin metadata) |
| `ir_ref` | Pointer to this unit's current IR node(s) and IR schema version |
| `pipeline_stage` | Current stage reached: ingested, parsed, ir_lowered, graphed, service_assigned, spec_generated, mapped, ui_specified, generated, validated, approved_for_cutover |
| `gate_status` | Pass/fail/pending for each validation gate: parse_complete, graph_complete, mapping_valid, build_behavioural |
| `service_id` | Which identified service this unit belongs to, once assigned |
| `generated_artefacts` | Type (backend/frontend), path, and version for each generated file tied to this unit |
| `ownership_flags` | Which mapping entries or UI components have been manually overridden, so regeneration knows what not to overwrite |
| `run_id`, `timestamp` | Which pipeline run produced the current state, and when |
| `approved_by` | Engineer sign-off, where required (notably before cutover) |

### 5.2 Why this is separate from the IR

Keeping status out of the IR keeps the IR reusable and stable: the IR should look the same whether it was lowered five minutes ago or five migration runs ago. Status, by contrast, changes constantly and is specific to a given run. Separating them also means a re-run of one stage (say, re-lowering after an adapter fix) does not require rebuilding the entire status history, only updating the affected records.

### 5.3 What it prevents

Without this index, two failure modes are likely at the scale this platform targets (hundreds to low thousands of source members): losing track of which programs have passed which gates, and a re-run of an early stage silently invalidating downstream artefacts that nobody re-checks. The index is what lets the platform (and the engineer) answer "is this program actually done" by reading one record, rather than cross-referencing five artefacts by hand.

---

## 6. Validation and testing strategy

Reuses the five-layer approach from the earlier COBOL-to-Java agent skill design, mapped onto this pipeline's stage boundaries:

| Layer | Applied at | Phase |
|---|---|---|
| Parse-complete gate | After language front-ends (3.2) | Phase 0 |
| Graph-complete gate | After code graph (3.4) | Phase 0 |
| Mapping validity gate | After mapping configuration (3.6) | Phase 0 |
| Compile and lint gate | After code generation (3.8) | Phase 0 |
| Golden-file behavioural diff | After code generation (3.8), against the original mainframe program | Phase 0 (prioritised) |
| Adapter conformance suite | Continuous, in CI, per language and per UI adapter | Phase 0 |
| Performance regression | After code generation, for cutover candidates | Phase 1 |
| LLM-based semantic tagging | Cross-cutting, flags ambiguous or low-confidence conversions for review | Phase 1 |

---

## 7. Data storage architecture

| Artefact | Storage |
|---|---|
| Raw source + origin metadata | File store, keyed by library/file/member |
| Language ASTs | Cached per source member, invalidated on re-ingestion |
| Semantic IR | Versioned document store, one IR graph per ingested codebase |
| Code graph | Graph database |
| Service specifications | Structured documents (OpenAPI + data-model schema) per service |
| Mapping configuration | Versioned document store, keyed by IR field identifiers |
| UI specification | Versioned document store, keyed by IR/service identifiers, with per-component ownership flags |
| SSoT migration index | Single authoritative table or document store, one record per source unit |
| Generated code | Output file store, regenerated per run, never hand-edited in place |

---

## 8. Open-source foundation

| Layer | Candidate | Notes |
|---|---|---|
| COBOL parsing | ProLeap COBOL parser (ANTLR4, AST + semantic graph) or Koopa (BSD-licensed) | Both accept free and fixed format; ProLeap passes the NIST COBOL 85 test suite |
| RPG parsing | No mature open-source semantic parser; Code for IBM i and vscode-rpgle cover editing/linting only | Plan a purpose-built ANTLR grammar as a dedicated workstream |
| Graphify | graph database | Suited to call/file/field relationship queries, also label the user flow, eg: LoanProcess |
| Backend and frontend scaffolding | JHipster (Apache 2.0) | Primary base; Telosys as a lighter-weight alternative |
| UI library adapters | Built in-house per target library | No existing open-source project covers this layer directly |

---

## 9. Phased rollout implications

- **Phase 0 (internal MVP)**: the full pipeline runs end to end against one real or representative codebase. `SourceProvider` uses `FileSetProvider` only. Validation prioritises parse-complete, graph-complete, and golden-file behavioural diffing.
- **Phase 1 (internal hardening)**: RPG/COBOL dialect coverage expands, `IbmiConnectionProvider` is added behind the same interface, and performance regression and semantic tagging validation layers come online.
- **Phase 2 (productisation)**: multi-tenant isolation is added at every storage layer in section 7 (each customer's source, IR, graph, specs, and generated code are isolated), plus authentication and self-service onboarding.

---

## 10. Open engineering decisions

1. RPG grammar scope for Phase 0: full RPG IV free-form coverage first, with fixed-format and RPG III following, or built in parallel from the start.
2. Graph database choice: confirm Neo4j Community Edition is sufficient at expected codebase scale, or evaluate a lighter embedded alternative for Phase 0.
3. JHipster vs. a custom generator on Telosys: JHipster gives more scaffolding for free but may need significant adaptation to fit the mapping-driven generation model in 3.6.
4. Ownership-marker granularity for the UI layer: file-level versus field/component-level markers, and how conflicts are surfaced when a regenerated component and a manually owned component disagree.
5. SSoT storage technology: a relational table is likely sufficient at Phase 0 scale; revisit if Phase 2 multi-tenant scale changes that calculus.

## 11. Recommended next steps, in order

1. Semantic IR specification (formal schema, extension mechanism, versioning rules) — blocks the most downstream work if left informal.
2. SSoT / migration index design (schema in section 5.1, read/write contract per stage) — the orchestration backbone.
3. RPG parsing feasibility spike — highest technical risk in the platform, no open-source foundation to build on.
4. Golden-file validation harness design — the platform's core trust mechanism.
5. JHipster vs. Telosys prototype spike — lower risk, still worth resolving before committing to a code-generation base.

## 12. DSPF-RAD implementation profile

This document defines the future multi-language LegacyGraph platform. The current DSPF-RAD implementation uses the narrower contract under `contract/` and the plan under `plan/plan_v2/`.

Use this DSPF-specific pipeline:

```text
DSPF / PF-DD / external runtime source
    → DspfDocument
    → DspfSemanticIR
    → Mapping Contract
    → ModernReactModel
    → generated React app
    → Vite server
    → Browser and Playwright audit
```

Use `contract/09-preview-generation-methodology.md` for the deterministic preview, HMR/reload, screenshot, build, receipt, and repair workflow.

For DSPF Phase 0, use an in-memory relation graph. Do not require Neo4j, COBOL parsing, JHipster, Telosys, or multi-language service clustering before the DSPF semantic layout and generated React output pass their gates.

Keep these sources separate:

```text
Markdown contract → system rules and decisions
DspfSemanticIR → ingested source meaning
Mapping Contract → source-to-target conversion
Migration index → pipeline status and approval
```

The generic architecture remains a future extension. It must not expand the current DSPF ticket scope without an explicit plan decision.