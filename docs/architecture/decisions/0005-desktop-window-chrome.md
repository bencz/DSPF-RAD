# ADR 0005: Desktop window chrome is owned by the application

- Status: accepted
- Date: 2026-08-24

## Context

The workbench already has a Visual Studio 6/Windows 98-inspired title bar. When
Tauri also renders operating-system decorations, the desktop shows two title
bars and wastes vertical space.

The custom appearance must not discard expected desktop behavior: moving,
resizing, minimizing, maximizing/restoring, closing, and double-click maximize
must continue through the operating-system window.

## Decision

The main Tauri window uses `decorations: false` while remaining resizable and
retaining its native shadow. `DesktopWindowController`, a concrete Tauri
platform controller, binds the application title bar to the current native
window. It delegates drag, minimize, toggle-maximize, and close operations to
the Tauri window API.

The native controls are hidden in browser mode. The controller performs no
Tauri operation unless the Tauri runtime is present. Tauri window permissions
are limited to the four operations required by this chrome.

## Consequences

- The desktop presents one cohesive title bar instead of nested decorations.
- Native resize and window-manager placement remain enabled by Tauri.
- Browser behavior is unchanged and does not expose non-functional controls.
- Platform-specific window behavior stays outside workbench features.
- Fully custom macOS chrome does not inherit every native macOS title-bar menu
  and alignment convenience; this is an accepted tradeoff for the shared IDE
  visual language.
