# V2.1 Reflection Report

## Scope

This report records observed V2.1 conversion work for DSPF-RAD, including the `jwors` branch input:

```text
https://github.com/Raymondycp/ibmi-react/tree/jwors/INPUT/Cuustom-Account
```

The tested input included DSPF, PF, LF, RPGLE, and CL files. `WCUSTSD2.DSPF` was used for browser verification.

## Verified results

```text
Semantic IR foundation: implemented
DSPSIZ profiles: implemented
Qualified identities and references: implemented
Capability statuses: implemented
12-column layout mapping: implemented
External runtime binding boundary: implemented
SFL runtime contract: implemented
Indicator normalization: implemented
OPTION/FUNCTION safety graph: implemented
Mapping Contract: implemented
Standalone React/Vite output: implemented
Generated server boundary: implemented
Main-controller preview audit: executed at http://localhost:5173/
```

Observed test evidence:

```text
Root conversion tests: 26 passed
React app Vitest suite: 110 passed
React app Playwright suite: 24 passed
WCUSTSD2 converted-pane E2E: 5 passed
WCUSTSD2 generated React Vite build: succeeded
Generated Spring scaffold Maven package: succeeded
```

## Confirmed defect and fix

Valid DSPF fields with usage `H` were incorrectly reported as manual review. `SHWREC`, `SFIELD`, and `RECNAM` are hidden controls, not visible editable fields.

The React preview now preserves them in the model but renders them as:

```text
hidden
non-editable
traceable
```

## Confirmed source dependency gap

`WCUSTSD2.DSPF` references:

```text
XAN4CDEM/CUSTS
XAN4CDEM/SLMEN
```

The pulled Custom-Account input provides:

```text
CUSTMAST.PF
ACCTMAST.PF
CUSTMASTL1.LF
ACCTMASTL1.LF
```

No matching `XAN4CDEM` PF/DD source was present. Therefore the following remain correctly marked `manual-review`:

```text
ZWE0NB
ZWJUN0
PNAME
ZWGIVA
ZZFT02 REFFLD fields
ZZCNF1 REFFLD fields
```

Substituting `CUSTMAST` or `ACCTMAST` without an explicit mapping would be unsafe.

## Design failures

### 1. Source closure was not an initial gate

The first design accepted one DSPF as the conversion input. Real conversion requires a source set and dependency inventory:

```text
DSPF + PF + LF + RPGLE + CL + external references
```

### 2. Preview, build, and deployment readiness were conflated

A result can be:

```text
previewable
buildable
review-required
not deployable
```

A successful Vite build does not prove semantic completeness or production readiness.

### 3. Root and React app boundaries were unclear

The workspace contains:

```text
root src/       legacy browser modules and conversion core
react-app/      Vite React controller and preview
```

Port ownership and served entry modules must be checked explicitly.

### 4. Manual review was under-specified

A diagnostic must include source identity, source path, target, missing dependency, reason, required action, and release effect. A sentence-only warning is insufficient.

### 5. Ticket completion was too permissive

Helper code plus unit tests was incorrectly treated as complete integration. A ticket is complete only when its stated boundary has real fixture, output, and regression evidence.

## V2.1 status

```text
Conversion foundation: complete for implemented boundaries
Main-controller preview: verified
React/Vite artifact generation: verified
Spring Boot artifact scaffold: verified
PF/DD resolution for external XAN4CDEM sources: blocked by missing source
Production Spring runtime: not delivered
Production governance: not delivered
```

## Required V3 correction

V3 must begin with source inventory and dependency closure. It must keep these gates separate:

```text
source-complete
semantic-complete
preview-complete
build-complete
runtime-complete
approval-complete
deployable
```

No incomplete conversion may receive a production-ready label.
