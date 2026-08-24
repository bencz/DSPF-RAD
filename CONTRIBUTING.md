# Contributing to IronTerm Studio

Code organization is a product requirement. The IDE will cover many IBM i
domains, so a convenient shortcut today must not become permanent coupling.
All contributors and coding agents must first follow the product scope,
security boundaries, and working agreement in [`AGENTS.md`](AGENTS.md).

## Rules

- Put behavior in the narrowest domain or feature that owns it.
- Use classes for controllers, services, models, registries, adapters, and any
  component with state, dependencies, or a lifecycle. Class filenames use
  `PascalCase` and match the primary exported class.
- Keep setup/teardown inside explicit methods such as `start()` and `stop()`;
  do not scatter event listeners and mutable state across free functions.
- Use standalone functions only for small, deterministic transformations with
  no retained state, such as parsing, formatting, validation, and source
  generation. Group those functions by a single domain concept.
- Keep environment effects behind an injected platform contract.
- Keep core transformations deterministic and independent of the UI.
- Prefer cohesive modules with a small public surface. Split a file when it has
  multiple reasons to change; do not split it only to satisfy a line count.
- Avoid generic `utils`, `helpers`, `manager`, and `common` dumping grounds.
  Name modules after the concept or operation they implement.
- Avoid hidden mutable global state. The composition root owns construction and
  dependency injection.
- Do not import a concrete host from a feature. Import a contract or accept the
  required capability as a dependency.
- Preserve project formats, storage keys, and generated-code markers unless a
  migration path is included.
- Add engine-level tests for pure behavior. Browser automation is intentionally
  outside the current project scope.
- A change is complete only after `npm test` and `npm run build` pass.

The dependency rules and migration map are documented in
[`docs/architecture/README.md`](docs/architecture/README.md).
