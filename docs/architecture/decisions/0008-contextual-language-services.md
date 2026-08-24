# ADR 0008: Editor-independent contextual language services

- Status: accepted
- Date: 2026-08-24

## Context

IronTerm Studio must support RPGLE, CLLE, COBOL, SQL, DDS, command definitions,
panel groups, and other IBM i source types. Syntax highlighting and completion
cannot be implemented as disconnected editor callbacks or flat keyword lists.
The same analysis will be needed for diagnostics, navigation, build planning,
quick fixes, and project-wide references.

Language behavior must work offline but later accept object, member, command,
and release metadata from a connected IBM i.

## Decision

Language intelligence is independent from the editor:

- immutable language definitions map source member types and local extensions;
- a registry resolves language identity before an editor is created;
- source documents own text versions and save state;
- completion requests carry source, cursor offset, language, and invocation
  context without importing CodeMirror;
- the completion engine merges typed provider results deterministically;
- each language owns its grammar analyzer, catalogs, and semantic providers.

CL is the first contextual provider. It recognizes command, parameter, value,
comment, string, continuation, label, declared-variable, and nested-command
contexts. Its initial command catalog is structured and extensible rather than
presented as exhaustive.

## Consequences

- CodeMirror becomes an adapter over language services, not their owner.
- Unit tests exercise language behavior without a browser.
- Offline completion remains available for local work.
- Project indexes and connected IBM i metadata can add providers without
  changing core completion contracts.
- Each language still requires dedicated grammar, symbols, diagnostics, and
  catalog work; the shared engine does not pretend IBM i languages are alike.
