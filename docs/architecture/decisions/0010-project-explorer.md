# 0010 — Workbench Project Explorer

## Status

Accepted.

## Context

A general IBM i IDE needs one navigation surface for workspaces, local and
remote projects, open editors, and source members. The DSPF record navigator is
specialized design tooling and cannot become the project tree. Building the
Explorer into the Start Page would also make it disappear as soon as an editor
opens.

## Decision

The workbench owns a permanent Explorer region beside the editor region.
`WorkbenchAreaView` provides only those layout slots. `ProjectExplorerView`
owns its HTML, while `ProjectExplorerController` projects state from
`WorkspaceSession`, `SourceCodeDocumentService`, and
`WorkbenchDocumentService` into an interactive tree.

The Explorer does not own workspace, project, or document state. Activating a
project delegates to `Workspace`; activating an editor delegates to the
appropriate document service; toolbar actions execute registered workbench
commands. Nodes preserve expand/collapse state across model-driven renders.

A locally opened source document is associated with the workspace's active
project through `SourceDocument.projectId`. Sources whose project is no longer
part of the current workspace remain visible under **Loose Sources**. This is a
runtime editor association, not a claim that the browser can enumerate a local
directory. Future local-directory and IBM i member providers will supply
project source catalogs behind explicit platform ports.

## Consequences

- Explorer navigation remains available on the Start Page, in generic source
  editors, and in specialized designers.
- DSPF record navigation stays inside the DSPF feature.
- Browser limitations and future IBM i remote member discovery do not leak
  into the tree controller.
- UI rendering is deliberately not covered by browser automation; state and
  document contracts remain covered by focused Node tests.
