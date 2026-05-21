# DSPF·RAD — Dark Theme Design

**Date:** 2026-05-21
**Status:** Draft — pending user review
**Author:** Alexandre Bencz (with Claude)

## 1. Purpose

DSPF·RAD currently ships a single Windows 98 chrome theme (silver/gray with navy
title bars) built on top of `98.css`. The 5250 canvas and the CodeMirror DSPF
editor are already dark (phosphor green on `#050a05`), but the surrounding
chrome is permanently light.

This spec defines a **dark theme** that:

- Keeps the Win98 3D border identity (raised/sunken bezels stay).
- Adopts a VSCode-flavoured neutral dark palette for the chrome.
- Leaves the phosphor canvas and editor untouched — that's the canonical IBM
  5250 look.
- Auto-detects the user's system preference on first load, with a manual
  toggle on the menubar that persists in `localStorage`.

The current light theme stays **pixel-identical** to today's build.

## 2. Non-Goals

- Amber phosphor mode, high-contrast mode, or any third theme.
- Changes to canvas or CodeMirror colors.
- Animated transitions when switching theme.
- Rewriting `98.css` internals — we only override its public CSS variables.
- A separate "Auto" tri-state in the toggle button (toggle is binary; auto is
  the *initial* state when nothing is saved).

## 3. Architecture

### 3.1 Semantic CSS variables

Today `styles.css` declares literal Win98 colors in `:root`:

```css
--w98-face:   #c0c0c0;
--w98-light:  #dfdfdf;
--w98-white:  #ffffff;
--w98-shadow: #808080;
--w98-dark:   #0a0a0a;
--w98-navy:   #000080;
--w98-teal:   #008080;
```

These names describe *what the color is*, not *what it's used for*. A dark
theme can't reuse them — `--w98-white` literally means white.

The refactor introduces **semantic variables** in `:root` and maps them to
today's literal values. Light-theme output stays byte-identical:

```css
:root {
  /* Backgrounds */
  --bg-app:         #008080;  /* was --w98-teal (desktop) */
  --bg-chrome:      #c0c0c0;  /* was --w98-face */
  --bg-chrome-alt:  #dfdfdf;  /* was --w98-light (highlight face) */
  --bg-panel-well:  #c0c0c0;  /* sunken interior */
  --bg-input:       #ffffff;  /* input/listbox white */
  --bg-tooltip:     #ffffe1;  /* palette hint yellow */

  /* Foregrounds */
  --fg-text:        #000000;
  --fg-muted:       #404040;
  --fg-disabled:    #808080;
  --fg-link:        #000080;  /* navy accents (palette group headers, etc.) */

  /* 3D border ladder — lightest to darkest */
  --border-light:   #ffffff;  /* was --w98-white */
  --border-mid:     #dfdfdf;  /* was --w98-light */
  --border-dark:    #808080;  /* was --w98-shadow */
  --border-deep:    #0a0a0a;  /* was --w98-dark */

  /* Title bars */
  --titlebar-bg-from: #000080;  /* navy */
  --titlebar-bg-to:   #1084d0;  /* lighter navy (98.css gradient) */
  --titlebar-fg:      #ffffff;

  /* Accents (selection / hover) */
  --accent:         #000080;
  --accent-hover:  #d8e4ff;   /* palette item hover */
  --accent-border: #6a90c0;

  /* Status colors */
  --status-ok:      #006000;
  --status-warn:    #806000;
  --status-error:   #800000;
}
```

The existing `--w98-*` and `--term-*` variables stay (still used elsewhere in
the file). New code references the semantic names.

### 3.2 Dark override

```css
[data-theme="dark"] {
  --bg-app:         #181818;
  --bg-chrome:      #2b2b2b;
  --bg-chrome-alt:  #353535;
  --bg-panel-well:  #252526;
  --bg-input:       #1e1e1e;
  --bg-tooltip:     #3a3a1a;

  --fg-text:        #cccccc;
  --fg-muted:       #888888;
  --fg-disabled:    #555555;
  --fg-link:        #4a9aff;

  --border-light:   #3c3c3c;
  --border-mid:     #2f2f2f;
  --border-dark:    #1a1a1a;
  --border-deep:    #000000;

  --titlebar-bg-from: #0e3a5c;
  --titlebar-bg-to:   #0e639c;
  --titlebar-fg:      #ffffff;

  --accent:         #0e639c;
  --accent-hover:   #264f78;
  --accent-border:  #3794ff;

  --status-ok:      #4ec94e;
  --status-warn:    #d7b75d;
  --status-error:   #e06c75;
}
```

The 3D border *direction* never changes — raised stays raised, sunken stays
sunken. Only luminance flips.

### 3.3 Phosphor isolated

`--term-bg`, `--term-grn`, `--term-dim` stay untouched in both themes. The
canvas frame's outer bezel uses the new border variables so it reads as
"embedded inside chrome" in both modes.

## 4. 98.css overrides

`98.css` exposes its own CSS variables (`--surface`, `--button-highlight-light`,
`--button-shadow`, etc.). The dark theme overrides them inside the same
`[data-theme="dark"]` block:

```css
[data-theme="dark"] {
  --surface:                  #2b2b2b;
  --button-highlight-light:   #3c3c3c;
  --button-highlight:         #2f2f2f;
  --button-face:              #2b2b2b;
  --button-shadow:            #1a1a1a;
  --button-shadow-dark:       #000000;
  --dialog-blue:              #0e3a5c;
  --dialog-blue-light:        #0e639c;
  --window-frame:             #000000;
  --text-color:               #cccccc;
  /* ...complete list confirmed during implementation by reading 98.css */
}
```

The exact final list will be locked in by `grep`-ing `98.css` for `--`
declarations during implementation. The plan task explicitly checks this.

Title-bar control buttons (close / min / max) in `98.css` use embedded SVG
`background-image` URLs that are black-on-navy. In our app these buttons are
`tabindex=-1` decoration, so we accept that they look slightly washed out on
the darker title bar; no override needed.

## 5. Toggle UX

### 5.1 Button

A new chip-style button is added to `.menubar-info` (left of `#status`):

```html
<li class="menubar-info">
  <button id="themeToggle" class="theme-toggle"
          title="Toggle light/dark theme" aria-label="Toggle theme">☀</button>
  <span class="hint" …>drag·click·arrows·Del</span>
  <span id="status" class="toolbar-status">ready</span>
</li>
```

Glyph is `☀` when current theme is dark (click → switch to light) and `☾` when
current is light. Visual style reuses `.source-chip` (Win98 raised button,
22px tall, monospace font), so no new chrome variant needed.

### 5.2 Detection + persistence

On boot (`initTheme()` in `src/app/Theme.js`):

1. Read `localStorage.getItem('dspf-theme')`.
2. If present (`'light'` or `'dark'`): apply it.
3. If absent: read `matchMedia('(prefers-color-scheme: dark)').matches`;
   apply `'dark'` if true, else `'light'`. **Do not write to localStorage** —
   keep tracking the system preference until the user explicitly toggles.
4. Wire `#themeToggle` click: flip theme, write to `localStorage`, update glyph.
5. Wire `matchMedia(...).addEventListener('change', …)`: if localStorage is
   still empty, follow the system change live.

Applying a theme means setting `document.documentElement.dataset.theme` to
`'light'` or `'dark'`. The CSS selector `[data-theme="dark"]` then takes effect.

### 5.3 No FOUC

The light theme is the default in `:root`, so a slow `Theme.js` load would
briefly show light chrome before flipping to dark. To prevent this on dark
system preferences:

A tiny inline `<script>` in `<head>` (runs before stylesheets paint) reads
localStorage / `matchMedia` and sets `data-theme` on `<html>` synchronously.
`Theme.js` then takes over for the button wiring and live `matchMedia` updates.

```html
<script>
  (function () {
    var saved = localStorage.getItem('dspf-theme');
    var theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches
                          ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

## 6. Component-by-component review

| Component | Today | Dark treatment |
|---|---|---|
| `body` | `--w98-teal` desktop | `--bg-app` (`#181818`) |
| `.app-window` chrome | `--w98-face` raised | `--bg-chrome` raised |
| `.title-bar` | navy gradient + white text | `--titlebar-bg-from/to` solid blue, same text |
| `#menubar` | gray + bottom highlight | `--bg-chrome` + dark border |
| Menu dropdowns | white-on-gray, navy hover | `--bg-chrome` + `--accent-hover` |
| `#toolbar` | gray strip | `--bg-chrome` |
| `select` / `input` | 98.css default white | `--bg-input` + `--fg-text` (via 98.css var override) |
| `.panel.palette` / `.inspector` | raised + sunken well | same, dark palette |
| `.palette-item` | white bg, blue hover | `--bg-input` bg, `--accent-hover` hover |
| `.palette-item.palette-armed` | navy + dotted white | `--accent` + dotted `--fg-text` |
| `.palette-hint` (yellow tooltip) | `#ffffe1` | `--bg-tooltip` (`#3a3a1a`) |
| `.insp-section` (group box) | gray inset | dark inset |
| `.insp-tab` | raised, active merges | same logic, dark colors |
| `.insp-chip` | raised silver, pressed = inset | same logic, dark |
| `.insp-itemlist` listbox | white | `--bg-input` |
| `.insp-itemrow:focus` | navy bg | `--accent` bg |
| `.canvas-wrap` padding | `--w98-face` | `--bg-chrome` |
| `.canvas-frame` bezel | gray sunken | dark sunken (visible against `--bg-chrome`) |
| `.canvas-frame` interior | `--term-bg` | **unchanged** |
| `.resize-handle` | gray with dotted gripper | `--bg-chrome` + same dotted pattern (currentColor) |
| `.source-panel` chrome | gray + title bar | dark variants |
| `.cm-editor` | dark phosphor | **unchanged** |
| `#statusbar` | 98.css `.status-bar` | inherits from `--surface` override |
| Tag colors (`.tag-constant` etc.) | hardcoded `#0000c0`, `#008080`, `#006000`, `#a000a0` | brightened variants for dark legibility |

Tag colors are an exception worth highlighting: those four item-row tag classes
(`tag-constant` / `tag-sysvalue` / `tag-field` / `tag-hidden`) are the only
spots in the file with hardcoded foreground colors that don't read on a dark
background. They get a `[data-theme="dark"]` override block with brightened
hues:

```css
[data-theme="dark"] .insp-itemrow-tag.tag-constant { color: #6a9aff; }
[data-theme="dark"] .insp-itemrow-tag.tag-sysvalue { color: #5fd7d7; }
[data-theme="dark"] .insp-itemrow-tag.tag-field    { color: #87d787; }
[data-theme="dark"] .insp-itemrow-tag.tag-hidden   { color: #d787d7; }
```

Same treatment for `.insp-kw input` navy text and `.insp-kw .insp-kw-ind`
brown text (legibility on dark).

## 7. File changes

| File | Change |
|---|---|
| `styles.css` | Add semantic `:root` variables; replace direct `--w98-*` references with semantic ones throughout; add `[data-theme="dark"]` override block; add `.theme-toggle` chip styles. **No layout changes.** |
| `index.html` | Add inline `<script>` in `<head>` for no-FOUC theme application; add `#themeToggle` button inside `.menubar-info`. |
| `src/app/Theme.js` | **New file** — ~40 lines. Exports `initTheme()` wiring the toggle button and the `matchMedia` listener. |
| `src/main.js` | Import `Theme.js`; call `initTheme()` during boot (alongside existing init). |

No other JS module is touched. No model, parser, codegen, or canvas code changes.

## 8. Testing

This is a CSS-only change with a thin JS toggle. Tests are manual + visual.

**Smoke checklist:**

1. Open `index.html` with no `localStorage` and OS in light mode → light theme
   appears, button shows `☾`.
2. Same, with OS in dark mode → dark theme appears, button shows `☀`.
3. Click toggle → theme flips, `localStorage['dspf-theme']` written, glyph
   updates.
4. Reload → saved theme persists.
5. Clear `localStorage`, flip OS theme while page is open → theme follows live.
6. Click toggle once → theme stops following OS (saved override wins).
7. In dark mode: drag a palette item to canvas, open inspector, edit a
   keyword, expand source panel, open every menu, hover every chip. No
   illegible text, no missing borders, no white flashes.
8. Light mode pixel-diff against pre-refactor: identical. (Visual eyeball,
   no automated diff infra.)
9. Resize the source panel, collapse / expand it. Splitter gripper visible in
   both themes.
10. `wide-mode` (27×132) — toggle theme there too.

## 9. Risks

- **98.css internal hardcodes:** some 98.css selectors don't read variables.
  If we spot any during implementation, we override by selector inside
  `[data-theme="dark"]`. Mitigation: the implementation plan has an explicit
  "audit 98.css for non-variable colors" step.
- **CodeMirror panel borders:** the existing `.cm-panels-top` override removes
  98.css's panel border. Verify the ruler still has its bottom border in both
  themes (it's drawn manually, so should be fine).
- **Title-bar control buttons:** the SVG background-images are black on navy.
  In dark mode they'll be black on darker blue — still legible but slightly
  muddy. Accepted as a non-goal (buttons are decorative).

## 10. Open questions

None. Ready for implementation planning.
