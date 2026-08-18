# Repository Guidelines

DSPF·RAD is a browser-based RAD designer for IBM i (AS/400) DSPF display files: drag widgets onto a 5250 grid, edit attributes, and the DSPF source regenerates live; typing in the source pane drives the canvas. GPLv3. User-facing features, run instructions, and controls live in [README.md](README.md) — do not duplicate them here.

## Architecture & Data Flow

- Vanilla ES modules, no framework, no build step, no bundler. One page, one app instance: `index.html` → `src/main.js` → `src/app/boot.js` (the assembly line).
- **Single source of truth: one `DspfDocument`** (`src/model/`), constructed in `boot()`, injected everywhere via closures, debug-exposed as `window.dspfRad`. Never create a second document.
- Document shape: `{ modelKey: '24x80' | '27x132', records, activeRecordIndex, showOverlay, hideConditioned }`. Record: `{ name (uppercase, ≤10 chars), type: 'RECORD'|'SFL'|'SFLCTL'|'MNUBAR'|'PULLDOWN'|'WINDOW', items, keywords }`. Item: `{ id, kind: 'constant'|'field'|'sysvalue', row, col, … }`. Keywords are normalized to `{ name, args, indicators }` so anything unrecognized still round-trips.
- Two loops around the doc:
  - UI→doc: `designer/` (canvas pointer/keyboard/drag) and `inspector/` mutate the doc, then call `doc.emit()`.
  - doc→UI: `emit()` fans out to `Designer._refresh` (canvas redraw), `chromeSync` (toolbar/statusbar), and `sourceSync`'s writer.
- Source↔canvas bridge (`src/app/sourceSync.js`):
  - canvas→source: `doc.onChange` → `writeDspfWithMap` → editor `setValue`.
  - source→canvas: user typing (300 ms debounce) → `parseDspf` → `doc.adopt(parsed)` (adopts in place so references stay valid; parse failures keep the last-good doc and set a status badge).
- **Loop protection is load-bearing**: three reentrancy flags — `sourceIsAuthoritative`, `suppressCursorSync`, `SourceEditor._internal` — plus `Transaction.addToHistory.of(false)` so programmatic regenerations don't pollute Ctrl+Z. Any new `doc.onChange` listener that writes into the editor MUST respect `sourceIsAuthoritative`; any programmatic editor write MUST be wrapped in `_internal` + `addToHistory.of(false)`.
- Parser pipeline: `parseDspf.js` → `lineFilter` → `lineFields` → `tokenizer` → model. Writer: `writeDspf.js` + `line.js` (`pushLine`/`formatKeyword`) + `header.js`, 80-column emit.
- Codegen (`src/codegen/`): pure analysis functions (`analysis.js`) feed string builders (`rpgle.js`, `cobol.js`) that emit `[DSPF-RAD-REGION begin=<key>] … end` protected blocks; the caller merges.

## Key Directories

| Path | Purpose |
|---|---|
| `src/model/` | Canonical document/item/record/keyword shapes + keyword helpers (`keywords.js`); public surface via `index.js` |
| `src/parser/` | Tolerant DSPF source → document (missing `A` prefix, tabs, `+`/`-` continuations, relative `+N` coords) |
| `src/writer/` | Document → 80-column DSPF source (+ per-item line map for cursor↔item sync) |
| `src/canvas/` | Canvas2D renderer (`GridCanvas.js`), per-kind painters, hit-testing, metrics |
| `src/designer/` | Orchestrator: selection, pointer/keyboard/drag input → doc mutations, palette placement |
| `src/inspector/` | Property panels (Item/Record tabs), rebuilt from scratch per render; edits flow through `ctx` callbacks |
| `src/palette/` | HTML5 drag source + click-to-place fallback; custom MIME `application/x-dspf-item` |
| `src/source/` | CodeMirror 6 wrapper (`SourceEditor.js`), tokenizer, completions, ruler/column marker |
| `src/codegen/` | RPGLE/COBOL skeleton generators + pure doc analysis |
| `src/app/` | Bootstrap (`boot.js`), chrome sync, source sync, file IO, menubar, theme, panel resize, demo seed |
| `src/Attributes.js` | Shared canvas/inspector vocabulary: DSPATR flags, colors, data types, usages, EDTCDE |
| `TESTS/`, `QDDSSRC/` | DSPF fixtures (see Testing & QA) — not code, not wired into the app |

## Development Commands

There are no build, test, lint, or format commands — no `package.json`, no bundler, no linter, no CI. The app is served statically and verified in a browser:

```sh
python3 -m http.server 8000     # then open http://localhost:8000
```

- `file://` will NOT work — ES modules + import map require HTTP.
- CodeMirror 6 is pulled from esm.sh at load time; needs internet on first load.
- Manual QA hook: `window.dspfRad` in the browser console (`{ doc, designer, palette, parse, write, load }`).
- Docker (`Dockerfile`): node:lts-alpine + global `serve`, honors Railway `$PORT`; image copies only `index.html styles.css robots.txt sitemap.xml src/`.

## Code Conventions & Common Patterns

- **Modules**: pure ESM, named exports only (no `export default` anywhere), explicit `.js` extensions on every relative import (browser requirement).
- **File naming**: `PascalCase.js` = classes (`DspfDocument.js`, `GridCanvas.js`, `SourceEditor.js`); `camelCase.js` = function modules (`parseDspf.js`, `sourceSync.js`, `boot.js`). Subdirectories lowercase.
- **Function prefixes**: `bind*` = DOM wiring (`bindSourceSync`, `bindOpen`); `make*` = factories (`makeItem`, `makeChromeSync`); `render*` = inspector sections; `draw*` = canvas painters; `collect*`/`pick*` = codegen analysis; `set*/add*/remove*/update*` = doc mutations.
- **Classes only when instance state matters** (document, canvas, designer, inspector, palette, editor). Dependencies are constructor-injected as a single options object: `new Designer({ canvas, document, inspector, palette, onChange, onSelectionChange })`; use thunk refs for late-bound deps (`documentRef: () => doc`).
- **Style**: 4-space indent, single quotes, semicolons, trailing commas in multiline literals, aligned `=`/`:` in imports and object literals, underscore-prefixed private members (`_internal`, `_listeners`). Space before paren in `function name (args)` declarations; none in arrow consts.
- **Comments**: no JSDoc (exactly one `/** */` in the repo — do not introduce more). Every file opens with a `//` header explaining purpose + invariants (see `writeDspf.js`); section banners `// ---- X ----` inside files; comments explain WHY.
- **Error handling**: no custom error classes. The parser never throws (tolerant; orphans land in a synthetic `NONAME` record). Patterns: `try { … } finally { flag = false }` for reentrancy guards; swallow-with-comment for localStorage/private-mode; boundary failures → `console.error('[dspf·rad] …')` + `flash(text, 'error')` status pill or `#status` text; boot errors surface as `BOOT ERROR` (TDZ from reordering init is the usual cause — keep the documented construction order).
- **Validation is boundary normalization, not defensive assertions**: clamps in `updateItem`/`setModel`, `uniqueRecordName`, silent no-op early returns (e.g. `deleteRecord` refuses the last record).
- **Events**: plain callback sets, no DOM `CustomEvent`. `doc.onChange(fn)` returns an unsubscribe; `emit()` iterates. Hooks like `SourceEditor._onUserChange` and `Designer.onSelectionChange` are assigned properties read at fire-time.
- **Async**: nearly everything is synchronous; only `file.text()` and `navigator.clipboard.writeText` are async. Debounce with `setTimeout` (300 ms source sync), resize with `requestAnimationFrame` + `ResizeObserver`.
- **DOM**: `document.createElement` + `className` + `textContent` + `appendChild` everywhere (user data never goes through `innerHTML`); the only `innerHTML = ''` clears are `Inspector.render()` and `rebuildRecordSelect`. `$ = document.getElementById` helper in `boot.js`.
- **Menubar**: items dispatch via `data-cmd` → synthesized click on a hidden `#legacyControls` button; real handlers stay closures in `boot.js`. New menu commands need a matching hidden button id.
- **Inputs commit on `change` (blur/Enter), not `input`** — UI drivers must blur to trigger edits.

## Important Files

- `index.html` — app shell + import map. CodeMirror 6 packages are pinned with `?external=` chains so all sub-packages share ONE `@codemirror/state`/`view` instance; adding a CM6 package requires the exact external list or `EditorView` instanceof checks fail ("Unrecognized extension value"). Hidden `#legacyControls` buttons live here.
- `src/main.js` → `src/app/boot.js` — entry; `boot.js` is the assembly line (construction order is fragile).
- `src/model/DspfDocument.js`, `factories.js`, `keywords.js`, `constants.js`, `index.js` — the data model and its helpers.
- `src/Attributes.js` — shared display-attribute vocabulary (DSPATR, COLOR, EDTCDE, USAGES).
- `src/parser/parseDspf.js`, `src/writer/writeDspf.js` — tolerant parser and 80-column writer; round-trip symmetry is a core invariant.
- `src/app/sourceSync.js` — two-way sync bridge (the most safety-critical file).
- `src/app/fileIO.js` — open/save; `bindSave` downloads `{record0name}.DSPF`.
- `src/source/SourceEditor.js` — CodeMirror wrapper with `_internal` guard.
- `src/codegen/rpgle.js`, `cobol.js`, `analysis.js` — skeleton generators + analysis.
- `Dockerfile`, `README.md`, `LICENSE` (GPLv3).

## Runtime/Tooling Preferences

- Browser-only app; no Node runtime for development (any static server works). Node appears only in the Docker image to run `serve`.
- No package manager, no lockfile, no bundler, no TypeScript, no linter.
- `.agents/skills/typescript-best-practices` is stale for this repo (zero TS files) — do not apply its rules. Console logging is deliberate (boot banner, `exportJson` dump, `[dspf·rad]` error prefix) — keep it.
- CSS: `styles.css` overrides 98.css; follow the banner/`----` section-comment organization, plain lowercase-hyphen classes (not BEM), and reuse `--w98-*`/semantic CSS vars instead of hardcoded colors. The 5250 terminal canvas and CodeMirror stay phosphor-green in both themes — do not "fix" them.
- Theme: `localStorage['dspf-theme']` + `data-theme` attr (`src/app/Theme.js`); column marker: `localStorage['dspf-rad:col-marker']`.
- `Dockerfile` COPY line must include any new root-level runtime asset; `.dockerignore` strips `TESTS/`, `QDDSSRC/`, and docs from the image.

## Testing & QA

- **No automated tests, no test runner, no CI** — nothing to run. Do not invent commands.
- `TESTS/` (20 files, e.g. `MULTI_WINDOW.DSPF`, `CHOICE.DSPF`) and `QDDSSRC/` (50 real-world sources) are DSPF fixtures for manual round-trip exercise; they are referenced by zero code. Load them via File → Open (`#fileInput` → `parseDspf` → `doc.adopt`), which auto-switches the model from `DSPSIZ`.
- `QDDSSRC/` files are NOT valid UTF-8 (legacy single-byte chars in banner comments) — use `:raw` or convert before reading.
- Verification workflow: serve over HTTP, load a fixture, exercise the changed path (canvas edit → source regenerates; source edit → canvas follows), watch the status pill. Use `window.dspfRad.parse(text)` / `.write()` / `.load(text)` in the console for quick round-trip checks.
- Known asymmetries: hidden fields (`usage 'H'`) drop row/col through writer→parser; item ids regenerate on every parse (never cache ids across `adopt`).
