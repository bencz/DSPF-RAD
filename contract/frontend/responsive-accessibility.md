# Responsive and Accessibility Policy

## 1. Viewport policy



| Viewport | Layout behavior |
|---|---|
| Compact, below 1450px | Hide or tab the converted pane to preserve Canvas geometry |
| Wide, 1450px and above | Show Canvas, faithful React preview, converted pane, and Inspector when space permits |
| Zoom 100% | All controls and content remain usable |
| Zoom 200% | Content reflows without loss of labels or actions |

Keep a minimum measurable width for the faithful Canvas. Do not allow a side pane to make Canvas geometry invalid.

## 2. Navigation policy



- Use a Sidebar for parent navigation.
- Use a dropdown for a small child group.
- Use a route for a page-level workflow or permission boundary.
- Use a dirty navigation guard for unsaved form changes.
- Preserve route state after reload.
- Show a not-found state for an unknown route.
- Show a forbidden state for a denied route.

## 3. Keyboard policy



- Every interactive control must be reachable with the keyboard.
- Every icon action must have an accessible name.
- Preserve logical focus order.
- Restore focus after route transitions.
- Return focus to the triggering control after a temporary panel closes.
- Do not depend on IBM function keys as the only way to access an action.

## 4. Field policy



- Place a visible label above each field.
- Connect the label to the field id.
- Connect validation text to the field with `aria-describedby`.
- Mark read-only and disabled states separately.
- Explain the reason for a disabled action.
- Do not use color as the only state signal.

## 5. Status policy



Use an `aria-live` region for:

```text
server messages
conversion warnings
manual-review results
transaction errors
session expiry
```

Use text, icon, and color together for `warning`, `unsupported`, and `error`.

## 6. Test policy



Test:

```text
keyboard-only flow
focus order
screen reader labels
100% zoom
200% zoom
contrast
reduced motion
loading state
error state
forbidden state
not-found state
manual-review state
```

---
