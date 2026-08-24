# 0011 — Hybrid local and IBM i workspace persistence

## Status

Accepted.

## Context

A workspace stored only on one developer computer is not an adequate source of
truth. Hardware replacement, operating-system reinstall, or a second
workstation would otherwise lose or fragment the IDE's project organization.
At the same time, IBM i connectivity cannot be a prerequisite for opening the
IDE or continuing local work.

The workspace manifest is UTF-8 JSON. IBM i database members are
record-oriented, while an IFS stream file naturally stores an unstructured
document. The IFS is therefore the remote storage boundary for shared
`.itworkspace` manifests.

## Decision

Workspace persistence supports three related states:

- **IBM i-backed:** an IFS `.itworkspace` is the shared source of truth and an
  automatic local cache keeps the last usable snapshot;
- **local-file:** a developer explicitly opens or exports a local
  `.itworkspace`, with the automatic cache still enabled;
- **cache-only:** a new or detached workspace remains recoverable on the same
  installation until the user chooses local or IBM i-backed storage.

`WorkspaceStorageLocation` models local-file and IBM i IFS locations. Location,
active connection profile mapping, and remote revision are session/cache
metadata; they are not embedded in the portable `IRONTERM-WORKSPACE` manifest.
Credentials remain prohibited everywhere.

`WorkspaceCacheStore` keeps the last session snapshot, dirty state, location,
and revision in local application storage. `WorkspaceCacheController` updates
that cache whenever the workspace session changes. The cache improves startup
and disconnected operation, but it is not a durable substitute for an IBM i
or exported local copy.

Remote access uses the focused `IbmiWorkspaceStoragePort`. It exchanges UTF-8
manifest text and an opaque revision using an already established IBM i
session ID. The desktop adapter uses SFTP internally. Writes carry
the expected revision; a mismatch must raise
`IbmiWorkspaceRevisionConflictError` instead of silently overwriting another
developer's changes.

## Consequences

- A cached IBM i-backed workspace can open while disconnected and synchronize
  after reconnecting.
- Reinstalling a workstation loses only its cache and profile mapping, not the
  IFS workspace; the user reconnects and selects the remote path again.
- The browser remains honest: it can cache and export local work, while its IBM
  i workspace port reports unavailable.
- The desktop enables remote open, publish, and synchronization only after a
  real authenticated IBM i session exists.
- Conflict resolution can later offer reload, compare, merge, or save-copy
  actions without changing the storage contract.

## References

- [IBM i stream files](https://www.ibm.com/docs/en/i/7.5.0?topic=concepts-stream-file)
- [What the IBM i integrated file system is](https://www.ibm.com/docs/en/i/7.6.0?topic=system-what-integrated-file-is)
