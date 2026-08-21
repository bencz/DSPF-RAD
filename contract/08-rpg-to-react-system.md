# 08 RPG/RPGLE to React System Contract

## 1. Purpose



This contract defines how an external RPG or RPGLE source supplies runtime display values and workflow hints to a DSPF-to-React conversion.

This contract does not define a complete RPGLE compiler. This contract does not execute RPGLE. This contract does not define banking authorization or transaction authority.

## 2. System flow



```text
DSPF source
PF/DD source
RPG/RPGLE source
conversion profile
    ↓
DSPF Semantic IR
    ↓
external runtime binding adapter
    ↓
RuntimeBindingIR
    ↓
React field values, controls, messages, and workflow hints
    ↓
Generated React app
    ↓
Spring Boot runtime contract
```

## 3. Source responsibilities



| Source | Provides | Does not provide alone |
|---|---|---|
| DSPF | Display geometry, record formats, fields, keywords, AIDs | Business transaction authority |
| PF/DD | Referenced field type, length, decimals, validation source | Screen workflow |
| RPG/RPGLE | Assignments, indicators, EXFMT/WRITE hints, runtime values | Frontend permission authority |
| Spring Boot | Session, authorization, transaction, audit, reconciliation | DSPF conversion rules |

## 4. Runtime binding categories



The adapter can classify external source statements as:

```text
DCL-F display file
DCL-S scalar variable
DCL-DS data structure
array value
field assignment
indicator assignment
EXFMT hint
WRITE hint
message assignment
choice control value
runtime label
unknown runtime syntax
```

## 5. Binding flow



```text
read external runtime source
identify the display file reference
identify the display record reference
resolve a qualified DSPF field identity
classify the runtime role
capture the source location
capture the value or workflow hint
return RuntimeBindingIR
```

If the adapter cannot resolve a reference, return `manual-review`. Do not use the example program name as a required rule.

## 6. Runtime roles



| Role | React result | Review rule |
|---|---|---|
| `display-value` | Populate a field value | Require source identity |
| `hidden-control` | Keep technical binding metadata | Do not show as a normal input |
| `indicator` | Update a state capability | Preserve polarity and source location |
| `message` | Show a message state | Preserve message source and severity |
| `workflow-hint` | Describe a possible display transition | Do not create a business route automatically |
| `unknown` | Show manual review | Do not generate executable behavior |

## 7. Display workflow hints



Represent `EXFMT` and `WRITE` as hints:

```json
{
  "sourceIdentity": "project:R1:record:TESTR:workflow:1",
  "runtimeSource": "program-source-path",
  "operation": "EXFMT",
  "record": "TESTR",
  "sourceLocation": "line:53",
  "status": "manual-review"
}
```

A workflow hint can describe display order. It cannot decide:

```text
business route
permission
transaction result
approval state
```

## 8. Runtime value rules



Separate these values:

```text
source value
runtime value
display value
submitted value
```

Do not use a source assignment as a production transaction result. The Spring Boot runtime remains authoritative for runtime response values.

## 9. Unknown source rules



```text
IF the external statement maps to a known display role:
    status = converted or converted-with-warning
ELSE IF the statement needs owner input:
    status = manual-review
ELSE IF no safe React representation exists:
    status = unsupported
ELSE:
    status = error
```

Every result includes:

```text
sourceIdentity
runtimeSource
sourceLocation
role
status
reason
```

## 10. Integration boundary



The adapter consumes:

```text
DspfSemanticIR
external source text or parsed external source model
```

The adapter returns:

```text
RuntimeBindingIR
workflow hints
runtime diagnostics
traceability entries
```

The adapter does not mutate `DspfDocument`. The adapter does not execute external code. The adapter does not call Spring Boot.
