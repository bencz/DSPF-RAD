# ADR 0002: Isolate environment access behind HostBridge

- Status: accepted
- Date: 2026-08-24

## Context

Browser file pickers, desktop filesystem access, SSH/SFTP, and IBM i command
execution have different security and runtime constraints. Direct calls from UI
features would couple the IDE to one host and scatter capability checks.

## Decision

All environment effects needed by features pass through `HostBridge` or a
smaller port introduced beside it. Concrete implementations live only under
`src/platform` and are selected by the composition root.

Every host publishes capabilities. Calling an unsupported operation produces a
structured `UnsupportedHostOperationError`; feature code can therefore present
a consistent unavailable state.

## Consequences

- Browser and desktop behavior can be tested and evolved independently.
- Features receive dependencies rather than importing global DOM/Tauri APIs.
- New operations require a deliberate contract and capability name.
- `HostBridge` must not grow into an untyped catch-all; large cohesive areas
  such as terminal sessions or workspace storage should become focused ports.
