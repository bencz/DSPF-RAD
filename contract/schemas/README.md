# Contract Schemas

Machine-readable projections of the Markdown SSOT. The Markdown documents own meaning; these files must not introduce new rules. On conflict: fix the Markdown first (see `contract/README.md` SSOT policy).

## Core conversion

```text
semantic-ir.schema.json        DspfSemanticIR shape
identity.schema.json           sourceIdentity / runtimeBindingKey / domId / businessName
record-relation.schema.json    record classification and owner edges
sfl-runtime.schema.json        SFL contract-only runtime data
layout-policy.json             layout formulas and packing policy
diagnostic.schema.json         diagnostic item shape
semantic-diagnostics.json      status meanings and severity policy
traceability.schema.json       source-to-target traceability entry
```

## Generated app frontend

```text
field-binding.schema.json      field value, usage, validation, UI binding
route-manifest.schema.json     generated route manifest
component-state.schema.json    interactive component states
```

## Seed extraction

```text
runtime-binding.schema.json       generic binding base
rpg-display-binding.schema.json   RPG-specific extension fields
workflow-hint.schema.json         EXFMT/WRITE display workflow hints
```

Normative request/response schemas for the seed API live in `contract/openapi.yaml` under `components.schemas`.

Update the related Markdown document and verification evidence whenever a schema changes.
