# V3 Expert 2 — React/Vite review

## Findings

- **HIGH:** The current generated React output is a shell that prints mapping data. It is not a complete mapped screen component tree.
- **HIGH:** Generated route manifest, field binding, and traceability artifacts must validate against their schemas. Binding output must preserve usage, value type, read-only, visibility, runtime key, DOM id, and status.
- **HIGH:** Main-controller preview currently consumes the older visual model. V3 must explicitly connect Semantic IR and Mapping Contract to the preview refresh path.
- **MEDIUM:** Generated-app Browser tests must be separate from main-controller tests and must cover route reload, field roles, hidden controls, diagnostics, responsive layout, and error states.

## Required plan changes

Separate main-controller preview acceptance from generated-app acceptance. Add clean-install Vite build, schema validation, no-designer-import check, full traceability, and generated-app Playwright gates.
