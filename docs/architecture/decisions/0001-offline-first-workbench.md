# ADR 0001: Offline-first workbench

- Status: accepted
- Date: 2026-08-24

## Context

The original browser page loaded editor and UI dependencies from public CDNs.
The expanded IDE must start without internet access and later connect only to
systems explicitly selected by the user.

## Decision

Runtime dependencies are pinned in `package-lock.json` and bundled locally with
Vite. The web build is the common frontend. Desktop packaging and IBM i access
will be added around that frontend instead of forking the UI.

Offline-first means that local design, parsing, validation, generation, and
project editing work without a network. It does not imply silent caching of IBM
i credentials or remote members.

Workspace manifests are a deliberate exception to “remote data is not silently
cached”: the last workspace session is non-secret IDE metadata and is cached so
an IBM i-backed workspace can open offline. The canonical remote copy and its
revision follow ADR 0011; no authentication material enters the cache.

## Consequences

- Development requires Node and `npm install`.
- Release artifacts contain the runtime JavaScript and CSS they use.
- Remote capabilities must expose explicit disconnected and unavailable states.
- A later installable web build may add a service worker, but correctness cannot
  depend on a CDN or on a previously warmed HTTP cache.
