# 04 Frontend Design System and Interfaces

## 1. Design tokens



Use `contract/target_design.md` as the only token source because all converted UI and generated app consumers must use one value set.

Use token references instead of copying token values:

```text
{colors.primary}
{typography.body}
{spacing.md}
{rounded.sm}
```

Apply the tokens to the converted pane and generated app. Do not apply the converted token system to the 5250 faithful preview.


## 2. Frontend interface boundaries



### Conversion input

```js
buildDspfSemanticIR(doc) -> ir
```

The function returns a new value. It does not mutate `doc`.

### Layout interface

```js
mapSemanticLayout(ir, profile) -> layoutModel
```

The result contains source geometry, target geometry, lossiness, and review states.

### Binding interface

```js
buildBindingMap(ir, overrides) -> bindingMap
```

The binding map separates source identity, runtime key, DOM id, and business name.

Identity boundary:

```text
contract/schemas/identity.schema.json
    = generic identity fields
frontend/field-binding.schema.json
    = field value, usage, validation, and UI binding fields
```

Do not redefine `sourceIdentity`, `runtimeBindingKey`, or `domId` in the frontend contract. The frontend contract consumes the generic identity contract and adds field behavior.

### Converted pane interface

```jsx
<ConvertedPane
    semanticModel={model}
    layoutModel={layout}
    bindingMap={bindings}
    onReviewItem={onReviewItem}
/>
```

The pane is read-only during the first visual slice.

## 3. React state ownership



| State | Owner |
|---|---|
| `DspfDocument` | Existing external document store |
| Converted model | Derived pure result |
| MUI theme | Theme provider |
| Icons | @mui/icons-material |
| URL route | TanStack Router |
| Backend screen data | TanStack Query |
| Form draft | Local React/form state |
| Review decision | Backend governance state |

Do not put `DspfDocument` into TanStack Query cache.

## 4. Navigation interface



```text
AppShell
  ├── Sidebar
  ├── RouteOutlet
  └── StatusRegion
```

Use a Sidebar for parent sections. Use a dropdown for a small child group. Use a route for a page-level workflow or permission boundary.

Use route transitions instead of modal navigation. Add dirty-state guards before leaving an edited page.

## 5. Component contracts



### Field component

```jsx
<ConvertedField
    sourceIdentity="project:R1:record:CUST:field:DSCUSNO:occurrence:12"
    domId="Z-XMG3tX"
    label="Customer number"
    value={value}
    readOnly={readOnly}
    reviewState="converted"
/>
```

### Review state

```jsx
<ConversionStatus
    status="manual-review"
    reason="REFFLD source type is not available."
    sourceIdentity={sourceIdentity}
/>
```

### OPTION legend

```jsx
<OptionLegend
    options={options}
    targetTable={tableIdentity}
/>
```

### FUNCTION action

```jsx
<FunctionAction
    command={command}
    permission={permission}
    destructive={destructive}
    onConfirm={onConfirm}
/>
```

## 6. Accessibility contract



- Give each field a visible label.
- Give each icon action an accessible name.
- Preserve keyboard focus order.
- Announce errors and review states.
- Do not use color as the only state signal.
- Test 100% and 200% zoom.
- Keep the faithful preview in its existing terminal style.

---
