# ADR 0003: Workspace manifests contain references, not secrets

- Status: accepted
- Date: 2026-08-24

## Context

The IDE needs to group local sources, scratch designs, and IBM i libraries. A
workspace will be shared and versioned, while IBM i authentication belongs to a
specific user's machine.

## Decision

The `IRONTERM-WORKSPACE` manifest stores project identity, kind, root URI, and
an optional connection-profile identifier. It never stores passwords, tokens,
passphrases, private keys, or other credentials.

Connection profiles are separate platform data. A desktop host may place their
secrets in an operating-system credential store; a workspace only references
the non-secret profile ID.

The place where the manifest itself is stored is also separate metadata. A
local file name or IBM i IFS path, its local connection-profile mapping, and an
opaque remote revision belong to `WorkspaceSession` and its cache, not inside
the portable manifest. See ADR 0011.

DSPF design state and generated source also remain separate from the workspace.
The manifest organizes projects; it is not a catch-all persistence container.

## Consequences

- Workspace files can be versioned without disclosing authentication material.
- Missing profiles are represented as disconnected projects and can be mapped
  to another local profile.
- New project kinds require an explicit schema evolution.
- Arbitrary settings and feature state must not be added to the manifest without
  a dedicated, versioned contract.
