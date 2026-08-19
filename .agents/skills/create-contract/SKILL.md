---
name: create-contract
description: This skill should be used when a user asks to create API, data, architecture, frontend, backend, conversion, or integration contract documents from requirements, plans, source code, or domain rules.
---

# Create Contract

Create a versioned, evidence-based contract document set. Define boundaries before implementation. Separate observed behavior, selected decisions, inferred rules, and unresolved owner decisions.

## Workflow

```text
read the named requirements and existing plans
read repository rules and affected source
record observed facts with evidence
identify consumers and ownership boundaries
write the contract index
write high-level system design
write data and API interfaces
write abstract mapping rules
write frontend/backend file templates
run consistency checks
report output paths and evidence
```

## Required input analysis

Read:

- User requirements.
- Approved refined plan.
- Existing architecture documents.
- Existing source and tests at affected boundaries.
- Existing API, schema, or file contracts.

Build this table before writing:

| Category | Content |
|---|---|
| Observed | Confirmed behavior with path or command evidence |
| Decided | Explicit owner decision |
| Inferred | Reasoned conclusion marked `[INFERENCE]` |
| Unknown | Owner decision or expert review required |

## Contract set

Create a contract directory with an index and separated documents:

```text
contract/
├── README.md
├── 00-system-design.md
├── 01-backend-interfaces.md
├── 02-backend-file-template.md
├── 03-conversion-rules.md
├── 04-frontend-design-system.md
└── 05-frontend-file-template.md
```

Use the sections that apply. Keep the index authoritative for links and ownership.

## Contract requirements

Define:

- System purpose and boundaries.
- Module ownership and forbidden responsibilities.
- Input/output data shapes.
- Identity and version rules.
- Error, retry, security, and audit boundaries.
- Frontend state ownership.
- Backend service ownership.
- File and package templates.
- Lossiness and unsupported behavior.
- Acceptance and verification gates.

Do not define an implementation detail as a contract unless a consumer depends on it. Do not make a generated file template promise an implementation that the API contract cannot support.

## ASD-STE100 output style

Write instructions in clear ASD-STE100 style. Use one action per sentence. Put conditions before actions. Use active voice and simple verb forms.

Give each action complete context:

```text
Move the variable `CUSTOMER_ID` that belongs to the `CUSTOMER` record to the `CUSTOMER_HEADER` component.
```

Give the reason:

```text
Keep the source owner in the symbol map because the generated component must preserve reference scope.
```

Give evidence:

```text
Completed. Wrote `contract/01-backend-interfaces.md`.
Failed. The contract consistency check returned exit code 1.
```

Use pseudocode for workflows:

```text
read the approved plan
read the current implementation
map each requirement to a contract
IF a consumer depends on a value:
    define the value and its error state
    because the consumer must not guess the value
write the contract files
run the consistency checks
report every output path
```

Preserve code, identifiers, paths, commands, and quoted logs exactly.

## Verification

Before delivery:

- Check that every requirement maps to a contract section.
- Check that every contract has an owner.
- Check that producer and consumer names match.
- Check that examples match the declared schema.
- Check that error states are defined.
- Check that version and compatibility rules exist.
- Check that unsupported behavior has an explicit status.
- Check that output paths exist.

## Final report

Report:

1. Source documents read.
2. Contract files written.
3. Decisions recorded.
4. Unresolved owner decisions.
5. Verification commands and evidence.
6. Inferred statements, if any.
