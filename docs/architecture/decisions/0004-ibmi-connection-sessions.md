# ADR 0004: IBM i connections use a focused session port

- Status: accepted
- Date: 2026-08-24

## Context

The IDE needs remote IBM i sessions, but filesystem dialogs, SSH transport,
credential retrieval, commands, member transfer, terminals, and build jobs do
not form one cohesive host API. Placing all of them on `HostBridge` would create
an untyped platform catch-all and couple features to a transport implementation.

The browser build must also remain honest: it can edit local sources but cannot
securely provide native SSH or operating-system credential storage.

## Decision

IBM i connection lifecycle uses the focused `IbmiConnectionPort`. The port only
opens and closes sessions. A concrete desktop adapter owns transport;
connection features receive the port through the composition root.

`IbmiConnectionService` owns the explicit disconnected, connecting, connected,
disconnecting, and failed states. A successful adapter response is validated
and converted into an immutable `IbmiConnectionSession`. Session metadata may
contain system, release, job, current-library, and library-list information but
must never contain credentials.

The browser platform receives `UnavailableIbmiConnectionPort`. Commands remain
disabled and the status bar reports that IBM i connectivity is unavailable;
the frontend does not simulate a connection.

Workspace projects reference connection profile IDs. Profiles store non-secret
endpoint metadata and a source-member CCSID policy (`*FILE` or a validated
numeric override). Sessions are transient and are never serialized into the
workspace or local profile store.

The first concrete desktop adapter is recorded in ADR 0012. It keeps live SSH
sessions in the Rust backend, requires OpenSSH host-key verification, and uses
SSH Agent or session-only password authentication. Password values are never
part of profiles and are discarded after each attempt. Persisted credentials
and direct private-key files remain unavailable until native credential-store
support exists. The browser still receives the unavailable port described
above.

## Consequences

- SSH libraries and Tauri commands cannot leak into workbench or feature code.
- Desktop transport can evolve without changing session consumers.
- IBM i commands, member access, terminals, and build execution will use their
  own focused ports and reference an established session ID.
- Removing a transport does not change the workspace manifest.
- Adapter results containing credential-shaped fields are rejected.
