# DSPF·RAD

A browser-based RAD designer for IBM i (AS/400) display files.

Open a `.DSPF` source, drag widgets onto a 5250 grid, tweak attributes in the inspector, and watch the DSPF source regenerate live as you work. Or type into the source pane and watch the canvas catch up. It goes both ways.

## Screenshots

### Overview
<img width="1510" height="864" alt="image" src="https://github.com/user-attachments/assets/0ece6fdb-8651-4c0f-9ca9-1dc545fc8b5b" />

### Subfile design with overlay mode
<img width="1510" height="866" alt="image" src="https://github.com/user-attachments/assets/9e57b46d-1ceb-4682-a14f-adc766fecd31" />

### Live source pane and inspector
<img width="1512" height="909" alt="image" src="https://github.com/user-attachments/assets/8cae9b12-54d5-46a4-ba2c-8f57e28f13fd" />

## What it does

- Visual editor for the **24x80** (5251-11) and **27x132** (3477-FC) terminal geometries.
- Multiple record formats per file: plain records, subfile pairs (SFL/SFLCTL), menu bars, pulldowns, and windows.
- Two-way sync between the drag-and-drop canvas and a CodeMirror DSPF source view. Edit either side, the other follows.
- Parses real-world DSPF source. Tolerant about the leading `A`, tab vs. space prefixes, `+` and `-` keyword continuations, and the usual quirks tools leave behind.
- Emits clean, round-trippable 80-column source on save.
- **ENPTUI presets** ready to drop: push buttons, radio and checkbox groups, menu bars, continued fields, error message fields.
- **System values** as drag-in widgets (DATE, TIME, USER, SYSNAME, etc).
- **RPGLE** and **COBOL** skeleton generators with protected regions, so you can regenerate after DSPF changes without losing your handwritten logic.
- Semantic validation before code generation (record/field names, subfile links,
  indicator conditions, ENPTUI choice controls, pulldowns, and COBOL `INDARA`).

## Running it

It's a static page, but you need to serve it over HTTP (not `file://`), otherwise the browser will refuse to load the ES modules and the import map. The fastest way:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> in any modern browser. No build step, no Node, no bundler. Any other static server works just as well (`npx serve`, `php -S`, `caddy file-server`, whatever you have handy).

CodeMirror 6 is pulled from esm.sh through an import map, so you need an internet connection on first load (or vendor the modules locally if you want it fully offline).

## Engine tests and generated samples

The repository has dependency-free Node tests for the DSPF engine and both
code generators. They intentionally validate model and source semantics rather
than page markup.

```sh
npm test
npm run samples
```

The suite round-trips all 72 DSPFs under `QDDSSRC/`, `TESTS/`, and `SAMPLES/`.
It also generates RPGLE and ILE COBOL from every fixture, checks compound DDS
indicator conditions, help specifications, file/record scope, ENPTUI control
fields, subfile RRN declarations, code-region integrity, and generator source
limits. `npm run samples` refreshes:

- `SAMPLES/CGDEMO.RPGLE`
- `SAMPLES/CGDEMO.CBLLE`
- `SAMPLES/CGMULTI.RPGLE`
- `SAMPLES/CGMULTI.CBLLE`

The `CGDEMO` pair is generated from `SAMPLES/CODEGEN_FULL.DSPF`, which
exercises a linked subfile, function keys, a menu bar and pulldown, push
buttons, and single- and multiple-choice fields.

`SAMPLES/CODEGEN_MULTI.DSPF` exercises independent generation and routing for
two linked data-subfile pairs.

The Export menu has separate **Regenerate** actions. Select a previously edited
RPGLE or CBLLE source and DSPF·RAD will keep the bodies of matching
`DSPF-RAD-REGION` blocks while refreshing generated structure. For files with
multiple data subfiles, every `SFL/SFLCTL` pair receives its own RRN/load/read
regions and a generated screen selector (`WkScreen` / `WS-SCREEN`). Malformed,
duplicate, or mismatched regions stop the merge instead of losing code.

## IBM i compile verification

The local suite validates generator structure but cannot replace an IBM i
compiler. To perform the final platform check, copy the three `CGDEMO` sample
members to the corresponding source physical files and compile in this order:

```cl
CRTDSPF FILE(MYLIB/CGDEMO) SRCFILE(MYLIB/QDDSSRC) SRCMBR(CGDEMO)
CRTBNDRPG PGM(MYLIB/CGDEMO) SRCFILE(MYLIB/QRPGLESRC) SRCMBR(CGDEMO)
CRTBNDCBL PGM(MYLIB/CGDEMO) SRCFILE(MYLIB/QCBLLESRC) SRCMBR(CGDEMO)
```

Use different program object names if compiling both HLL samples into the same
library. The generated RPG uses `SFILE(format:rrn)` and a 99-position `INDDS`;
the COBOL source uses a `WORKSTATION-file-SI` assignment, dynamic access with a
relative key for subfiles, `COPY DDS-ALL-FORMATS`, and a 99-entry separate
indicator table.

## Current boundaries

- Source comments and SEU metadata are canonicalized rather than preserved.
- `REFFLD` definitions remain inherited in emitted DDS, but the canvas uses a
  temporary width because it cannot resolve the referenced PF/LF locally.
- Final CRTDSPF/CRTBNDRPG/CRTBNDCBL acceptance still requires an IBM i system.

## Controls

- **Drag** from the palette onto the grid, or click a palette item then click the grid (click-to-place fallback).
- **Click** an item to select. **Arrow keys** nudge it, **Shift+Arrow** moves by 5. **Del** removes it.
- **Overlay** fades non-active records behind the current one so you can see how the screens layer.
- **Hide cond** skips items that only render under indicator conditions, handy for cleaning up screens like CLOCK that stack one item per digit value.

## Why

Tooling for DDS on IBM i is... spartan. SDA still works, but nothing beats dragging things around with a mouse while the source updates as you go. This is a small love letter to the people who still maintain 5250 green-screens and want a friendlier on-ramp.

## License

GNU General Public License v3.0 (29 June 2007).
See `LICENSE` for the full text.
