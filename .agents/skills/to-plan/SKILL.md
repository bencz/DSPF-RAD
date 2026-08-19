---
name: to-plan
description: This skill should be used when a user asks to turn raw requirements, notes, existing plans, or architecture concerns into a feasible implementation plan. It produces plan_v0, runs a structured multi-domain expert review, presents options with trade-offs and recommendations, then produces a strongly ordered plan_v0.1 with dependencies, gates, risks, and verification criteria.
---

# To Plan

## Purpose

Turn incomplete or conflicting requirements into an executable, reviewable plan without starting implementation prematurely. Preserve existing behavior, expose uncertainty, use domain experts for independent review, and make task order explicit.

## Trigger Conditions

Use this skill when the request includes one or more of:

- "make a plan", "整理計劃", "design a solution", or "write an implementation plan".
- Multiple requirements, tickets, decisions, or existing plan documents.
- A request to find blind spots, edge cases, conflicts, or trade-offs before coding.
- A request to consult domain experts or run a multi-agent review.
- A request to produce `plan_v0.md`, `plan_v0_expertX.md`, or `plan_v0.1.md`.

## Operating Rules

- Read existing plans, reports, architecture docs, repository rules, and affected source before drafting.
- Separate observed facts, user decisions, recommendations, and unresolved questions.
- Do not implement product changes while the planning workflow is active unless the user explicitly requests implementation.
- Treat existing behavior as a contract. Record regression risks and protection tests before proposing changes.
- Prefer the smallest architecture that satisfies the requirements.
- Do not claim expert agreement when an agent fails, returns incomplete output, or lacks evidence.
- Mark unavailable expert reviews and continue with a clearly labeled architecture synthesis when possible.
- Use domain-specific agents for independent reviews. Do not give every agent the same generic prompt.
- Ask only decisions that materially change architecture, cost, risk, or delivery order. Resolve minor choices with repository conventions.
- Never silently resolve a conflict between user requirements. Present the conflict, options, trade-offs, and recommendation.
- Keep plan documents concise enough to execute but complete enough to test.

## Output Style: ASD-STE100

Write procedural instructions in clear ASD-STE100 style. Use one action per sentence. Put the condition before the action. Use active voice and simple verb forms.

Give every action complete context. Name the owner, source object, target object, and affected artifact. Do not use an unqualified pronoun or object name.

Use this form:

```text
Move the variable `CUSTOMER_ID` that belongs to the `CUSTOMER` record to the `CUSTOMER_HEADER` component.
```

Do not write:

```text
Move it to the header.
```

Give a reason after each action. State the cause or the risk.

```text
Keep the source record owner in the symbol map because the generated component must preserve reference scope.
```

Give evidence after each completed or failed operation.

```text
Completed. Wrote the plan to `plan/plan_v1/plan_v1.md`.
Failed. `npm test` returned exit code 1.
```

Use pseudocode to describe the plan workflow. Keep pseudocode implementation-neutral and include the reason for each gate.

```text
FOR each requirement:
    read the named source documents
    record the observed fact and its evidence
    IF the requirement changes an existing contract:
        add a regression gate
        because existing behavior must remain unchanged
    add the requirement to the decision matrix

draft plan_v0
run the expert review
record each expert result beside the plan
resolve options and trade-offs with the owner
write plan_v0.1
```

Use the same style in decision tables, expert handoffs, acceptance criteria, ticket descriptions, and final reports. Preserve code, paths, identifiers, commands, and quoted logs exactly.

## Mandatory Five Questions Before Planning

Ask these five questions before drafting `plan_v0.md`. Use repository evidence to prefill known answers. Ask the owner to confirm each answer or correct it.

1. **Outcome:** What observable result must the delivered system produce, and who uses that result?
2. **Scope:** What must this version include, and what must this version exclude?
3. **Contract:** Which existing behavior, API, data shape, or compatibility rule must not change?
4. **Constraints:** Which runtime, platform, security, data, integration, budget, or timeline constraints limit the design?
5. **Acceptance:** Which scenario proves that the work is complete, and which failure or edge case must block release?

Use this response format:

```markdown
## Five Core Questions

1. **Outcome:** <answer and evidence>
2. **Scope:** <in-scope and out-of-scope>
3. **Contract:** <existing behavior to preserve>
4. **Constraints:** <technical, security, integration, and delivery constraints>
5. **Acceptance:** <success scenario, failure gate, and test evidence>
```

Do not draft architecture or task order until the owner confirms these five answers. If the owner cannot answer a question, record it as an explicit planning blocker and do not hide the uncertainty in an implementation task.

## Workflow

### Phase 0: Establish scope and evidence

1. Identify the requested deliverable names and exact output paths.
2. Read all named existing documents.
3. Read repository rules and relevant skills.
4. Inspect affected architecture and current tests.
5. Build an evidence table:

| Category | Record |
|---|---|
| Observed | Directly confirmed in files or tool output |
| Decided | Explicitly selected by the user |
| Inferred | Reasonable conclusion; label `[INFERENCE]` |
| Unknown | Requires owner decision or expert review |

6. Separate completed work from new scope.

### Phase 1: Draft `plan_v0.md`

Write a feasibility-first draft containing:

1. Problem and goal.
2. In-scope and out-of-scope behavior.
3. Existing architecture and constraints.
4. Proposed architecture and data flow.
5. Domain model or contracts.
6. UI and integration surfaces.
7. Implementation phases and dependencies.
8. Verification strategy.
9. Risks, edge cases, and rollback boundaries.
10. Open decisions.

Make `plan_v0.md` descriptive, not final. Preserve alternatives where evidence is incomplete. Do not hide major trade-offs behind a single implementation choice.

### Phase 2: Conduct the expert meeting

Select agents by domain, not by convenience. Typical reviewers:

- Domain specialist: IBM i, banking, healthcare, manufacturing, or the relevant business domain.
- Platform specialist: Java/Spring Boot, Node, cloud, database, or security engineer.
- Delivery specialist: React, testing, QA, SRE, accessibility, or data architect.

For each expert prompt, provide:

- The complete plan path.
- Relevant existing source paths.
- The review scope and explicit non-goals.
- Required severity labels.
- Required output sections.
- Read-only/no-edit instruction.

Run independent expert reviews in parallel by default. If the provider cannot safely handle concurrent tool-enabled agents, start them sequentially with a short delay and record that execution mode. Never confuse an API scheduling failure with a domain review result.

Save each successful report as:

```text
plan_v0_expert1.md
plan_v0_expert2.md
plan_v0_expert3.md
```

Use the naming index consistently. If an agent fails, save a failure note only when requested by the project convention; otherwise report the failure in the final synthesis and do not fabricate a report.

### Phase 3: Synthesize decisions

Read every successful expert report. Create a decision matrix:

| Decision | Option | Benefit | Cost/Risk | Evidence | Recommendation | Owner decision |
|---|---|---|---|---|---|---|

Classify findings:

- `BLOCKER`: plan cannot safely proceed.
- `HIGH`: likely defect, security issue, or major rework.
- `MEDIUM`: important edge case or maintainability risk.
- `LOW`: polish or later optimization.

For each conflict:

1. Quote the conflicting requirements or plan sections.
2. Explain the impact.
3. Offer 2–4 concrete options.
4. State trade-offs.
5. Give a recommendation grounded in the repository and user goal.
6. Ask the owner only if the choice is materially consequential.

For each blind spot:

1. Name the missing contract.
2. Give a concrete failure scenario.
3. Identify the affected artifact.
4. Add a mitigation or a plan task.
5. Add a verification method.

### Phase 4: Confirm preferences and verify feasibility

Present only the unresolved, high-impact decisions to the user. Use short options with trade-off descriptions. Do not ask for information already available from the repository.

After the user decides:

1. Update the decision matrix.
2. Check that selected options do not conflict with existing contracts.
3. Reorder tasks by dependency, risk, and feedback value.
4. Confirm every named requirement has an owner, artifact, and acceptance check.
5. Confirm every blocker is resolved or explicitly deferred.

### Phase 5: Write `plan_v0.1.md`

Write the refined plan with:

- Locked decisions and rejected alternatives.
- Architecture diagram and module boundaries.
- Explicit data contracts and ownership rules.
- Dependency-ordered task waves.
- Per-task acceptance criteria.
- Regression and integration gates.
- Expert findings mapped to plan changes.
- Rollback and non-goals.
- Remaining open decisions.

Use a dependency order similar to:

```
existing behavior baseline
→ contracts and semantic model
→ identity and references
→ pure core logic
→ adapters
→ UI surfaces
→ generated artifacts
→ external service integration
→ governance and production hardening
```

Do not place UI polish, export packaging, or production backend work before the core contract they consume.

## Plan Artifact Storage

Store reusable plan templates and skill-specific plan artifacts inside this skill folder:

```text
.agents/skills/to-plan/
├── SKILL.md
├── references/
└── plan_v1/
    ├── plan_v1.md
    ├── plan_v1_expert1.md
    ├── plan_v1_expert2.md
    └── plan_v1_decisions.md
```

Keep the primary template or skill-owned plan at:

```text
.agents/skills/to-plan/plan_v1/plan_v1.md
```

Store expert reports beside the primary plan, not in temporary agent directories. Keep failed-agent notes separate from successful reports and label them as unavailable evidence. Create the next skill-owned version in a new directory rather than overwriting the previous plan:

```text
.agents/skills/to-plan/plan_v1/
.agents/skills/to-plan/plan_v2/
```

When a user explicitly requests a project-specific plan path, follow that path instead of the skill folder. For reusable templates and skill examples, use the skill folder convention above. Record source documents, decisions, expert status, verification evidence, and unresolved questions in the primary plan. Link related reports with relative paths.


## Required Plan Quality Checks

Before finalizing `plan_v0.1.md`, check:

- Every user requirement appears once with a clear scope.
- Every selected option has a trade-off and reason.
- Every expert finding is accepted, rejected with reason, or deferred.
- Existing behavior has a regression gate.
- New code has a contract test or observable acceptance check.
- Source identity, runtime identity, and DOM identity are not conflated.
- Conversion or migration lossiness is reported, not hidden.
- Unsupported behavior produces an explicit status, not a fake success.
- Task order follows dependencies and risk.
- No plan section promises implementation that the current contracts cannot support.

## Final Report Format

When reporting completion, state:

1. Files read.
2. `plan_v0.md` path.
3. Expert agents requested, completed, or failed.
4. Expert report paths.
5. Major decisions and trade-offs.
6. `plan_v0.1.md` path.
7. Verification performed.
8. Remaining owner decisions or blockers.

Keep claims evidence-based. Mark inference explicitly.