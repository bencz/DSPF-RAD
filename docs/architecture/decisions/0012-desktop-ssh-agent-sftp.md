# 0012 — Desktop IBM i access through SSH and SFTP

## Status

Accepted and implemented.

## Context

The desktop IDE needs real IBM i sessions and IFS workspace storage without
persisting passwords, passphrases, or private keys in profile JSON, workspace
manifests, logs, or application cache. The browser build must continue to
expose no network transport.

## Decision

The Tauri backend owns SSH through pinned `ssh2`/libssh2 and exposes four
narrow commands: connect, disconnect, list ILE objects/members, read a converted
source member, read workspace, and write workspace.
Blocking SSH/SFTP work runs through Tauri's blocking executor rather than the
UI thread. Live `ssh2::Session` values remain in an in-memory Rust store and the
frontend receives only an opaque session UUID and non-secret IBM i metadata.

The supported authentication mechanisms are **SSH Agent** and a session-only
**password**. Password profiles store only the method: the reusable IDE secret
dialog asks on every connection, sends the secret to one Tauri authentication
request, clears the mutable UI buffer, and the Rust backend zeroizes its owned
buffer after the attempt. Authentication failures return a generic message and
never include the secret. JavaScript strings cannot provide a formal memory-
zeroization guarantee, so password retention and autofill are deliberately not
implemented. Direct private-key files and persisted secrets remain unsupported
until native credential-store integration exists.

Server identity validation is mandatory. The adapter reads the operating
system user's OpenSSH `~/.ssh/known_hosts`; unknown or mismatched host keys stop
the connection. IronTerm Studio does not silently trust a first connection.

Each live SSH session serializes access to a reusable SFTP subsystem. Operations
do not create competing SFTP channels; a command that requires an SSH exec
channel explicitly shuts down SFTP first and recreates it after the command.
This accommodates IBM i hosts with conservative per-session channel limits.

IFS workspace operations use SFTP and accept only absolute paths ending in
`.itworkspace`, without parent-directory traversal or backslashes. Manifests
are limited to 4 MiB. Publishing creates missing parent directories with user-
only permissions, writes a temporary file, and renames it over the destination.
SHA-256 content revisions provide optimistic conflict detection before a write.

JavaScript adapters implement `IbmiConnectionPort` and
`IbmiWorkspaceStoragePort` through Tauri `invoke`. Structured Rust errors cross
IPC; revision conflicts are reconstructed as
`IbmiWorkspaceRevisionConflictError`. The browser composition root continues
to select explicitly unavailable ports.

## Consequences

- Users use an identity in their normal SSH Agent or provide a password for the
  current attempt, and establish host trust through OpenSSH before connecting.
- Losing the workstation does not lose an IFS-backed workspace, but the local
  connection profile and host trust must be configured again.
- SSH commands, terminal streaming, source-member access, and builds require
  separate focused ports; they are not added to this workspace storage API.
- Persisted password/private-key support requires an OS credential-store
  adapter and will not be approximated with local storage.

## References

- [ssh2 Rust client and SFTP API](https://docs.rs/ssh2/latest/ssh2/)
- [Tauri commands and managed state](https://v2.tauri.app/develop/calling-rust/)
