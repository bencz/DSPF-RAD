# Reference Bundle

This directory contains selected reference material for DSPF-RAD conversion. It does not contain complete upstream repositories.

## Included references

| Path | Purpose |
|---|---|
| `penpot/methodology.md` | Requirement brief, design config, deterministic generation, preview, receipt, and validation workflow. |
| `penpot/preview-methodology.md` | Vite HMR/reload selection, screenshot loop, parameter repair, and preview/formal validation boundary. |
| `react-admin/components-used.md` | MUI component inventory and target admin component boundaries. |

## Excluded content

Do not copy these upstream contents into this repository:

```text
.git
.env
.env.*
node_modules
dist
build
logs
cache
lockfiles
large archives
unrelated packages
```

Copy an upstream code file only when a contract names its behavior, its license is recorded, and its dependency closure is reviewed.

Reference code is input material. It is not production code until it passes the DSPF-RAD contracts and regression gates.
