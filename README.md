# IronTerm Studio

An offline-first IBM i development environment, evolving from DSPF·RAD.

Open a `.DSPF` source, drag widgets onto a 5250 grid, tweak attributes in the inspector, and watch the DSPF source regenerate live as you work. Or type into the source pane and watch the canvas catch up. It goes both ways.

The current branch is establishing the broader Visual Studio 6-inspired
workbench, a clean browser/desktop boundary, and the foundation for future IBM i
connections. Existing DSPF project files, autosaves, and generated protected
regions retain their established identifiers for compatibility.

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
- Document-wide undo/redo, multi-selection, copy/paste/duplicate, and visual
  alignment/distribution tools.
- Unsaved-work indicator plus local crash/session recovery. Plain DSPF remains
  the portable DDS source; a RAD project JSON also preserves generator flow.
- Navigable Problems view with semantic errors, visual overflow, and overlap
  diagnostics linked back to the record and canvas item.
- New-design assistant with blank, login, menu, maintenance, subfile, popup,
  and confirmation templates for both supported display sizes.
- Runtime preview mode: toggle response indicators and supply sample field
  values without changing the generated DSPF.
- Project navigator that lists record formats and follows SFL, menu/pulldown,
  and referenced-window relationships.
- PF/LF DDS importer that selects database fields and lays them out as a
  labeled maintenance form or as compact subfile columns.
- Command-key flow editor for default, exit, and record-navigation actions;
  RPGLE and COBOL generators emit the matching screen state and routes.
- Native RAD project open/save for design state that does not belong in DDS,
  including command-key actions.
- Safe record duplication and reordering. Linked SFL/SFLCTL formats are cloned
  and moved as one unit, with new item IDs and corrected internal links.
- Global design search across records, fields, constants, descriptions, and
  DDS keywords, with direct navigation back to the canvas and inspector.

## Running it

Install the pinned dependencies and start the local development server:

```sh
npm install
npm run dev
```

Vite prints the local address, normally <http://127.0.0.1:5173>. The runtime
does not fetch CodeMirror, 98.css, or other application dependencies from a
CDN, so the IDE can start and perform local work without internet access.

Create a distributable static build with:

```sh
npm run build
npm run preview
```

The generated `dist/` directory contains the JavaScript and CSS required at
runtime. A future desktop package will embed the same frontend and provide the
SSH/SFTP and IBM i command capabilities that browsers cannot safely expose.

## Engine tests and generated samples

The repository has Node tests for the DSPF engine, code generators, and platform
contracts. They intentionally validate model and source semantics rather than
page markup.

```sh
npm test
npm run samples
```

The suite round-trips all 72 DSPFs under `QDDSSRC/`, `TESTS/`, and `SAMPLES/`.
It also generates RPGLE and ILE COBOL from every fixture, checks compound DDS
indicator conditions, help specifications, file/record scope, ENPTUI control
fields, subfile RRN declarations, code-region integrity, and generator source
limits. It also covers PF/LF field parsing/layout, RAD key-flow generation,
record cloning/reordering, and design search; there are intentionally no
browser-driven tests. `npm run samples` refreshes:

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
RPGLE or CBLLE source and IronTerm Studio will keep the bodies of matching
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
  temporary width until their PF/LF definitions are imported explicitly.
- Command-key actions are RAD metadata and therefore require saving the RAD
  project JSON in addition to exporting a plain DSPF member.
- Final CRTDSPF/CRTBNDRPG/CRTBNDCBL acceptance still requires an IBM i system.
- The browser host supports local file operations only. Direct IBM i access
  belongs to the future desktop host; credentials will not be stored in project
  documents or autosave data.

## Architecture

Code organization is treated as a product requirement. Pure IBM i/DDS logic,
IDE features, workbench UI, and environment integrations have explicit
boundaries and one-way dependencies. Start with the
[architecture guide](docs/architecture/README.md) and
[contribution rules](CONTRIBUTING.md) before adding a new subsystem.

## Controls

- **Drag** from the palette onto the grid, or click a palette item then click the grid (click-to-place fallback).
- **Click** an item to select. **Arrow keys** nudge it, **Shift+Arrow** moves by 5. **Del** removes it.
- **Shift/Ctrl+Click** selects multiple items. **Ctrl+C/V/D** copies, pastes,
  or duplicates the selection; **Ctrl+Z/Y** undo and redo.
- Use **Arrange** in the toolbar to align or distribute selected items.
- Use **Clone** and the **↑/↓** buttons to reuse or reorder record formats;
  linked subfile pairs remain together automatically.
- Use **Find…** or **Ctrl+F** to jump directly to a record, field, visible text,
  descriptive `TEXT` value, or DDS keyword.
- Use **Import PF/LF…** to select fields from database DDS and generate a form
  or subfile row layout in the active design.
- Use **Key flow…** to map AID keys to exit or persistent record navigation;
  use **File > Save RAD project…** to preserve those mappings.
- Use **Simulate** to preview conditioned items, SFL display indicators, choice
  values, and sample field contents. Preview state never modifies the source.
- Switch the left-side **Project** panel from Palette to Records to navigate
  large display files and their linked formats.
- **Overlay** fades non-active records behind the current one so you can see how the screens layer.
- **Hide cond** skips items that only render under indicator conditions, handy for cleaning up screens like CLOCK that stack one item per digit value.

## Why

Tooling for DDS on IBM i is... spartan. SDA still works, but nothing beats dragging things around with a mouse while the source updates as you go. This is a small love letter to the people who still maintain 5250 green-screens and want a friendlier on-ramp.

## License

GNU General Public License v3.0 (29 June 2007).
See `LICENSE` for the full text.
