# 07 Contract Conflict Decisions

## D-01 OpenAPI base path



**Conflict:** `servers.url` used `/api` while path examples also used `/api`.

**Decision:** Keep `servers.url: /api`. Define paths without the `/api` prefix.

```text
server URL: /api
path: /conversions
final URL: /api/conversions
```

**Reason:** The client and Spring Boot server must construct one stable URL.

**Verification:** Parse `contract/openapi.yaml` and count the declared paths.

## D-02 Design token source



**Conflict:** Documents referenced both `design/target_design.md` and `contract/target_design.md`.

**Decision:** Use `contract/target_design.md` as the contract-owned source.

**Reason:** The generated app contract and the MUI theme must consume one token source.

**Verification:** Search contract documents for the token path and check that the path exists.

## D-03 DOM identity format



**Conflict:** Examples used both `Z=XMG3tX` and `Z-XMG3tX`.

**Decision:** Use `Z-XMG3tX` for DOM ids. Keep `sourceIdentity`, `runtimeBindingKey`, and `businessName` separate.

**Reason:** The hyphen form is safe for HTML, CSS, and test selectors. The DOM id is not a business key.

**Verification:** Validate the identity schema pattern and compare every contract example.

## D-04 Semantic schema source



**Conflict:** Semantic schemas existed under the plan directory while contract files referenced a contract directory.

**Decision:** Use `contract/schemas/` as the source of truth. Keep plan files as design records that reference the contract files.

**Reason:** Consumers need one schema location. Duplicate schema copies can diverge.

**Verification:** Parse every schema in `contract/schemas/` and check plan references.

## D-05 Authentication contract



**Conflict:** API errors listed 401 and 403, but the API contract did not define the authentication method.

**Decision:** Use a Spring Security session cookie and a CSRF header for state-changing requests.

**Reason:** The generated browser app can use a secure server-managed session without storing a token in JavaScript storage.

**Verification:** Parse the OpenAPI security schemes and test unauthenticated, unauthorized, and expired-session responses.

## D-07 Normative source layering



**Decision:** Keep machine-readable schema, policy, rationale, and index files separate.

```text
schema → shape
policy → decision and release meaning
rationale → architecture explanation
README → source-of-truth index
```

**Reason:** Separate responsibilities reduce duplicate definitions and make changes easier to review.

## D-08 Runtime binding layering



**Decision:** Use `runtime-binding.schema.json` as the generic base and `rpg-display-binding.schema.json` as the RPG-specific extension.

**Reason:** A B2R example must not become a product-specific runtime design.

## D-09 SFL first-release boundary



**Decision:** Describe SFL runtime data and return `manual-review` when runtime rows or indicators are unavailable. Do not claim full SFL execution in the first release.

**Reason:** Static DSPF data cannot prove runtime page, row, scroll, or indicator state.

## D-06 Frontend schema ownership



**Conflict:** Component, field, route, Query, error, responsive, and accessibility rules were described only in prose.

**Decision:** Store their schemas and policies under `contract/frontend/`.

**Reason:** Generated React consumers need machine-readable component, field, and route contracts.

**Verification:** Parse the three frontend schemas and run the generated-app test matrix.

## D-10 Markdown SSOT

**Conflict:** Markdown, JSON schemas, and OpenAPI files can define the same rule in different forms.

**Decision:** Markdown contract files are the single source of truth. JSON schemas and OpenAPI files are derived machine-readable projections.

**Reason:** The system needs one location for meaning, defaults, ownership, and boundaries. Derived files must not create independent design decisions.

**Verification:** Compare every derived field and formula with its Markdown source. Stop implementation when a derived file disagrees with Markdown.

---
