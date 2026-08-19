---
name: update-contract
description: This skill should be used when a user asks to change an existing API, data, architecture, frontend, backend, conversion, or integration contract and needs impact, compatibility, migration, and verification analysis.
---

# Update Contract

Update an existing contract without breaking its consumers silently. Read the current contract, identify all consumers, classify the change, record trade-offs, update the affected documents, and provide migration and verification evidence.

## Workflow

```text
read the current contract index and affected contract files
read the approved plan and decision records
find every named producer and consumer
classify the requested change
identify breaking and non-breaking impact
present options and trade-offs when the change is consequential
select or confirm the contract decision
update the contract and its examples
update compatibility and migration rules
run consumer and consistency checks
report paths, commands, and evidence
```

## Change classification

Classify each change as one of:

```text
non-breaking clarification
backward-compatible extension
behavior change
breaking contract change
deprecated contract
removed contract
```

Use the smallest safe classification. Do not call a breaking change a clarification.

## Impact analysis

Create an impact table before editing:

| Consumer | Current contract | Requested change | Impact | Migration |
|---|---|---|---|---|
| <consumer> | <current behavior> | <new behavior> | <severity> | <required action> |

Read the consumers from the repository. Use symbol-aware tools when available. Include:

- Existing code.
- Tests and fixtures.
- Generated templates.
- API examples.
- Deployment configuration.
- Documentation that names the contract.

## Option and trade-off rules

For a consequential change, present 2–4 options:

| Option | Benefit | Cost/Risk | Compatibility | Recommendation |
|---|---|---|---|---|
| A | <benefit> | <cost> | <impact> | <reason> |

Do not edit the contract until the owner selects an option, unless the user explicitly authorizes the conservative default. Record the selected option and rejected alternatives in the change log.

## Compatibility and migration

Every breaking or behavior-changing update must define:

- Contract version.
- Old behavior.
- New behavior.
- Migration steps.
- Compatibility window.
- Deprecation date or condition.
- Rollback path.
- Consumer verification.

Use expand–migrate–contract for wide changes:

```text
expand the contract with the new form
keep the old form working
migrate each consumer
run regression checks after each migration group
remove the old form only after no consumer remains
```

## ASD-STE100 output style

Write procedural text in clear ASD-STE100 style. Use one action per sentence. Put conditions before actions. Use active voice and simple verb forms.

Give complete context:

```text
Change the `CUSTOMER_ID` field contract that belongs to the `CUSTOMER` record, not the `CUSTOMER_HEADER` display label contract.
```

Give the reason:

```text
Keep the old response field during the migration because the version 1 client still reads that field.
```

Give evidence:

```text
Completed. Updated `contract/01-backend-interfaces.md`.
Failed. The consumer contract test returned exit code 1.
```

Use pseudocode for change workflow:

```text
read the current contract
read every consumer
classify the requested change
IF the change breaks a consumer:
    define a compatibility window
    because the consumer needs migration time
write the new contract version
update examples and migration notes
run consumer tests
report each changed path and command result
```

Preserve code, identifiers, paths, commands, and quoted logs exactly.

## Update rules

- Keep the contract index and links current.
- Update all examples that use the changed shape.
- Keep source identity, runtime identity, and DOM identity separate.
- Do not change implementation files unless the user asks for implementation.
- Do not delete the old contract before consumer migration is complete.
- Do not hide unresolved compatibility risk in prose.
- Mark inferred behavior as `[INFERENCE]`.

## Verification

Before delivery:

- Check that every consumer is listed or the search scope is recorded.
- Check that examples match the new contract.
- Check that tests cover the old and new behavior during migration.
- Check that errors and rollback behavior are defined.
- Check that version labels are consistent across files.
- Check that output paths exist.

## Final report

Report:

1. Current contract files read.
2. Consumers inspected.
3. Change classification.
4. Options and selected trade-off.
5. Contract files changed.
6. Migration and rollback steps.
7. Verification commands and evidence.
8. Remaining risks or owner decisions.
