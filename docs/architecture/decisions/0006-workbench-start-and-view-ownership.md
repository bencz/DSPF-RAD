# ADR 0006: Start Page and feature-owned workbench views

- Status: accepted
- Date: 2026-08-24

## Context

The original application rendered the complete DSPF designer directly in
`index.html` and seeded a demonstration document during startup. That was
reasonable for a single-purpose RAD, but it makes the DSPF canvas the implicit
root of a broader IBM i IDE. It also mixes shell chrome, startup navigation,
specialized editor controls, feature dialogs, and document metadata in one
file.

The IDE needs to start before any particular source type or designer is active,
and future RPGLE, CLLE, COBOL, SQL, terminal, build, and object-browser
features need the same document host without inheriting DSPF dependencies.

## Decision

IronTerm Studio starts on a Start Page when there is no recoverable document.
The Start Page exposes real registered commands for workspace and DSPF
operations. A recovered DSPF opens directly because restoring user work has
priority over the neutral startup state.

`WorkbenchDocumentService` owns immutable document descriptors, the active
document, and the last active document. Specialized models integrate through
feature coordinators. The shell switches contextual surfaces based on the
active document kind.

The workbench also owns the shared editor tab strip. It renders every
`WorkbenchDocumentService` descriptor, so generic source documents and
specialized designers remain visible and navigable in the same place. Feature
controllers retain responsibility for safe close behavior such as dirty-source
confirmation; the tab controller delegates instead of discarding feature state
directly.

The DSPF designer is a shared specialized surface, not a singleton document.
`DspfDocumentCoordinator` owns one `DspfEditorSession` per open resource and
restores the selected session into the long-lived designer model. Each session
preserves its model, dirty boundary, undo/redo history, resource identity, and
read-only state. A resource index activates an existing tab when the same IBM i
member is selected again.

Markup ownership matches runtime ownership:

- `index.html` contains metadata, the `#app` host, and the module entry only;
- `WorkbenchShellView` owns the IDE chrome template;
- `StartPageView` owns the neutral startup template;
- `DspfEditorView` owns the DSPF surface and its dialogs;
- `WorkbenchView` composes those views before controllers bind DOM elements.

CSS is layered through an import-only root stylesheet. Shared tokens and base
typography are independent from shell, Start Page, and DSPF-specific rules.
Normal UI text uses a readable antialiased font stack; pixel styling remains an
intentional accent rather than the default.

## Consequences

- Opening the IDE no longer implies opening or generating a DSPF document.
- DSPF controls and status fields are contextual to the DSPF editor.
- New editor kinds can add their own view, coordinator, commands, and styles
  without modifying the static HTML root.
- A specialized designer cannot disappear from the tab strip merely because a
  generic source editor is active.
- Multiple DSPF members remain open independently without constructing a full
  canvas, inspector, and source editor for every tab.
- The last active editor can be revisited from the Start Page.
- UI tests remain focused on stable services/controllers with injected fakes;
  no browser automation is introduced.
- The classic-theme stylesheet remains a compatibility layer while selectors
  are incrementally moved into their owning shell or feature modules.
