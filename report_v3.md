# V3 Design Options Report

## Purpose

This report records the metadata-authority design decision for DSPF to React and Spring Boot conversion.

## Observed problem

`WCUSTSD2.DSPF` references:

```text
XAN4CDEM/CUSTS
XAN4CDEM/SLMEN
```

The pulled Custom-Account source set contains:

```text
CUSTMAST.PF
ACCTMAST.PF
CUSTMASTL1.LF
ACCTMASTL1.LF
```

The source set does not contain the requested `XAN4CDEM` PF/DD members. The converter must not guess an alias. The current safe result is `manual-review` for unresolved REFFLD metadata.

## Options considered

### Option A — Source-first

Use DSPF, PF, LF, RPGLE, and CL source members as the only authority.

```text
source set → source index → REFFLD resolver → Semantic IR
```

**Benefits:** offline use, Git reproducibility, simple CI, no IBM i connection.

**Risks:** requires complete source closure, needs broad DDS parsing, and cannot resolve compiled-only metadata.

### Option B — Compiled DDS metadata-first

Use IBM i compiled DDS metadata as the primary authority. Use source members as supporting evidence.

```text
DSPF → compiled DDS metadata → REFFLD resolver → Semantic IR
```

**Benefits:** closest to IBM i compilation, reliable type/length/decimal resolution, works when source members are incomplete.

**Risks:** requires IBM i access or metadata export, complicates offline CI, and requires compiled-object revision tracking.

### Option C — Hybrid authority model (selected)

Support both compiled metadata and source indexes with explicit priority:

```text
1. compiled DDS metadata with matching object revision
2. exact library/file/source field
3. approved alias mapping
4. missing or ambiguous manual-review
```

**Benefits:** supports connected IBM i migration and offline source conversion. It preserves provenance and avoids guessed mappings.

**Risks:** requires conflict handling, source/compiled revision tracking, and a more detailed contract.

## Decision

Select Option C, the Hybrid authority model.

IBM i compiled metadata is the highest-confidence source when the object revision matches. Exact PF/LF source is the offline authority. An alias is valid only when an owner approves and records it. Missing or ambiguous metadata remains review-only.

## Contract changes

Add `source-metadata.schema.json` with:

```text
sourceSetId
members
library
file
record
field
sourceType
encoding
revision
hash
availability
```

Add `reference-resolution.schema.json` with:

```text
requested
resolved
resolutionSource
sourceRevision
confidence
status
reason
action
releaseEffect
```

Add the following Semantic IR groups:

```text
sourceSetRevision
metadataAuthority
referenceResolutions
dependencyClosure
readiness
```

Add the following Mapping Contract fields:

```text
referenceResolution
metadataAuthority
resolutionSource
confidence
releaseEffect
```

## Resolution result example

```json
{
  "requested": {
    "library": "XAN4CDEM",
    "file": "CUSTS",
    "field": "XWE0NB"
  },
  "resolved": null,
  "resolutionSource": null,
  "confidence": "none",
  "status": "missing-source",
  "reason": "Compiled DDS metadata and exact PF/DD source are unavailable",
  "action": "Provide XAN4CDEM/CUSTS or approve an explicit alias",
  "releaseEffect": "block-runtime-and-deployment"
}
```

## H usage result

`SHWREC`, `SFIELD`, and `RECNAM` are valid hidden controls:

```json
{
  "role": "hidden-control",
  "visible": false,
  "readOnly": true,
  "status": "converted"
}
```

They remain in Semantic IR and traceability. They do not render as visible editable inputs.

## Readiness policy

```text
missing metadata → previewable
missing metadata → exploratory buildable
missing metadata → not runtime-ready
missing metadata → not deployable
```

A conversion can produce a useful React preview while the release gate remains blocked.

## Required V3 sequence

```text
V3.0E Define source metadata authority
V3.0F Add compiled DDS metadata adapter
V3.0G Add approved alias mapping
V3.1E Add reference-resolution contract
V3.1F Integrate resolver into Semantic IR
V3.2C Add resolution provenance to Mapping Contract
V3.3C Render structured diagnostics
V3.4C Generate resolved React field bindings
V3.5E Generate resolved Spring DTO/API bindings
```

## Rejected behavior

Do not use these fallbacks:

```text
same field name fallback
same local filename fallback
DSPF visual width as PF/DD length
automatic business permission inference
automatic executable action for unresolved semantics
```

## Acceptance gate

The V3 conversion is complete only when each REFFLD is either:

```text
resolved from compiled metadata
resolved from exact PF/LF source
resolved through an approved alias
or reported as actionable manual-review
```

No source reference may disappear, and no unresolved reference may receive a deployable status.
