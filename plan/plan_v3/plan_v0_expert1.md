# V3 Expert 1 — IBM i review

## Findings

- **BLOCKER:** The plan names `WCUSTSD2.DSPF`, but the current V3 input set may not contain that file or its `XAN4CDEM` PF/DD sources. Source closure must be a gate before conversion.
- **HIGH:** PF/LF indexing and REFFLD resolution are not fully integrated into Semantic IR. The index must support all encountered DDS types, including time fields.
- **HIGH:** SFL/SFLCTL, indicators, AIDs, WINDOW ownership, and RPGLE/CL runtime hints must be attached to IR. Standalone helpers are not sufficient.
- **HIGH:** Missing RPGLE/CL dependencies must block deployment and remain manual-review.

## Required plan changes

Add source manifest, dependency closure, zero-drop validation, complete SFL assembly, and focused fixtures for PF/LF, REFFLD, SFL, indicators, AIDs, WINDOW, RPGLE, and CL.

## Verification

Require every source object to have an explicit status and source location. Require unresolved external references to remain actionable manual review. Do not call helper existence semantic completeness.
