---
version: alpha
name: DSPF·RAD Modern Converted UI
description: Design tokens and usage rules for the modern React conversion output. This system applies to the converted pane and generated React app. It does not replace the 5250 faithful preview.
colors:
  primary: "#0F3460"
  primary-hover: "#0B2A4D"
  primary-active: "#081F3A"
  secondary: "#5C6773"
  neutral-0: "#FFFFFF"
  neutral-50: "#F7F8FA"
  neutral-100: "#EEF1F4"
  neutral-200: "#D9DEE5"
  neutral-500: "#697586"
  neutral-700: "#344054"
  neutral-900: "#101828"
  success: "#16794A"
  warning: "#A15C00"
  error: "#B42318"
  focus: "#0F3460"
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  heading-1:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.01em
  heading-2:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-small:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  label:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0.01em
rounded:
  none: 0px
  sm: 4px
  md: 8px
  full: 999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 24px
  page: 32px
components:
  app-shell:
    background: "{colors.neutral-50}"
    color: "{colors.neutral-900}"
  sidebar:
    background: "{colors.neutral-900}"
    activeBackground: "{colors.primary}"
    activeColor: "{colors.neutral-0}"
    width: 256px
  primary-button:
    background: "{colors.primary}"
    color: "{colors.neutral-0}"
    radius: "{rounded.sm}"
  secondary-button:
    background: "{colors.neutral-0}"
    color: "{colors.primary}"
    borderColor: "{colors.primary}"
    radius: "{rounded.sm}"
  input:
    background: "{colors.neutral-0}"
    color: "{colors.neutral-900}"
    borderColor: "{colors.neutral-200}"
    focusColor: "{colors.focus}"
    radius: "{rounded.sm}"
  card:
    background: "{colors.neutral-0}"
    borderColor: "{colors.neutral-200}"
    radius: "{rounded.md}"
  option-legend:
    background: "{colors.neutral-100}"
    color: "{colors.neutral-700}"
    accentColor: "{colors.primary}"
  function-action:
    color: "{colors.primary}"
    hoverBackground: "{colors.neutral-100}"
    radius: "{rounded.sm}"
---

# DSPF·RAD Modern Converted UI

## Overview

This design system defines the modern React conversion output. It applies to the converted pane and the generated React app.

The 5250 faithful preview remains unchanged. The converted UI shows a modern interpretation of the same DSPF source.

The design uses high-contrast neutrals and one blue accent. The result must feel clear, precise, and suitable for business software.

The system uses a 12-column layout. The conversion report remains visible when the modern layout changes the original DSPF geometry.

## Colors

Use `primary` for the main action, active route, focus ring, and selected conversion result.

Use neutral colors for page surfaces, cards, borders, labels, and body text.

Use `success`, `warning`, and `error` only for state meaning. Do not use these colors as decoration.

Use `primary-hover` and `primary-active` for pointer and keyboard action states. Keep the state change visible without relying on color alone.

Do not use pure black for body text when `neutral-900` gives sufficient contrast. Do not use the blue accent for every control. Reserve it for focus, selection, and primary actions.

## Typography

Use `Inter` as the single font family for the converted UI and generated app. Load the same font source in development and production.

Use 16px as the base size. Use the main 1.5 scale for display, heading, and body roles: 16px, 24px, and 36px.

Use 14px and 12px only for labels, metadata, and supporting text. Do not use small text for required instructions or error messages.

Use one clear heading per page. Use heading levels to show the route and section hierarchy.

Use numeric and technical values with a readable monospace treatment only when the value needs character alignment. Keep the default product font as Inter.

## Layout

Use a 12-column CSS grid for the converted screen. Map the source field length to a target span with the selected conversion profile.

Store the source row, source column, source length, target row, target span, and lossiness status in the traceability data.

Keep a fixed 24px gutter between major layout groups. Use the 4px spacing unit for small gaps and 16px for normal component padding.

Use a 32px page margin on desktop. Reduce the margin at smaller viewports without changing the reading order.

Use a left Sidebar for first-level navigation. Use a dropdown only for a small second-level group. Use a route when the group has independent permissions, a deep link, or a separate workflow.

Use a route transition for page-level navigation. Do not use a modal as a replacement for a page.

Use cards to group related fields, messages, actions, and conversion warnings. Keep the source record name and conversion status visible near the page heading.

### Converted screen layout

- Place page-level title and messages above the main content.
- Place OPTION legend controls above the related table.
- Place row-level actions after the row content.
- Place FUNCTION actions in the page action area unless the conversion profile marks them as row actions.
- Keep warning and manual-review states next to the affected converted object.

## Elevation & Depth

Use borders and tonal layers as the primary depth method. Use shadows only when a layer floats above the page.

Use `neutral-50` for the application background and `neutral-0` for cards and working surfaces.

Use the `primary` border or focus ring to show the active route, selected converted object, or keyboard focus.

Do not use large shadows to separate normal page sections.

## Shapes

Use 4px radius for inputs, buttons, and compact controls. Use 8px radius for cards and grouped panels.

Use a full radius only for status pills and compact tags.

Keep the 5250 faithful preview shape rules separate. Do not change its terminal appearance to match this modern system.

## Components

### App shell and Sidebar

Use the Sidebar for parent-level sections. Show the active route with `primary` and a non-color indicator such as an icon state or left border.

Keep the Sidebar keyboard accessible. Preserve the current route after page refresh.

### Converted fields

Use Material UI field components for generated fields. Bind each field to a qualified source identity and a stable DOM id.

Do not use a DOM id as a business key. Show the source field name and conversion status in the Inspector or traceability view.

### OPTION legend

Show OPTION values above the related table. Use an icon, the option code, and the option label.

Example:

```text
(ICON_X) X = ABCD    (ICON_Y) Y = CDEF
```

Keep the legend associated with the table that consumes the option. Do not show a global option legend for a row-only action.

### FUNCTION actions

Use a page action area for actions that affect the complete screen. Use a row action when the source action targets one row.

Use a dropdown when the user selects from a small set of visible functions. Use an icon action when the row has a compact, repeated operation.

Show the action label on hover and to assistive technology. Show a confirmation step for a destructive function.

### Status and conversion report

Show `converted`, `converted-with-warning`, `manual-review`, `unsupported`, and `error` as explicit states.

Use text, icon, and color together. Do not use color as the only state signal.

Show the source object path, target component, and reason for a warning or manual review item.

### Forms and validation

Place labels above inputs. Show the field name, type, required state, and validation message.

Keep client validation as a user aid. Keep server validation as the final authority for generated runtime applications.

Do not place credential or sensitive business data in DOM ids, conversion logs, or visible code examples.

### Icons

Use one SVG icon family across the converted UI. Prefer the selected Material icon pack when the generated app uses Material UI.

Give every action icon an accessible name. Use text beside an icon when the action is not widely recognized.

## Do's and Don'ts

### Do

- Do preserve the 5250 source identity in traceability data.
- Do show modern layout lossiness in the conversion report.
- Do keep the converted pane separate from the faithful preview.
- Do use the same tokens in the converted pane and the generated app.
- Do test keyboard focus, route changes, errors, and manual-review states.
- Do keep OPTION and FUNCTION semantics separate.

### Do not

- Do not treat a DSPF record name as a business workflow.
- Do not use a field name as a global DOM or business identity.
- Do not hide unsupported DSPF semantics.
- Do not use a modal as a page route.
- Do not replace the terminal preview with the modern converted style.
- Do not place sensitive data in DOM ids or conversion logs.
- Do not use MUI styles to change the 5250 faithful preview.
