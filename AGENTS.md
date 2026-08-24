# IronTerm Studio agent guide

This file is the operational source of truth for coding agents working in this
repository. Read it before changing code. When a request is ambiguous, preserve
the product scope and architectural boundaries defined here.

## Product scope

IronTerm Studio is an offline-first, desktop-capable integrated development
environment for IBM i. It is not a DSPF-only RAD and must not be described or
architected as one.

The long-term product covers the complete IBM i development workflow:

- source editing for RPGLE, CLLE, COBOL, SQL, DDS, and related source types;
- source physical files, members, libraries, IFS files, and IBM i objects;
- project and workspace organization;
- build commands, compiler diagnostics, job logs, and deployment;
- 5250 terminal access and development-oriented command execution;
- remote system integration through a secure desktop host;
- specialized visual tools, including the existing DSPF designer.

The visual DSPF/DDS designer is the first mature feature and an important
module, but it does not define the product boundary. New shared workbench code
must use IBM i IDE terminology rather than DSPF-specific terminology.

## Product principles

1. **Offline first.** Local editing, workspace navigation, design, validation,
   and other applicable features must continue to work without a connection.
2. **Desktop capable.** Browser-safe features use platform contracts. Native
   filesystem, SSH, SFTP, process, credential, and terminal capabilities belong
   behind the Tauri/desktop host.
3. **IBM i aware.** Model IBM i concepts explicitly instead of forcing them
   into generic web-application abstractions.
4. **Organized by ownership.** Every behavior belongs to a clear domain,
   feature, workbench service, or platform adapter.
5. **Compatibility conscious.** Existing DSPF sources, RAD project files,
   generated protected regions, local-storage keys, and workspace manifests
   must remain readable unless an explicit migration is provided.
6. **Capability driven.** A feature asks the host what it supports. It does not
   infer its environment or scatter browser/desktop checks through the UI.
7. **Secure by construction.** Project and workspace files may reference a
   connection profile ID, but never contain passwords, tokens, passphrases,
   private keys, or other credentials.

## Architecture and dependency direction

Use these conceptual layers:

```text
app (composition root)
  -> platform implementations + workbench + features
workbench
  -> features and core contracts as needed
features
  -> core and platform contracts
core/domain transformations
  -> no UI, browser, Tauri, filesystem, network, or process dependencies
```

- `src/app` constructs objects and injects dependencies. Keep bootstrapping
  thin; do not put feature behavior in the composition root.
- `src/workbench` owns IDE-wide commands, menus, layout, editors, panels,
  status, workspace state, and shared shell behavior.
- `src/features/<feature>` owns one cohesive user capability. Examples include
  `dspf-designer`, `source-editor`, `ibmi-connections`, builds, object browsing,
  terminals, and diagnostics.
- Pure parsers, writers, validators, generators, and domain models must not
  depend on the DOM or a concrete host.
- `src/platform` defines environment boundaries and implements browser or
  desktop adapters. Features receive these capabilities through constructors.
- `src-tauri` is the native shell and trusted desktop boundary. Keep its
  permissions minimal and add capabilities only for implemented features.

Dependencies point inward. Never import a concrete browser/Tauri adapter from
a domain or feature module.

## Code organization and class policy

Classes are the default for application structure:

- use classes for controllers, services, stores, models, registries, adapters,
  coordinators, and anything with state, dependencies, invariants, or lifecycle;
- inject dependencies through constructors;
- use explicit lifecycle methods such as `start()`, `stop()`, `connect()`, and
  `dispose()` when the object owns listeners or resources;
- keep mutable state private where practical;
- name a class file in `PascalCase` after its primary exported class;
- keep each class cohesive and give it one clear reason to change.

Standalone functions are appropriate only for small, deterministic, stateless
transformations such as parsing, formatting, validation, source generation, or
immutable mapping. Do not create collections of unrelated free functions.

Avoid:

- generic `utils`, `helpers`, `common`, or catch-all `manager` modules;
- hidden mutable globals and service locators;
- event listeners with no clear owner or teardown path;
- direct DOM queries spread across domain logic;
- giant files that mix UI binding, persistence, transport, and domain rules;
- directory moves or abstractions that do not establish a useful boundary.

Use the language already used by the surrounding code. Public names and
product-facing copy are in English unless a specific localization task says
otherwise.

## UI direction

The shell is inspired by the productive density of Visual Studio 6 and the
Windows 98 visual language, while remaining an original and usable interface.
The target shell includes:

- command/menu bars at the top;
- project, member, object, and toolbox navigation on the left;
- tabbed editors and specialized designers in the center;
- properties and contextual tools on the right;
- output, problems, job log, build, and terminal panels at the bottom;
- connection, library, member, cursor, and build state in the status bar.

Do not hard-code the entire workbench around the DSPF canvas. Designers are
document/editor types hosted by the broader shell.

## IBM i connectivity and credentials

- Direct IBM i access is a desktop capability. The browser host must remain
  useful offline and must not pretend to provide SSH or native filesystem APIs.
- Keep transport behind explicit interfaces so SSH/SFTP can evolve without
  coupling workbench features to a particular library.
- Connection profiles contain only non-secret metadata such as host, port,
  username, authentication method, default library, and library list.
- Secrets belong in the operating-system credential store or another approved
  secure desktop provider. Never persist them in JSON, local storage,
  workspaces, autosaves, logs, generated source, or test fixtures.
- Validate host capabilities before enabling remote commands. Unsupported
  operations should be visibly disabled or return a clear typed error.
- Do not claim that connection, compile, deploy, terminal, or debug behavior is
  implemented until the corresponding desktop backend exists and is verified.

## Data formats and migrations

- Version persisted formats and validate them at their boundaries.
- Reject unknown incompatible versions with a useful error.
- Preserve forward migration paths for `.itworkspace`, RAD project data,
  connection-profile metadata, and generated protected regions.
- Keep portable IBM i source files independent from IDE-only metadata where
  possible.
- Never silently discard user-authored source or protected code regions.

## Testing and validation

Browser-driven and end-to-end browser tests are intentionally out of scope for
this project. Do not add Playwright, Cypress, Selenium, browser screenshot
tests, or equivalent infrastructure unless the project owner explicitly
changes this policy.

Add focused Node tests for pure behavior and stable contracts, including:

- parsers, writers, validators, and generators;
- versioned persistence models and migrations;
- command registries, controllers, and services using small injected fakes;
- platform contracts without launching a browser.

For normal JavaScript changes, completion requires:

```sh
npm test
npm run build
```

For desktop-shell or Rust changes, also run when system prerequisites exist:

```sh
npm run desktop:check
```

If the local machine lacks WebKit/Tauri system libraries, report that fact and
rely on the desktop CI job; do not weaken checks or install system packages
silently. Final generated RPGLE, COBOL, CL, SQL, or DDS acceptance that depends
on IBM i must be clearly identified as requiring a real IBM i compiler/runtime.

## Dependencies and implementation discipline

- Prefer the existing stack and platform APIs before adding a dependency.
- Pin direct dependency versions; update the lockfile with dependency changes.
- Keep the application runtime self-contained and free of CDN dependencies.
- Avoid speculative frameworks and infrastructure. Implement the narrowest
  durable contract needed for the next product capability.
- Do not add placeholder buttons that imply working functionality. If a future
  capability is visible, label or disable it honestly.
- Preserve accessibility, keyboard navigation, and useful behavior at the
  minimum supported window size.

## Desktop packaging and releases

- Tauri is the desktop host. Vite remains the shared frontend build.
- Release automation must produce Linux DEB/RPM/AppImage, Windows NSIS EXE/MSI,
  and macOS DMG/PKG artifacts where supported by CI runners.
- Release workflows are tag-driven and must run tests/build validation before
  publishing artifacts.
- Signing and notarization credentials belong only in CI secret storage.
- Keep application versions aligned across `package.json`, `src/product.js`,
  and `src-tauri/tauri.conf.json` when preparing a release.

## Working agreement for agents

Before editing:

1. Read this file, `CONTRIBUTING.md`, and the relevant architecture decision.
2. Inspect the current implementation and working tree; preserve unrelated
   user changes.
3. Identify the owning layer and reuse existing contracts/classes.

While editing:

1. Keep changes scoped and cohesive.
2. Use `apply_patch` for manual source edits.
3. Maintain class-based organization and constructor injection.
4. Add or update tests for domain behavior without adding browser automation.
5. Update documentation when changing an architectural contract, persisted
   format, security boundary, product scope, or release process.

Before handing off:

1. Run the relevant validation commands.
2. Review the diff for accidental scope changes, credentials, debug output, and
   stale DSPF-only product language.
3. State what was completed, what was verified, and any real external blocker.

Do not commit, push, create releases, delete material user data, or broaden
native permissions unless the user requested that action. When asked for a
commit message, use one concise line.

## Supporting documentation

- `CONTRIBUTING.md` contains concise contribution rules.
- `docs/architecture/README.md` describes dependency boundaries and migration.
- `docs/architecture/decisions/` records durable architectural decisions.
- `README.md` describes the product, current capabilities, and known limits.

