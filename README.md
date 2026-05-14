# DSPF·RAD

A browser-based RAD designer for IBM i (AS/400) display files.

Open a `.DSPF` source, drag widgets onto a 5250 grid, tweak attributes in the inspector, and watch the DSPF source regenerate live as you work. Or type into the source pane and watch the canvas catch up. It goes both ways.

## Screenshots

### Overview
<img width="1510" height="864" alt="image" src="https://github.com/user-attachments/assets/dd74b9a5-8e36-4b34-bac5-51d18e6a8ffa" />

### Subfile design with overlay mode
<img width="1512" height="909" alt="image" src="https://github.com/user-attachments/assets/0d1726be-1cf4-4777-b2d8-eb9f147cc5c7" />

### Live source pane and inspector
<img width="1512" height="902" alt="image" src="https://github.com/user-attachments/assets/4c655710-4b65-408e-862e-dc93d71627d0" />

## What it does

- Visual editor for the **24x80** (5251-11) and **27x132** (3477-FC) terminal geometries.
- Multiple record formats per file: plain records, subfile pairs (SFL/SFLCTL), menu bars, pulldowns, and windows.
- Two-way sync between the drag-and-drop canvas and a CodeMirror DSPF source view. Edit either side, the other follows.
- Parses real-world DSPF source. Tolerant about the leading `A`, tab vs. space prefixes, `+` and `-` keyword continuations, and the usual quirks tools leave behind.
- Emits clean, round-trippable 80-column source on save.
- **ENPTUI presets** ready to drop: push buttons, radio and checkbox groups, menu bars, continued fields, error message fields.
- **System values** as drag-in widgets (DATE, TIME, USER, SYSNAME, etc).
- **RPGLE** and **COBOL** skeleton generators with protected regions, so you can regenerate after DSPF changes without losing your handwritten logic.

## Running it

It's a static page, but you need to serve it over HTTP (not `file://`), otherwise the browser will refuse to load the ES modules and the import map. The fastest way:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> in any modern browser. No build step, no Node, no bundler. Any other static server works just as well (`npx serve`, `php -S`, `caddy file-server`, whatever you have handy).

CodeMirror 6 is pulled from esm.sh through an import map, so you need an internet connection on first load (or vendor the modules locally if you want it fully offline).

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
