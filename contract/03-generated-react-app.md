# 03 Generated React App: Design System, Template, Preview Methodology

## 1. Design tokens

Use `contract/target_design.md` as the only token source. Use token references, not copied values:

```text
{colors.primary}  {typography.body}  {spacing.md}  {rounded.sm}
```

Apply tokens to the converted pane and the generated app. Do not apply them to the 5250 faithful preview — the faithful preview keeps its terminal style.

## 2. Conversion interfaces

```js
buildCompleteSemanticIR(doc)          // → ir; never mutates doc
buildMappingContract(ir, { overrides }) // → mapping contract; applies D-15 design overrides when present
mapSemanticLayout(ir, profile)        // → layout model with source/target geometry + lossiness
buildBindingMap(ir, overrides)        // → binding map
```

The binding map separates `sourceIdentity`, `runtimeBindingKey`, `domId`, and `businessName`. The frontend field-binding schema (`schemas/field-binding.schema.json`) consumes the generic identity schema and adds field behavior; it must not redefine identity fields.

Converted pane contract:

```jsx
<ConvertedPane
    semanticModel={model}
    layoutModel={layout}
    bindingMap={bindings}
    onReviewItem={onReviewItem}
/>
```

The pane is read-only in the first visual slice and never changes faithful-preview semantics.

## 3. State ownership

| State | Owner |
|---|---|
| URL route | TanStack Router |
| Server screen data | TanStack Query |
| Form draft | Local React state |
| Theme | MUI theme provider |

## 4. Navigation

```text
AppShell ├── Sidebar ├── RouteOutlet └── StatusRegion
```

Sidebar for parent sections. Dropdown for a small child group. A route for a page-level workflow boundary. Prefer route transitions over modal navigation. Add dirty-state guards before leaving an edited page. Show not-found for unknown routes.

## 5. Component contracts

```jsx
<ConvertedField sourceIdentity="…" domId="Z-XMG3tX" label="Customer number"
                value={value} readOnly={readOnly} reviewState="converted" />
<ConversionStatus status="manual-review" reason="REFFLD source type is not available."
                  sourceIdentity={sourceIdentity} />
<OptionLegend options={options} targetTable={tableIdentity} />
<FunctionAction command={command} destructive={destructive} onConfirm={onConfirm} />
```

### Allowed MUI components

Use only this inventory (full reference: `references/react-admin/components-used.md`). Every component obeys its boundary rule:

| Group | Components | Boundary rule |
|---|---|---|
| Shell | AppBar, Drawer, Container, Box, CssBaseline, useMediaQuery | Navigation receives data; it does not fetch or own transaction state |
| Layout | Grid, Stack, Paper, Divider | Grid consumes `layout-policy.json`; keep source traceability |
| Data display | Typography, Table, Pagination, Chip, Badge, Accordion, Tooltip, Link | Status chips never rely on color alone; links preserve sourceIdentity |
| Input | TextField, Select, Autocomplete, Checkbox, Radio Group | Labels connect to ids; unresolved values become manual review |
| Actions | Button, IconButton, ButtonGroup, Menu, Dialog | Destructive actions confirm; permission comes from data, never invented |
| Feedback | Alert, Snackbar, CircularProgress, Skeleton, Breadcrumbs, Tabs, List, Card | Announce errors via StatusRegion; Skeleton keeps final layout stable |

Every interactive component defines states: default, hover, focus, active, disabled, loading, error.

## 6. Accessibility policy

- Give each field a visible label connected by id.
- Give each icon action an accessible name.
- Preserve keyboard focus order; restore focus after route transitions and panel closes.
- Connect validation text with `aria-describedby`.
- Mark read-only and disabled separately; explain why an action is disabled.
- Never use color as the only state signal.
- Test keyboard-only flow, contrast, reduced motion, 100% and 200% zoom.
- Keep a minimum width for the faithful Canvas; a side pane must not invalidate Canvas geometry.

Viewport policy: below 1450px hide or tab the converted pane to protect Canvas geometry; at 1450px+ show panes when space permits.

## 7. Query and error UI policy

Use TanStack Query for server state only. Query keys are arrays of stable serializable values:

```text
['screen', screenName, revision]
```

Cache: screen definition staleTime 5 min (invalidate on revision change); demo screen state staleTime 0 (replace on every response). Retry transient network/server errors with a bound; never retry validation errors.

Error UI:

| HTTP status | UI behavior |
|---|---|
| 400 | Show request error near the affected operation |
| 404 | Show not-found state |
| 409 | Show conflict and require reload |
| 422 | Map field errors to fields plus a summary |
| 500 / network | Show service error; seed servers also expose their demo mode here |

Wrap route data boundaries with `ErrorBoundary → Suspense → content`. Show a retry action only when retry can help.

## 8. Generated app file template

```text
generated-react-app/
├── package.json  vite.config.js  index.html  README.md  .env.example
├── src/
│   ├── main.jsx  App.jsx
│   ├── app/        AppShell.jsx  queryClient.js  errorBoundary.jsx
│   ├── router/     routeTree.jsx  routeManifest.js  navigation.js
│   ├── api/        contract.js  httpClient.js  localClient.js
│   ├── conversion/ bindings.js  screens.js  manifest.js
│   ├── components/ Sidebar.jsx  StatusRegion.jsx  ScreenLayout.jsx
│   │               ConvertedField.jsx  OptionLegend.jsx  FunctionAction.jsx
│   ├── screens/    ScreenRoute.jsx  screenQueries.js
│   ├── theme/      theme.js  tokens.js
│   └── tests/
├── backend-contract/   openapi.yaml + examples
├── conversion-manifest.json
├── binding-map.json
├── traceability.json
└── conversion-report.md
```

Standalone build rules:

- The app builds outside the designer repository; pin React/Vite/MUI/TanStack versions.
- Provide `npm run dev`, `npm run build`, `npm run preview`, `npm test`, `npx playwright test`.
- `.env.example` carries `VITE_API_BASE_URL`, `VITE_RUNTIME_MODE=seed-demo|local|http`, `VITE_ENABLE_LOCAL_MODE`.
- Use a Vite dev proxy for `/api` when the seed server runs on another port.

Generated-app rules:

- Generated code never imports designer mutable state (`DspfDocument`, designer stores).
- Generated output uses the generated binding map and API contract only.
- Generated output shows unsupported and manual-review states visibly.
- Keep `src/generated/` (regenerable) separate from `src/features/` (handwritten); the generator may replace only `src/generated/`.

Designer-side additions live under `react-app/src/conversion/` and `react-app/src/converted/`.

## 9. Design overlay and templates (OpenPencil)

The repo embeds OpenPencil (`open-pencil/`, external tool, gitignored) as the visual editor for target-side presentation. Its role is strictly an **overlay on top of automatic conversion** — decision D-15:

```text
automatic conversion (layout policy)  = default target geometry + component choice
design overlay (.fig document)        = approved overrides for span, position, component, template
```

### Pipeline (L1: CLI file exchange)

```text
adjust layout/components in OpenPencil → save .fig
    → bun open-pencil tree --json (or export)
    → pnpm extract:overrides -- <exported.json> [output]
    → design-overrides/layout-overrides.json
    → buildMappingContract(ir, { overrides })   // single application path, shared with the preview
```

### Override rules

- Node naming convention carries the binding: a node named `<sourceIdentity>` or `dspf:<sourceIdentity>` (both spellings normalize to the canonical downstream form) becomes an override for that source object. Nodes without the prefix and not matching the identity shape are recorded as info diagnostics.
- Overrides may set only **target-side** values: `targetRow`, `targetCol` (1–12 grid), `span`, `component` (must appear in the allowed MUI inventory in section 5, matched space-insensitively), optional `labelPlacement`.
- Overrides never touch `sourceIdentity`, source geometry, or DSPF semantics. The conversion core still owns source truth.
- Extraction is deterministic and total: unknown nodes, malformed identities, duplicate bindings (first wins), and empty overrides land in `diagnostics`, never silently dropped.
- `layout-overrides.json` is a versioned projection. Hash it into the conversion receipt next to the mapping hash; output directory `design-overrides/` is gitignored.

### Component libraries and page templates

- Author reusable patterns (SFL table band, header+detail, field groups) as OpenPencil components; instances map to allowed MUI components at extraction time.
- Author full-page templates as `.fig` library pages; a template reference pins the generated app shell/route pattern from section 8.

### Deferred levels

- L2 MCP service (`open-pencil/packages/mcp`) for live read/write — deferred until L1 proves value.
- L3 embedding the editor via `@open-pencil/vue` inside react-app — rejected for now (Vue vs React 19 mismatch).

## 10. Preview and generation methodology

End-to-end flow:

```text
requirements brief → source selection → DspfDocument → Semantic IR
    → Mapping Contract → deterministic React output → Vite dev/HMR
    → browser preview + screenshot → production build + Playwright audit
    → receipt + report
```

The Mapping Contract is the generator input. Never treat a screenshot, generated CSS, or generated JSX as source of truth.

Change classification selects the preview action:

| Change | Action |
|---|---|
| Token value, layout span/gap, content binding | HMR |
| Route, asset manifest, boot config | Full reload |
| Seed server config | Restart server |
| Semantic IR schema | Regenerate everything derived |

Single-change repair loop: fix one source/mapping/token/layout difference → classify → open the fixed viewport and route → read console/network errors → screenshot → compare with acceptance criteria. Keep the improvement if better; otherwise restore the value and inspect upstream. One change per loop keeps causes traceable.

Preview answers "what does the browser show now". It cannot replace build, contract tests, round-trip tests, accessibility tests, or Playwright audit.

Conversion receipt per generation run:

```json
{
  "sourceRevision": "R1",
  "mappingRevision": "M3",
  "converterVersion": "1.0.0",
  "outputHash": "sha256:...",
  "viewport": "1600x1200",
  "route": "/screens/SIGNON",
  "checks": { "build": "passed", "contract": "passed", "playwright": "passed" },
  "unresolved": []
}
```

Keep failed receipts. Never replace a failed result with fallback output.

Delivery gate — ship generated output only when: Mapping Contract is versioned; every source object has a status; unknown objects have diagnostics; React builds; browser route loads; critical interactions pass; screenshot uses the fixed viewport; traceability is complete; failed checks stay visible.

## 11. Test matrix

Unit: field binding, layout geometry, diagnostics shape, route manifest keys, query keys.
Component: ConvertedField/ConversionStatus states, OptionLegend, FunctionAction, Sidebar, StatusRegion announcements.
Contract: generated API client against `contract/openapi.yaml` (200/400/404/409/422/500).
Integration: standalone build; HTTP client against seed server; local client against fixtures; loader with Query cache.
Playwright: first route loads, fields and labels render, manual-review and unsupported states visible, Sidebar navigation, deep-link reload, valid and invalid demo submission, keyboard focus, 200% zoom.
Regression after generated-app work: root suite, react-app suites, build, round-trip, parity, immutability checks all green.

---
