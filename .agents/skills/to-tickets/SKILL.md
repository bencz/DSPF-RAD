---
name: to-tickets
description: This skill should be used after to-plan produces an approved refined plan. It converts the actual refined plan path, regardless of filename, plus its decisions, expert findings, dependencies, release gates, and acceptance criteria into executable tracer-bullet tickets with blocking edges, then asks for approval before publishing local files or tracker issues.
disable-model-invocation: true
---

# To Tickets

Convert an approved `to-plan` result into dependency-ordered, end-to-end implementation tickets. Treat the supplied refined plan path as the contract and preserve its decisions, gates, risks, non-goals, and verification requirements.

## Output Style: ASD-STE100

Write ticket instructions in clear ASD-STE100 style. Use one action per sentence. Put the condition before the action. Use active voice and simple verb forms.

Give every ticket statement complete context. Name the owner, source object, target object, and affected artifact. Do not write an unqualified "it", "this", or object name.

Use this form:

```text
Move the variable `CUSTOMER_ID` that belongs to the `CUSTOMER` record to the `CUSTOMER_HEADER` component.
```

Do not write:

```text
Move it to the header.
```

Give the reason for each important action. State the risk or the dependency.

```text
Block the `CUSTOMER_HEADER` ticket on the symbol-map ticket because the generated component must preserve the variable owner.
```

Give evidence after each completed or failed ticket operation.

```text
Completed. Wrote `plan/plan_v1/plan_v0.1_ticket.md`.
Failed. The generated app build returned exit code 1.
```

Use pseudocode for dependency and ticket workflow descriptions:

```text
read the refined plan
read the linked expert reports
build the ticket dependency graph
FOR each ticket:
    add the plan source
    add the complete user outcome
    add the blockers
    add acceptance criteria and verification
    add the reason for each blocking edge
ASK the owner to approve the ticket order
write the ticket document after approval
```

Use the same style in ticket titles, acceptance criteria, blocker descriptions, local ticket files, tracker issues, and the final report. Preserve code, paths, identifiers, commands, and quoted logs exactly.

## Handoff Contract from `to-plan`

`plan_v0.1.md` is an example name, not a required filename. Resolve the actual refined plan path supplied by the user or produced by `to-plan`, for example:

```text
updating_plan_v2.1.md
plan/plan_v1/plan_v0.1.md
feature-name-plan.md
```

Use the refined plan as the single authoritative input. Expert reports and decision files are supporting evidence when they exist; do not require a fixed filename for them.

When the refined plan is stored in a versioned directory, keep the ticket result beside it:

```text
plan/plan_v1/
├── plan_v0.1.md
└── plan_v0.1_ticket.md
```

The default local output is one complete, dependency-ordered ticket document:

```text
<plan-directory>/<refined-plan-stem>_ticket.md
```

For example:

```text
plan/plan_v1/plan_v0.1_ticket.md
```

This single file contains the ticket index, dependency graph, ticket definitions, acceptance criteria, verification, risks, and remaining owner decisions. Split it into one file per ticket only when the user explicitly asks for separate local files or a tracker requires independent issues.

If split output is requested, use:

```text
plan/plan_v1/tickets/01-<slug>.md
plan/plan_v1/tickets/02-<slug>.md
```

For a skill-owned plan, use the same convention below the skill folder only when explicitly requested:

```text
.agents/skills/to-plan/plan_v1/plan_v0.1_ticket.md
```

Follow an explicitly supplied output path over these defaults.

## Process

### 1. Gather and validate the handoff

Read the complete refined plan and all available linked decision/review files. Confirm:

- The plan has locked decisions or explicitly marked open decisions.
- Expert failures are labeled as unavailable evidence.
- Each named requirement has an artifact and acceptance criterion.
- Release gates and regression gates are present.
- Non-goals and rollback boundaries are visible.

Stop and report a planning blocker when no approved/refined plan exists. Do not turn raw notes into tickets silently; send the work back through `to-plan` unless the user explicitly overrides this rule.

Build a handoff table:

| Plan element | Ticket consequence |
|---|---|
| Locked decision | Implement exactly; do not reopen in a ticket |
| Expert blocker | Add a prerequisite or resolution ticket |
| Expert edge case | Add acceptance coverage or an explicit non-goal |
| Release gate | Add to the relevant ticket and final integration ticket |
| Open owner decision | Add a decision ticket before dependent implementation |
| Non-goal | Do not create a ticket unless the plan explicitly schedules it |

### 2. Explore the codebase

Read only the affected areas needed to make tickets realistic. Use project domain vocabulary and respect existing architecture decisions. Identify:

- Current behavior that must remain unchanged.
- Existing tests and fixtures that form the regression baseline.
- Integration boundaries and ownership.
- Data contracts consumed by each slice.
- Any prefactor required before the first feature slice.

Do not turn every file into a ticket. A ticket describes an observable vertical outcome; implementation paths belong in the plan or acceptance notes only when necessary to remove ambiguity.

### 3. Create the dependency graph

Represent every ticket as a node with explicit blockers. Build edges only for genuine prerequisites:

```text
existing behavior baseline
  → contracts / schema
  → identity / references
  → pure core logic
  → adapters
  → UI or API surfaces
  → generated artifacts
  → external integration
  → governance / production hardening
```

Do not block a ticket on work it does not consume. Do not hide a dependency in prose. Detect cycles before presenting the list.

Use expand–migrate–contract for wide refactors:

1. Expand with a compatible form beside the old form.
2. Migrate callers in bounded batches.
3. Contract only after all callers and tests migrate.

### Acceptance and Test Requirement

Write acceptance conditions and tests in the same operation that creates each ticket. Do not create a ticket with a later test placeholder.

Each ticket must define:

- The necessary preconditions.
- The observable behavior.
- The pass condition.
- The failure condition that blocks completion.
- The test type.
- The test command or scenario.
- The regression check when existing behavior is affected.

Use this form:

```markdown
**Necessary conditions:**
- The contract ticket is complete.
- The test fixture exists.

**Acceptance criteria:**
- [ ] The user can perform the complete action.
- [ ] The system reports the defined error when the required condition is false.

**Tests:**
- Unit/contract: `<test command or test file>` proves the core rule.
- Integration: `<test command or scenario>` proves the boundary.
- E2E: `<browser scenario>` proves the user outcome, when a UI exists.
- Regression: `<existing test or fixture>` proves that old behavior remains unchanged.

**Pass condition:**
All listed tests pass and every acceptance criterion has evidence.

**Failure condition:**
Any required test fails, any acceptance criterion lacks evidence, or any regression occurs.
```

Write a test for every new observable contract. Use a contract test for API or schema work. Use a pure-function test for deterministic logic. Use an integration test for module boundaries. Use a Playwright test for critical browser behavior. Use the existing regression suite when the ticket touches current behavior.

Block the next ticket on the complete acceptance and test evidence, not only on code availability.


### 4. Draft tracer-bullet tickets

Each ticket must be a narrow but complete vertical slice:

- Cross the required layers for one observable behavior.
- Be demoable or verifiable on its own.
- Fit in one fresh context window.
- Include regression protection when it touches existing behavior.
- Avoid placeholders, speculative infrastructure, or tickets that only create scaffolding.

A ticket may be a foundation slice when it establishes a real contract or safety gate consumed by later slices. Label it as a contract or safety ticket and give it a direct acceptance test.

Use this shape:

```markdown
# <NN> — <Ticket title>

**Plan source:** <plan path and section>

**What to build:**
<Observable end-to-end result.>

**Blocked by:**
<ticket numbers/titles, or None — can start immediately>

**Decision contract:**
<Locked decisions this ticket must preserve.>

**Acceptance criteria:**
- [ ] <observable behavior>
- [ ] <error, edge, or regression behavior>
- [ ] <test or evidence>

**Verification:**
<exact test, browser scenario, contract check, or report evidence>

**Non-goals:**
<nearby work intentionally excluded>

**Risk notes:**
<relevant expert finding or rollback concern>

**Status:** ready-for-agent
```

Avoid layer-only titles such as "Add database table" when the slice should deliver a user-visible or contract-visible behavior. Prefer "Persist conversion revision and show its approval status" when that is the actual outcome.

### 5. Preserve expert review findings

For each `BLOCKER` or `HIGH` finding:

- Resolve it in a prerequisite ticket, or
- Add it as an acceptance criterion on the affected ticket, or
- Record a plan-approved deferral with owner and risk.

Do not silently drop expert findings because they do not fit a convenient slice. A failed expert agent is not evidence that the risk is absent.

### 6. Quiz the owner before publishing

Present the proposed breakdown as a numbered list. For every ticket show:

- Title.
- Blocked by.
- What it delivers.
- Key decision contract.
- Verification.

Ask:

- Does the granularity feel right: too coarse or too fine?
- Are the blocking edges genuine?
- Should any tickets merge or split?
- Are open decision tickets placed before their consumers?
- Are regression and release gates visible at the correct points?

Iterate until the owner approves the breakdown. Do not publish or mark tickets ready before approval.

### 7. Publish approved tickets

Use the configured tracker when one exists. For the default local workflow, write one complete ticket document beside the refined plan:

```text
<plan-directory>/<refined-plan-stem>_ticket.md
```

For example:

```text
plan/plan_v1/plan_v0.1_ticket.md
```

This document must contain the ticket index, dependency graph, ticket definitions, acceptance criteria, verification, risks, and remaining owner decisions. If the user explicitly requests independent files or a tracker requires independent issues, additionally split the approved tickets in dependency order:

```text
<plan-directory>/tickets/01-<slug>.md
<plan-directory>/tickets/02-<slug>.md
```

Never replace the primary refined plan. Keep the ticket result separate and link it from the final report. Use native blocking relationships on a real tracker when supported; otherwise retain a clear `Blocked by` section.

Apply `ready-for-agent` only to tickets whose blockers are complete or absent. Decision, contract, and safety tickets can be ready first. Do not close or modify a parent issue unless explicitly instructed.

## Ticket Quality Gates

Before publishing, verify:

- Every ticket maps to a plan section.
- Every plan requirement maps to one or more tickets.
- Every ticket has a real acceptance criterion.
- Every ticket has explicit blockers or `None`.
- The dependency graph is acyclic.
- Existing behavior has a regression ticket or gate.
- Expert blockers are resolved, gated, or explicitly deferred.
- Unsupported behavior and manual review have tickets where relevant.
- No ticket claims production readiness without the plan's security/governance gates.
- The final integration ticket runs the complete verification suite.

## Final Report

Report:

1. Plan path and version consumed.
2. Expert reports consumed and unavailable reports.
3. Number of tickets and dependency layers.
4. Decisions preserved.
5. Regression gates included.
6. Published ticket paths or tracker identifiers.
7. Remaining blockers and owner decisions.

Keep claims evidence-based. Do not claim tickets were published when only a draft breakdown was created.
