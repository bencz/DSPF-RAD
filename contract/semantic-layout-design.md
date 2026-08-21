# Semantic Layout Conversion Design

## 1. Purpose



This design defines the semantic conversion boundary between the existing `DspfDocument` and the Modern React layout.

The design protects the existing parser, model, writer, Canvas, React faithful preview, Inspector, and source synchronization.

The conversion layer reads the existing document. The conversion layer does not mutate the existing document.

## Normative source boundary



This document explains architecture and rationale. It does not redefine machine-readable fields or formulas. Use these normative sources for implementation:

```text
Semantic IR shape       → contract/schemas/semantic-ir.schema.json
Identity shape          → contract/schemas/identity.schema.json
Relation shape          → contract/schemas/record-relation.schema.json
Layout formula          → contract/schemas/layout-policy.json
Diagnostic shape        → contract/schemas/diagnostic.schema.json
Diagnostic policy       → contract/schemas/semantic-diagnostics.json
Traceability shape      → contract/schemas/traceability.schema.json
```

If this document conflicts with a schema, the schema is authoritative. Update this rationale document after the schema change because the explanation must remain consistent with the implementation contract.

## 2. Conversion flow



```text
DSPF source
    ↓
parseDspf()
    ↓
DspfDocument
    ↓ read-only adapter
DspfSemanticIR
    ↓ profile resolver
DisplayProfile
    ↓ identity and reference graph
Semantic relations
    ↓ capability classification
Conversion diagnostics
    ↓ layout policy
ModernLayoutModel
    ↓
binding map + React components + report
```

## 3. Existing model boundary



The existing model remains the design source:

```text
src/model/DspfDocument.js
src/model/factories.js
src/model/keywords.js
```

The conversion layer must not call:

```text
doc.updateItem()
doc.addItem()
doc.removeItem()
doc.adopt()
doc.emit()
```

The conversion layer must not change:

```text
item.id
record.type
record.keywords
activeRecordIndex
```

## 4. Semantic IR



```text
DspfSemanticIR
├── schemaVersion
├── sourceRevision
├── displayProfile
├── recordFormats
├── recordRelations
├── fields
├── symbols
├── references
├── indicators
├── aids
├── windows
├── subfiles
├── menus
├── messages
├── cursor
├── capabilities
└── diagnostics
```

### Required identity layers

Keep these identities separate:

```text
sourceIdentity       source object and occurrence
runtimeBindingKey    runtime payload key
DOM id               HTML/React selector
businessName         business-level name
```

Use a qualified source identity:

```text
project:revision:record:field:occurrence:role
```

Do not use a bare field name as a global key. Do not use a DOM id as a business key.

## 5. Display profile



Resolve the display profile before layout conversion:

```text
24x80 → rows=24, cols=80
27x132 → rows=27, cols=132
unknown → manual-review
```

The conversion core must resolve DSPSIZ itself. The conversion core must not depend on the file-open UI to select the model.

## 6. Record relations



Classify records before generating components or routes:

```text
RECORD
WINDOW
SFL
SFLCTL
MNUBAR
PULLDOWN
message record
```

Build relations for:

```text
WINDOW parent/child
SFLCTL → SFL
MNUBAR → PULLDOWN
REFFLD
CHCCTL
```

Do not treat every record as a route. Do not treat every record name as a business workflow.

## 7. Semantic field model



Each field must preserve:

```text
sourceIdentity
record
name
role
row
col
length
dataType
decimals
usage
indicators
keywords
references
runtimeCapability
conversionStatus
```

`usage` values must preserve the parser vocabulary, including `I`, `O`, `B`, `H`, `P`, and `M` when present.

## 8. Layout policy



```text
sourceCols = displayProfile.cols
sourceCol = clamp(item.col, 1, sourceCols)
sourceLength = effectiveLength(item)
targetCol = floor((sourceCol - 1) / sourceCols * 12) + 1
plannedSpan = clamp(round(sourceLength / sourceCols * 12), 1, 12)
actualSpan = clamp(plannedSpan, 1, 13 - targetCol)
```

Preserve both source and target geometry:

```text
sourceRow
sourceCol
sourceLength
sourceRecord
windowOffset
targetRow
targetCol
plannedSpan
actualSpan
lossiness
```

The mapper must process items in source reading order. The mapper must report overlap, crop, reflow, or row overflow.

The default policy is `manual-review` when the target layout changes reading order or hides source geometry.

## 9. Capability classification



Every object or action receives one status:

```text
converted
converted-with-warning
manual-review
unsupported
error
```

The capability matrix must cover:

```text
CHOICE
CHCCTL
CA
CF
ENTER
MNUBARCHC
PULLDOWN
PSHBTNCHC
SFL runtime
WINDOW runtime
indicator state
cursor state
message state
```

Unsupported actions must not generate executable handlers.

## 10. Traceability



Each generated object must link back to its source object:

```json
{
  "sourceIdentity": "project:R1:record:SIGNON:field:USER:occurrence:12",
  "source": {
    "record": "SIGNON",
    "row": 2,
    "col": 3,
    "length": 40
  },
  "target": {
    "file": "src/screens/Signon.jsx",
    "component": "ConvertedField",
    "targetRow": 2,
    "targetCol": 1,
    "span": 6,
    "domId": "Z-XMG3tX"
  },
  "status": "converted",
  "lossiness": []
}
```

## 11. Regression contract



Run these checks before and after conversion:

```text
parse → write → parse round-trip
DspfDocument snapshot before/after IR build
Canvas parity
React faithful preview parity
source synchronization
selection synchronization
```

A conversion test fails when the conversion layer changes the existing document or changes an existing faithful preview result.

---
