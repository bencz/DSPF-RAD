# Contract Schemas

The normative request and response schemas are defined in `contract/openapi.yaml` under `components.schemas`.

The semantic conversion schemas are stored in this directory:

```text
identity.schema.json
record-relation.schema.json
sfl-runtime.schema.json
runtime-binding.schema.json
rpg-display-binding.schema.json
workflow-hint.schema.json
security.schema.json
diagnostic.schema.json
semantic-ir.schema.json
semantic-diagnostics.json
layout-policy.json
traceability.schema.json
```

Use this directory for standalone schema consumers. Update the related contract and verification evidence when a schema changes.
