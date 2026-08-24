# Workbench UI controls

Shared controls live under `src/workbench/ui` and follow the same class-based
ownership rules as services and controllers. A shared control must solve an
IDE-wide interaction; feature-specific forms remain with their owning feature.

## Dialog service

`WorkbenchDialogService` exposes asynchronous prompt, confirm, and alert
operations. It serializes overlapping requests so only one modal owns focus.
`WorkbenchDialogView` owns the DOM and is the only layer that calls the native
`HTMLDialogElement` API.

Controllers receive the service through their constructor:

```js
const name = await this.dialogs.prompt({
    title: 'New workspace',
    message: 'Create a workspace for local and IBM i projects.',
    label: 'Workspace name',
    value: 'Untitled Workspace',
    acceptLabel: 'Create',
    maxLength: 80,
    validate: value => value.trim() ? '' : 'Enter a workspace name.',
});
```

Confirmation and alert content uses separate summary and detail fields:

```js
const discard = await this.dialogs.confirm({
    title: 'Unsaved workspace',
    message: 'Discard unsaved workspace changes?',
    detail: 'This cannot be recovered after another workspace is opened.',
    acceptLabel: 'Discard',
    danger: true,
});
```

Rules:

- never call `window.prompt`, `window.confirm`, or `window.alert`;
- await the result before mutating state;
- use `danger: true` only for destructive confirmation;
- keep the primary message short and place diagnostics in `detail`;
- return a validation message string from `validate`, or an empty string when
  the value is valid;
- do not add feature concepts or feature-specific fields to the shared view;
  create a feature-owned dialog when the interaction is a complex editor.

Node tests cover the service contract and queue. Browser automation remains out
of scope.
