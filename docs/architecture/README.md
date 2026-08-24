# IronTerm Studio architecture

IronTerm Studio is an offline-first integrated development environment for the
complete IBM i development workflow. Its workbench is designed to host source
editors, builds, diagnostics, object and member navigation, terminals, remote
system integration, and specialized designers. The existing DSPF designer is
the first mature specialized feature, not the boundary of the product.

The migration is incremental: stable DDS engine code remains usable while the
general-purpose workbench and desktop runtime are built around explicit
contracts.

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
  layout, versioned workspace manifests, and shared application state.
- `platform` implements environment ports. Browser and desktop/Tauri details
  stay behind explicit contracts such as `HostBridge` and
  `IbmiConnectionPort`.
- Desktop window decoration is implemented by `DesktopWindowController`; the
  workbench never calls the Tauri window API directly.
- The composition root creates concrete implementations and injects them. In
  the current migration that root is the `IronTermApplication` class;
  `src/app/boot.js` is only its error boundary and entry point.
- `WorkbenchView` composes feature-owned views before controllers start.
  `index.html` contains only document metadata and the `#app` mount point;
  workbench and feature markup must not be added back to that root file.

Dependencies point inward. Core never imports features, workbench, app, or
platform. A feature may depend on a platform contract, but never on a concrete
browser or desktop implementation.

## Code shape

Stateful application behavior is class-based. Controllers own event bindings
and lifecycle, services own integrations, models protect invariants, and
registries own discovery and dispatch. Dependencies enter through constructors;
classes do not discover concrete hosts implicitly.

Standalone functions are reserved for pure transformations where a class would
add no state or invariant: parsers, writers, validators, formatters, and code
generators. This keeps both human and automated maintenance localized without
turning domain algorithms into artificial objects.

## Current-to-target map

| Current area | Responsibility | Target boundary |
| --- | --- | --- |
| `src/model`, `parser`, `writer`, `validation`, `codegen`, `import` | Pure DDS/RPG/COBOL engine | `core` |
| `src/designer`, `palette`, `inspector`, `source` | DSPF visual tooling | `features/dspf-designer` |
| `src/app` | Composition and legacy UI controllers | split between features and workbench |
| `src/workbench` | New IDE shell controllers | workbench |
| `src/platform` | Browser/Tauri/IBM i effects | platform |
| `src/features/ibmi-objects` | ILE library/object/member catalog | feature |
| `src/workbench/shell`, `start`, `views` | Shell, Start Page, view composition | workbench |
| `src/workbench/layout`, `explorer` | Persistent IDE regions and project navigation | workbench |
| `src/features/dspf-designer/*.html, *.css` | DSPF-only editor surface | DSPF designer feature |

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

The workbench starts with no active editor and renders the Start Page. A
`WorkbenchDocumentService` owns immutable editor descriptors, current
activation, and last-active-editor navigation. A specialized feature publishes
its state through a coordinator; for example, `DspfDocumentCoordinator`
projects DSPF model title and dirty state into a workbench document without
making the shell depend on the DSPF model.

`WorkbenchEditorTabsController` renders those descriptors as IDE-wide tabs.
The tab strip therefore includes both generic source editors and specialized
designers; close operations are delegated to the owning feature so dirty-state
and replacement rules remain intact.

The visual DSPF canvas is reused across tabs, while `DspfDocumentCoordinator`
maintains an independent `DspfEditorSession` for every open display-file
resource. Switching tabs captures and restores the complete design session,
including undo/redo and dirty state. Resource-URI indexing makes repeated Tree
selections activate the existing document instead of duplicating it.

Presentation follows the same ownership boundaries. `styles.css` is an import
manifest: shared tokens and base typography load around the classic-theme
compatibility layer, followed by shell, Start Page, and feature styles. New
selectors belong to the narrowest owning module. The pixel-style font is
limited to intentional brand/terminal accents; ordinary menus, hints, forms,
panels, and status text use the readable antialiased UI stack.

Reusable IDE controls belong under `src/workbench/ui`. The first shared control
is the dialog system: `WorkbenchDialogService` is the application-facing
asynchronous API and owns request serialization, while `WorkbenchDialogView`
owns markup, focus, keyboard cancellation, validation feedback, and result
resolution. Features receive the service through constructor injection and
must not call browser-native `prompt`, `confirm`, or `alert`.

See [UI controls](ui-controls.md) for usage and extension rules.

Language intelligence lives under `src/languages`, independent from
CodeMirror and from remote transport. `IbmiLanguageRegistry` resolves IBM i
member types and local extensions; `ContextualCompletionEngine` combines
language providers; language-specific analyzers determine lexical, syntactic,
and semantic context. The generic `SourceDocument` model belongs to the
source-code feature and publishes dirty/version state without owning an editor.

See [language services](language-services.md) for the staged intelligence model.

The generic source editor lives under `src/features/source-code`. Its document
model and document service own lifecycle and workbench projection; its
CodeMirror adapter owns editing mechanics; and its controller owns commands
and host-mediated local file operations. The original DSPF source pane
remains inside the specialized visual designer and is not the generic IDE
editor. See [decision 0009](decisions/0009-generic-source-code-editor.md).

The persistent Project Explorer is a projection of workspace, document, and
ILE catalog services, not another source of application state. Its
view/controller lives under `src/workbench/explorer`, while `WorkbenchAreaView`
only supplies the Explorer and editor layout regions. Open local sources are
associated with the active project. IBM i projects expand through the injected
`IbmiObjectCatalog`, which lists typed library objects and source members without
turning the workbench into an SFTP file browser. See
[decision 0010](decisions/0010-project-explorer.md) and
[decision 0013](decisions/0013-ile-object-catalog.md).

One IBM i project represents one library, but a workspace may attach multiple
libraries from the same profile and browse them concurrently. Layout ownership
remains separate: `WorkbenchAreaController` handles the accessible Explorer
splitter and its workstation-local width preference, while the Explorer
controller remains concerned only with navigation state.

Remote member reads publish their in-flight state to the Explorer and status
bar, and duplicate opens of one member share the same pending operation. This
is especially important because native member-to-stream-file conversion can be
noticeably slower than opening a local document.

## Remote IBM i boundary

The browser build remains useful offline and performs no direct SSH. It uses an
explicitly unavailable IBM i connection port, so connection commands remain
disabled rather than simulating a remote session.

The connection lifecycle is modeled by `IbmiConnectionService` and immutable
`IbmiConnectionSession` metadata. The Tauri adapter implements real SSH Agent
and session-only password sessions with mandatory OpenSSH `known_hosts`
verification; live transport objects stay in the Rust backend. Each session
serializes operations and reuses one SFTP subsystem so IBM i channel limits do
not race concurrent Explorer requests. The first ILE catalog port lists
library objects through the native `QSYS.LIB` namespace and retrieves member
names plus authoritative source types through native `DSPFD` metadata. `DSPF`
members route to the visual designer; other member types resolve through the
language registry. CL/PASE execution, conflict-aware member writes, terminal
streams, builds, and job-log retrieval will use additional focused ports tied
to an established session instead of growing `HostBridge` into a catch-all.

Source members are not decoded as raw SFTP files. The desktop backend stages a
`CPYTOSTMF` conversion as private UTF-8/LF text, reads it through SFTP, removes
the staging file, and returns a content revision. The selected editor opens
that document read-only; remote writes wait for a conflict-aware reverse
conversion contract.

The connection profile normally requests `DBFCCSID(*FILE)`, preserving the
source physical file's authoritative CCSID. A validated numeric
`sourceCcsid` override is available for legacy files whose stored bytes do not
match that metadata. The value is non-secret profile metadata, is validated in
both JavaScript and Rust, and is the only value allowed to enter the
`DBFCCSID(...)` command parameter.

Workspace persistence is hybrid. `WorkspaceCacheStore` automatically retains
the last session for offline startup, while `WorkspaceStorageLocation` records
whether the current durable target is a local file or an IBM i IFS stream file.
`IbmiWorkspaceStoragePort` is the focused remote boundary and carries opaque
revisions for conflict-aware writes. Storage location and revision remain
outside the portable workspace manifest. The browser receives an explicitly
unavailable implementation; the desktop uses the SFTP adapter described in
[decision 0012](decisions/0012-desktop-ssh-agent-sftp.md). See also
[decision 0011](decisions/0011-hybrid-workspace-persistence.md).

IFS persistence and ILE projects are deliberately separate. IFS holds portable
workspace manifests and stream-file resources; an ILE project identifies a
library as `ibmi://<profile>/<library>` and navigates native objects through
`IbmiObjectBrowserPort`. See
[decision 0013](decisions/0013-ile-object-catalog.md).

Credentials must be handled by the desktop platform and must never enter
project documents, local autosave/cache, logs, session metadata, or domain
models.

See the architecture decisions in [`decisions`](decisions/) for the rationale
and constraints that must be preserved.
