# 0009 — Generic IBM i source-code editor

## Status

Accepted.

## Context

The original source pane is coupled to the visual DSPF document and cannot be
the central editor of a general IBM i IDE. RPG, COBOL, CL, SQL, DDS, commands,
panels, and future source types need the same document lifecycle without making
the workbench depend on CodeMirror or on one language implementation.

## Decision

IronTerm Studio provides a generic source-code feature with three boundaries:

- `SourceDocument` owns text, version, resource metadata, and the clean/dirty
  boundary;
- `SourceCodeDocumentService` projects source documents into immutable
  workbench document descriptors and owns activation and close order;
- `SourceCodeEditor` adapts CodeMirror to source documents and editor-independent
  language services, while `SourceCodeEditorController` owns commands, local
  file operations, tabs, save confirmation, and presentation state.

The first rich language adapter is CL/CLLE. Its syntax styling and contextual
completion consume the language-service layer and do not embed IBM i command
knowledge in the CodeMirror wrapper. Other registered IBM i source types open
as plain text until their language adapters are added.

Local open and save use `HostBridge`; the editor does not call browser or Tauri
file APIs. Remote member access will use a separate IBM i source-member port and
will create the same `SourceDocument` model.

## Consequences

- Editor tabs, dirty state, menus, shortcuts, and the Start Page share the
  workbench command and document infrastructure.
- A source document can move between local and remote providers without
  replacing the editor core.
- Language intelligence can be tested as pure services without browser-driven
  UI tests.
- Supporting a language means adding an adapter and providers, not another
  editor implementation.
