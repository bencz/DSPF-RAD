# IronTerm Studio architecture

IronTerm Studio is evolving from the DSPF designer into an offline-first IBM i
development environment. The migration is incremental: stable DDS engine code
remains usable while the workbench and remote runtime are built around it.

## Dependency direction

```text
platform implementations ──┐
                          ├─> workbench ─> features ─> core
browser / desktop UI ─────┘
```

- `core` contains pure IBM i concepts and transformations. It must not access
  the DOM, browser storage, files, processes, SSH, or Tauri APIs.
- `features` coordinate one user capability, such as DSPF design, source
  editing, compilation, object browsing, or job-log diagnostics.
- `workbench` owns the IDE shell: commands, menus, panels, editors, status,
  layout, and shared application state.
- `platform` implements environment ports. Browser and desktop/Tauri details
  stay behind explicit contracts such as `HostBridge`.
- The composition root creates concrete implementations and injects them. In
  the current migration that root is `src/app/boot.js`; it must become smaller
  as feature controllers are extracted.

Dependencies point inward. Core never imports features, workbench, app, or
platform. A feature may depend on a platform contract, but never on a concrete
browser or desktop implementation.

## Current-to-target map

| Current area | Responsibility | Target boundary |
| --- | --- | --- |
| `src/model`, `parser`, `writer`, `validation`, `codegen`, `import` | Pure DDS/RPG/COBOL engine | `core` |
| `src/designer`, `palette`, `inspector`, `source` | DSPF visual tooling | `features/dspf-designer` |
| `src/app` | Composition and legacy UI controllers | split between features and workbench |
| `src/workbench` | New IDE shell controllers | workbench |
| `src/platform` | Browser/Tauri/IBM i effects | platform |

Moving directories is not a goal by itself. A module moves only when its public
contract is clear and its callers can be migrated without mixing unrelated
changes.

## Workbench direction

The shell follows the productive Visual Studio 6 model while remaining an
original implementation:

- menu and command bars at the top;
- project/object explorer and toolbox on the left;
- tabbed documents/designers in the center;
- properties and contextual tools on the right;
- output, problems, job log, and terminal panels at the bottom;
- active host, connection, library list, member, cursor, and build state in the
  status bar.

The layout is capability-driven. Unsupported desktop-only commands remain
unavailable in the browser host instead of leaking environment checks through
feature code.

## Remote IBM i boundary

The browser build remains useful offline and performs no direct SSH. A future
desktop host will implement SSH/SFTP, CL/PASE execution, member transfer, and
job-log retrieval. Credentials must be handled by the desktop platform and
must never enter project documents, local autosave, logs, or domain models.

See the architecture decisions in [`decisions`](decisions/) for the rationale
and constraints that must be preserved.
