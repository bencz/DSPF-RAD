# Expert Review Rubric

## Required report sections

```markdown
# <Domain> Expert Review

## Executive summary
## Blockers
## Blind spots
## Edge cases
## Conflicts
## Recommended plan changes
## Questions requiring owner decision
## Prioritized actions
```

Classify every finding as `BLOCKER`, `HIGH`, `MEDIUM`, or `LOW`.

## Review dimensions

### Domain correctness

- Terminology and domain lifecycle.
- Missing domain states or relationships.
- Invalid assumptions from UI structure.
- Unsupported or lossy conversions.

### Contract correctness

- Input/output shapes.
- Ownership and identity.
- Versioning and compatibility.
- Error and retry behavior.
- Security and authorization boundaries.

### Integration safety

- Existing behavior that must not change.
- Side effects and mutation paths.
- Data flow loops.
- Migration and rollback.
- Test seams and observable acceptance criteria.

### Operational readiness

- Logging and traceability.
- Audit and retention.
- Failure recovery.
- Deployment and configuration.
- Manual review requirements.

## Finding format

Use this shape for every finding:

```markdown
### [HIGH] Short finding title

- **Plan evidence:** section or exact wording.
- **Failure scenario:** concrete input or runtime path.
- **Affected artifact:** file, module, API, or workflow.
- **Recommendation:** exact plan change.
- **Verification:** test, gate, or observable check.
```

## Synthesis rules

- Combine duplicate findings while preserving each domain's evidence.
- Keep domain-specific concerns separate from cross-cutting architecture decisions.
- Treat a failed agent as unavailable evidence, not as a clean review.
- Convert accepted findings into tasks with dependencies and acceptance criteria.
- Convert rejected findings into a decision record with reason and risk owner.
- Put unresolved high-impact questions in the final owner decision list.