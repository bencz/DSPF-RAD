# Target React Admin Component Reference

## Purpose

This document records the Material UI components used by the target React admin reference template. The template is a visual and structural reference. It is not a generated production application.

**MUI reference:** https://mui.com/material-ui/all-components/

## Component inventory

| Component | MUI reference | Use in target admin | Contract boundary |
|---|---|---|---|
| `AppBar` | `/material-ui/react-app-bar/` | Show the application title and global actions. | Do not own route data or transaction state. |
| `Drawer` | `/material-ui/react-drawer/` | Show parent-level navigation. | Receive route items and permission state. |
| `List` | `/material-ui/react-list/` | Show navigation and record collections. | Receive ordered items; do not fetch data. |
| `Tabs` | `/material-ui/react-tabs/` | Switch between overview, mapping, diagnostics, and output views. | Preserve route or view state explicitly. |
| `Breadcrumbs` | `/material-ui/react-breadcrumbs/` | Show the current conversion location. | Receive the route manifest. |
| `Container` | `/material-ui/react-container/` | Limit page width on large screens. | Do not change source geometry. |
| `Box` | `/material-ui/react-box/` | Provide layout and semantic wrappers. | Use design tokens through `sx`. |
| `Grid` | `/material-ui/react-grid/` | Provide the target 12-column layout. | Consume `layout-policy.json`; preserve source traceability. |
| `Stack` | `/material-ui/react-stack/` | Arrange controls and action groups. | Use the spacing scale from `target_design.md`. |
| `Paper` | `/material-ui/react-paper/` | Group a screen section or review result. | Do not imply approval or security state by elevation. |
| `Card` | `/material-ui/react-card/` | Group a conversion summary or artifact. | Receive derived report data. |
| `Typography` | `/material-ui/react-typography/` | Show headings, labels, values, and help text. | Use the typography tokens. |
| `TextField` | `/material-ui/react-text-field/` | Show editable binding overrides and field values. | Connect label, value, validation, and source identity. |
| `Select` | `/material-ui/react-select/` | Choose conversion profile or a small function set. | Do not decide business permission. |
| `Autocomplete` | `/material-ui/react-autocomplete/` | Select a record, field, or known source reference. | Report unresolved values as manual review. |
| `Checkbox` | `/material-ui/react-checkbox/` | Edit boolean conversion options. | Provide a visible label and a stable binding. |
| `Radio Group` | `/material-ui/react-radio-button/` | Select one conversion policy. | Show the selected policy and its trade-off. |
| `Button` | `/material-ui/react-button/` | Trigger safe page or conversion actions. | Require permission and pending state. |
| `IconButton` | `/material-ui/react-button/` | Trigger compact row actions. | Provide an accessible name and confirmation when destructive. |
| `Button Group` | `/material-ui/react-button-group/` | Group related non-destructive actions. | Keep action order stable. |
| `Chip` | `/material-ui/react-chip/` | Show conversion status or a compact filter. | Do not use color as the only status signal. |
| `Badge` | `/material-ui/react-badge/` | Show a count for warnings or review items. | The count must match the report query. |
| `Alert` | `/material-ui/react-alert/` | Show conversion and runtime messages. | Use severity and source identity. |
| `Snackbar` | `/material-ui/react-snackbar/` | Show short operation feedback. | Do not use it as the only error channel. |
| `Dialog` | `/material-ui/react-dialog/` | Confirm destructive actions only. | Do not use it as page navigation. |
| `CircularProgress` | `/material-ui/react-progress/` | Show a bounded loading operation. | Include a text status for assistive technology. |
| `Skeleton` | `/material-ui/react-skeleton/` | Show layout while server data loads. | Keep the final layout stable. |
| `Divider` | `/material-ui/react-divider/` | Separate related content groups. | Use spacing before adding a divider. |
| `Table` | `/material-ui/react-table/` | Show source-to-target mapping and SFL rows. | Define headers, row identity, and empty state. |
| `Pagination` | `/material-ui/react-pagination/` | Navigate review results or large source lists. | Preserve query state in the route. |
| `Tooltip` | `/material-ui/react-tooltip/` | Explain compact icons and technical values. | Do not hide required labels in a tooltip. |
| `Accordion` | `/material-ui/react-accordion/` | Collapse detailed diagnostics or traceability. | Keep the summary understandable when closed. |
| `Menu` | `/material-ui/react-menu/` | Show a small action menu. | Use permission-aware action entries. |
| `Link` | `/material-ui/react-link/` | Link to source locations or report sections. | Preserve source identity in the destination. |
| `CssBaseline` | `/material-ui/react-css-baseline/` | Normalize the generated app base styles. | Scope it to the generated app, not the faithful preview. |
| `useMediaQuery` | `/material-ui/react-use-media-query/` | Select compact or wide layout behavior. | Keep breakpoint values in the design contract. |

## Component state contract

Every interactive component must define:

```text
default
hover
focus
active
disabled
loading
error
empty
manual-review
unsupported
```

Every field component must define:

```text
label
value
rawValue
readOnly
disabled
validation
sourceIdentity
runtimeBindingKey
domId
```

## MUI usage rules

- Import components from `@mui/material`.
- Import icons from the selected icon package.
- Use `sx` with tokens from `target_design.md`.
- Keep MUI styles inside the converted pane or generated app.
- Do not apply MUI global styles to the 5250 faithful preview.
- Use `Grid` only after the layout mapper provides target positions.
- Use `Table` for collection semantics, not a group of unrelated `Box` elements.
- Use `Dialog` only for confirmation, not for route navigation.
- Use `Alert` and `aria-live` for errors and review states.

## Not selected for the first reference template

The following MUI components remain available in the official catalog but are not part of the first target admin template:

```text
Avatar
Fab
Rating
Slider
Switch
Transfer List
Toggle Button
Speed Dial
Stepper
Bottom Navigation
Image List
Masonry
Timeline
Popover
Popper
Portal
```

Add an unselected component only when a contract requirement names its behavior and its accessibility/test contract is defined.

## Verification

Check that every component used by the target template appears in the inventory. Check that every component has a source contract, a state contract, and a test owner.
