<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# Repository Guidelines

DSPF·RAD is a browser-based RAD designer for IBM i (AS/400) DSPF display files (drag widgets onto a 5250 grid, DSPF source regenerates live; typing in the source pane drives the canvas), plus a conversion system that turns parsed DSPF into generated React + Spring Boot projects. GPLv3. User-facing features, run instructions, and controls live in [README.md](README.md) — do not duplicate them here.

## One Logic Tree, Two Shells + a Generator Library

- **Shared logic = `src/`** (except nothing — everything under `src/` is shared): model/parser/writer are pure ESM; canvas/designer/inspector/palette/source/app are DOM-heavy but framework-free.
- **Legacy shell**: static page, no build step. Entry: `index.html` → `src/main.js` → `src/app/boot.js` (the assembly line).
- **React shell** (`react-app/`): Vite + React 19 + MUI faithful-preview app that imports `src/` **verbatim** via the `@dspf/*` alias → `../src`. Nothing is copied into that tree — edits to `src/` affect both apps.
- **Conversion core** (`src/codegen/`): pure Node-testable functions. Pipeline: `parseDspf` → `buildCompleteSemanticIR` (`semanticAssembly.js`) → `buildMappingContract` (`mappingContract.js`) → `generateReactApp` (`reactApp.js`) / `generateSpringBootApp` (`springBoot.js`). The Semantic IR is the conversion boundary: conversion core reads `DspfDocument`, never replaces it.

## Development Commands

Two package managers on purpose: root uses **pnpm**, `react-app/` uses **npm** (own lockfile). Don't mix them.

```sh
pnpm test                                        # root suite: vitest run, node env
pnpm exec vitest run src/codegen/readiness.test.js   # single file

pnpm generate:react  -- <path/to.DSPF> [outdir] [--overrides <layout-overrides.json>]  # writes a real npm project; default generated/react-app
pnpm generate:spring -- <path/to.DSPF> [outdir] [--overrides <layout-overrides.json>]  # writes a Maven project;    default generated/spring-runtime
# note the bare "--" before args; scripts throw without a DSPF path

cd react-app
npm install            # first time only
npm run dev            # vite dev server
npm test               # vitest jsdom suite
npm run build          # REQUIRED before Playwright — preview serves dist/
npx playwright test    # chromium-only e2e; auto-starts vite preview on :4173 (reuseExistingServer)
```

- No linter, no formatter config, no CI anywhere. Verification = tests + manual browser QA.
- Root vitest runs with `environment: 'node'` deliberately — keep `src/codegen/**` free of DOM/window deps.
- Legacy app still runs with any static server (`python3 -m http.server 8000`); `file://` will NOT work (ES modules + import map).
- CodeMirror 6 comes from esm.sh at load time in the legacy app — internet needed on first load.
- Manual QA hook: `window.dspfRad` in the console of the legacy app (`{ doc, designer, palette, parse, write, load }`).

## Conversion Contracts (contract/)

- Consolidated SSOT (2026-08, decisions.md D-11/D-12): `01-scope-and-sources` / `02-conversion-core` / `03-generated-react-app` / `04-seed-backend` / `05-lifecycle` + `decisions.md`; one concern = one section in the matching doc — never recreate parallel documents. Old numbered files live only in git history.
- Lifecycle (D-16): source→edit→convert→generate→verify→deliver; verification ladder L1 unit → L2 jsdom → L3 build → L4 Playwright; **ticket/gate evidence must be user-observable** (rendered output, computed style, HTTP response, artifact hash) — an internal module existing is not evidence.
- **Product scope is frontend conversion; Spring Boot is a seed-data demo server only** (`mode: "seed-demo"` in every response). Session/security/idempotency/audit/approval governance is deferred — do not build it back without an owner decision.
- Markdown owns meaning; JSON schemas + `openapi.yaml` are projections. On conflict: **stop implementation**, update Markdown first, then regenerate the projection.
- Core rules: conversion core only reads `DspfDocument`; unsupported semantics never produce executable actions; zero silent drops; every conversion emits manifest + traceability + binding map + report.
- `TESTS/`, `QDDSSRC/`, `INPUT/` are reference apps used as test corpora (fixtures, e2e loads, seed extraction) — referenced by zero runtime code. `plan/`, `design/`, `references/`, root `*.md` reports are historical planning records.

## Architecture & Data Flow (legacy app)

- **Single source of truth: one `DspfDocument`** (`src/model/`), constructed in `boot()`, injected everywhere via closures, debug-exposed as `window.dspfRad`. Never create a second document.
- Document shape: `{ modelKey: '24x80' | '27x132', records, activeRecordIndex, showOverlay, hideConditioned }`. Record: `{ name (uppercase, ≤10 chars), type: 'RECORD'|'SFL'|'SFLCTL'|'MNUBAR'|'PULLDOWN'|'WINDOW', items, keywords }`. Item: `{ id, kind: 'constant'|'field'|'sysvalue', row, col, … }`. Keywords normalize to `{ name, args, indicators }` so anything unrecognized still round-trips.
- Two loops around the doc:
  - UI→doc: `designer/` (pointer/keyboard/drag) and `inspector/` mutate the doc, then call `doc.emit()`.
  - doc→UI: `emit()` fans out to `Designer._refresh`, `chromeSync`, and `sourceSync`'s writer.
- Source↔canvas bridge (`src/app/sourceSync.js`): user typing (300 ms debounce) → `parseDspf` → `doc.adopt(parsed)` (adopts in place so references stay valid; parse failures keep the last-good doc and set a status badge); canvas edits → `writeDspfWithMap` → editor `setValue`.
- **Loop protection is load-bearing**: three reentrancy flags — `sourceIsAuthoritative`, `suppressCursorSync`, `SourceEditor._internal` — plus `Transaction.addToHistory.of(false)` so programmatic regenerations don't pollute Ctrl+Z. Any new `doc.onChange` listener that writes into the editor MUST respect `sourceIsAuthoritative`; any programmatic editor write MUST be wrapped in `_internal` + `addToHistory.of(false)`.
- Parser pipeline: `parseDspf.js` → `lineFilter` → `lineFields` → `tokenizer` → model. Writer: `writeDspf.js` + `line.js` + `header.js`, 80-column emit with per-item line map for cursor↔item sync. Round-trip symmetry is a core invariant.
- RPGLE/COBOL skeletons (`rpgle.js`, `cobol.js`) emit `[DSPF-RAD-REGION begin=<key>] … end` protected blocks so regeneration preserves handwritten logic.

## Key Directories

| Path | Purpose |
|---|---|
| `src/model/` | Canonical document/item/record/keyword shapes + helpers (`keywords.js`); public surface via `index.js` |
| `src/parser/` | Tolerant DSPF source → document (missing `A` prefix, tabs, `+`/`-` continuations, relative `+N` coords); never throws — orphans land in synthetic `NONAME` record |
| `src/writer/` | Document → 80-column DSPF source (+ per-item line map) |
| `src/codegen/` | Conversion core: semantic IR, mapping contract, React/Spring generators, governance/readiness/receipts gates; colocated `*.test.js` files are the root suite |
| `react-app/` | Vite+React+MUI preview shell (`src/preview`, `src/conversion`) + Playwright `e2e/`; imports legacy code via `@dspf/*` alias |
| `contract/` | Markdown SSOT contracts (4 topic docs + decisions log) + schema/OpenAPI projections — see above |
| `scripts/` | CLI wrappers behind pnpm scripts: `generate-react-app.mjs` / `generate-spring-app.mjs` / `extract-design-overrides.mjs` (`pnpm extract:overrides`) / `check-projections.mjs` (`pnpm check:projections`) / `verify-sources.mjs` (`pnpm verify:sources`, Gate C5 corpus sweep) |
| `TESTS/`, `QDDSSRC/` | DSPF fixtures (20 / 50 files) for manual round-trip exercise; referenced by zero code |
| `src/canvas/`, `src/designer/`, `src/inspector/`, `src/palette/`, `src/source/`, `src/app/` | Legacy-shell UI: Canvas2D renderer, input orchestrator, property panels, drag palette, CodeMirror wrapper, bootstrap/chrome/sync/fileIO/theme |

## Code Conventions & Common Patterns

- **Modules**: named exports only in hand-written code — no `export default` at module level (the `export default` strings inside `codegen/reactApp.js` are emitted generated-code templates, not module exports). Explicit `.js` extensions on every relative import (browser requirement).
- **File naming**: `PascalCase.js` = classes; `camelCase.js` = function modules; subdirectories lowercase.
- **Function prefixes**: `bind*` = DOM wiring; `make*` = factories; `render*` = inspector sections; `draw*` = canvas painters; `collect*`/`pick*` = analysis; `set*/add*/remove*/update*` = doc mutations; `build*` = codegen IR/contracts.
- **Classes only when instance state matters**; dependencies constructor-injected as one options object; thunk refs for late-bound deps (`documentRef: () => doc`).
- **Style**: 4-space indent, single quotes, semicolons, trailing commas in multiline literals, aligned `=`/`:` in imports/object literals, underscore-prefixed private members. Space before paren in `function name (args)` declarations; none in arrow consts.
- **Comments**: no JSDoc (exactly one `/** */` exists, in `src/app/Theme.js` — do not add more). Every file opens with a `//` purpose/invariants header; section banners `// ---- X ----`; comments explain WHY.
- **Error handling**: no custom error classes; parser never throws. Patterns: `try { … } finally { flag = false }` reentrancy guards; swallow-with-comment for localStorage; boundary failures → `console.error('[dspf·rad] …')` + status pill. Boot errors surface as `BOOT ERROR` (TDZ from reordering init is the usual cause — keep boot.js construction order).
- **Validation is boundary normalization, not defensive assertions**: clamps in `updateItem`/`setModel`, `uniqueRecordName`, silent no-op early returns (e.g. `deleteRecord` refuses the last record).
- **Events**: plain callback sets, no DOM CustomEvent. `doc.onChange(fn)` returns an unsubscribe; hooks like `_onUserChange` are assigned properties read at fire-time.
- **DOM**: `createElement` + `className` + `textContent` + `appendChild`; user data never goes through `innerHTML`. Menubar dispatches via `data-cmd` → synthesized click on hidden `#legacyControls` buttons in `index.html` — new menu commands need a matching hidden button id.
- **Inputs commit on `change` (blur/Enter), not `input`** — UI drivers must blur to trigger edits.

## Important Files

- `index.html` — app shell + import map. CM6 packages are pinned with `?external=` chains so all sub-packages share ONE `@codemirror/state`/`view` instance; adding a CM6 package requires the exact external list or `EditorView` instanceof checks fail ("Unrecognized extension value").
- `react-app/vite.config.js` — `@dspf/*` alias plus explicit aliases pinning every CM package to react-app's own node_modules (Rollup resolves bare imports from the importing file's location, which misses for files under `../src`). Replicate this pattern if imports break with "cannot resolve".
- `src/app/sourceSync.js` — two-way sync bridge (most safety-critical file). `src/app/boot.js` — fragile construction order. `src/model/DspfDocument.js` + `factories.js`/`keywords.js`/`constants.js`. `src/Attributes.js` — shared DSPATR/COLOR/EDTCDE vocabulary. `src/parser/parseDspf.js`, `src/writer/writeDspf.js`. `src/codegen/mappingContract.js` + `semanticAssembly.js` — the conversion entry points.

## Runtime/Tooling Preferences

- Node IS needed now (tests, generators) — but the legacy app itself still has no runtime dependency on it.
- `open-pencil/` (OpenPencil design editor) is an embedded EXTERNAL tool, gitignored — never commit or import its source; integrate only via its CLI (`bun open-pencil …`) or exported JSON. It feeds target-side layout/component overrides through `pnpm extract:overrides`; see contract/03 §9 + decisions.md D-15.
- `.agents/skills/typescript-best-practices` is stale (zero TS files) — don't apply its rules. Console logging is deliberate (boot banner, `[dspf·rad]` error prefix) — keep it.
- CSS: `styles.css` overrides 98.css; banner/`----` section comments, plain lowercase-hyphen classes (not BEM), reuse `--w98-*`/semantic vars. The 5250 terminal canvas and CodeMirror stay phosphor-green in both themes — do not "fix".
- Theme: `localStorage['dspf-theme']` + `data-theme` attr (`src/app/Theme.js`); column marker: `localStorage['dspf-rad:col-marker']`.
- `Dockerfile` serves ONLY `index.html styles.css robots.txt sitemap.xml src/` — any new root-level runtime asset must be added to its COPY line. `.dockerignore` strips TESTS/QDDSSRC/docs.

## Testing & QA

- Root suite (`pnpm test`): node-env vitest over `src/**/*.test.js` — all conversion-core coverage lives next to the code in `src/codegen/*.test.js`.
- react-app suite (`npm test`): jsdom vitest (unit tests beside components + `src/test/setup.js`); Playwright e2e specs in `e2e/` are excluded from vitest and run via `npx playwright test` after a build.
- Fixtures: load `TESTS/*.DSPF` or `QDDSSRC/*` via File → Open (`parseDspf` → `doc.adopt` auto-switches model from `DSPSIZ`). Quick round-trip checks in console: `window.dspfRad.parse(text)` / `.write()` / `.load(text)`.
- `QDDSSRC/` files are NOT valid UTF-8 (legacy single-byte chars) — read as raw bytes or convert first.
- Verification workflow: serve/load fixture, exercise the changed path both directions (canvas edit → source regenerates; source edit → canvas follows), watch the status pill.
- Known asymmetries: hidden fields (`usage 'H'`) drop row/col through writer→parser; item ids regenerate on every parse (never cache ids across `adopt`).
