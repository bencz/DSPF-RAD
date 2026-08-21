# V3 Expert 3 — Spring Boot and QA review

## Findings

- **HIGH:** A contract-only Spring scaffold is not a runtime implementation. V3 needs live OpenAPI endpoint, session, authorization, transaction, error, idempotency, and audit evidence.
- **HIGH:** Idempotency needs atomic key scope, request fingerprint, replay behavior, and TTL rules.
- **HIGH:** Security needs deny-by-default authorization, session cookie/CSRF handling, and explicit 401/403/440 tests.
- **HIGH:** Approval, SoD, append-only audit, non-repudiation, revision invalidation, and deployment gate are not optional for deployable status.
- **MEDIUM:** Artifact receipts must include source, mapping, output hashes and reproducibility evidence.

## Required plan changes

Keep runtime-ready and deployable gates separate from preview/build gates. Require a real Spring build and live browser-to-API smoke test before runtime completion.
