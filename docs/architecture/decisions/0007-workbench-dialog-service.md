# ADR 0007: Workbench-owned reusable dialogs

- Status: accepted
- Date: 2026-08-24

## Context

Browser-native prompts, confirmations, and alerts display browser branding,
ignore the IDE theme, provide inconsistent spacing, and cannot express
structured diagnostics or destructive-action emphasis. Direct calls were also
spread across workspace, DSPF, inspector, generation, recovery, and About
flows.

The IDE needs reusable controls without introducing a UI framework or coupling
domain behavior to DOM construction.

## Decision

The workbench owns a class-based dialog component with two responsibilities:

- `WorkbenchDialogService` provides asynchronous `prompt`, `confirm`, and
  `alert` operations and serializes overlapping requests;
- `WorkbenchDialogView` owns the reusable HTML template, modal lifecycle,
  initial focus, selection, Escape/cancel behavior, validation feedback, and
  Visual Studio 6/Win98 presentation.

Controllers receive the service through constructor injection. Dialog results
are awaited before state changes. Direct calls to browser-native `prompt`,
`confirm`, and `alert` are prohibited in application code.

Complex editors such as the DSPF template assistant and database-field importer
remain feature-owned dialogs. They may reuse shared tokens but do not expand
the generic prompt/confirm component with feature-specific behavior.

## Consequences

- Browser and desktop hosts present the same themed dialog experience.
- Dialog requests can include a short message, scrollable details, explicit
  action labels, destructive emphasis, input constraints, and validation.
- Only one reusable modal owns focus at a time.
- Controllers become asynchronous where user confirmation is required.
- The service contract is tested with injected views in Node; no browser
  automation is introduced.
