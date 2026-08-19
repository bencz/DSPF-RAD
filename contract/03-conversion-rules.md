# 03 Abstract Conversion Rules

## 1. Conversion status

Every source object receives one status:

```text
converted
converted-with-warning
manual-review
unsupported
error
```

A source object cannot disappear without a status and a reason.

## 2. Semantic IR rule

```text
DspfDocument
  → read-only semantic adapter
  → DspfSemanticIR
```

The adapter must not mutate the document. The IR must include `schemaVersion`, `sourceRevision`, and `converterVersion`.

## 3. Display profile rule

```text
IF DSPSIZ resolves to 24x80:
    sourceCols = 80
ELSE IF DSPSIZ resolves to 27x132:
    sourceCols = 132
ELSE:
    status = manual-review
    do not assume 80 columns
```

## 4. Source identity rule

Use separate identities:

```text
sourceIdentity
runtimeBindingKey
domId
businessName
```

Use a qualified source identity:

```text
project:revision:record:field:occurrence:role
```

Do not use a bare field name as a global key. Do not use a DOM id as a business key.

## 5. Reference rule

Build graph edges for:

```text
REFFLD
CHCCTL
MNUBARCHC → PULLDOWN
WINDOW parent/child
SFLCTL → SFL
```

If a reference does not resolve, create a manual-review item. Do not write a placeholder as a successful type or validation result.

## 6. Layout rule

```text
sourceCols = displayProfile.cols
sourceLength = effectiveLength(item)
sourceColumn = clamp(item.col, 1, sourceCols)
targetCol = floor((sourceColumn - 1) / sourceCols * 12) + 1
plannedSpan = clamp(round(sourceLength / sourceCols * 12), 1, 12)
actualSpan = clamp(plannedSpan, 1, 13 - targetCol)
```

Preserve these values:

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

## 7. Packing rule

Process items in source reading order. Keep items on the same target row when the target span fits.

If the next item does not fit, apply the selected policy:

```text
wrap
compress
manual-review
```

The default policy is `manual-review` for overlap or a changed reading order. Do not silently move a field to another row.

## 8. Record relation rule

Do not treat every DSPF record as a route.

Classify records as:

```text
display-record
window
subfile-template
subfile-control
menu-bar
pulldown
message-record
```

Store owner and relation edges before generating routes or components.

## 9. OPTION and FUNCTION rule

Classify an action by semantic capability, not only by component kind.

```text
source object
command identity
AID
record target
resource target
row/page scope
permission
isDestructive
confirmation
idempotency
```

If the action target or AID cannot be resolved, return `manual-review` or `unsupported`.

## 10. Faithful preview rule

The conversion rules must not modify the faithful Canvas or React preview. Converted layout can differ from 5250 geometry, but the report must show the difference.
