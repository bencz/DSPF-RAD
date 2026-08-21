# 05 Frontend File Template

## 1. Generated React app



```text
generated-react-app/
├── package.json
├── vite.config.js
├── index.html
├── README.md
├── LICENSE
├── public/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── app/
│   │   ├── AppShell.jsx
│   │   ├── queryClient.js
│   │   └── errorBoundary.jsx
│   ├── router/
│   │   ├── routeTree.jsx
│   │   ├── routeManifest.js
│   │   └── navigation.js
│   ├── api/
│   │   ├── contract.js
│   │   ├── httpClient.js
│   │   └── localClient.js
│   ├── conversion/
│   │   ├── bindings.js
│   │   ├── runtimeBindings.js
│   │   ├── workflowHints.js
│   │   ├── screens.js
│   │   └── manifest.js
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── StatusRegion.jsx
│   │   ├── ScreenLayout.jsx
│   │   ├── ConvertedField.jsx
│   │   ├── OptionLegend.jsx
│   │   └── FunctionAction.jsx
│   ├── screens/
│   │   ├── ScreenRoute.jsx
│   │   └── screenQueries.js
│   ├── theme/
│   │   ├── theme.js
│   │   └── tokens.js
│   └── tests/
│       ├── api-contract.test.js
│       ├── binding.test.js
│       └── screen-flow.spec.js
├── backend-contract/
│   ├── openapi.yaml
│   └── examples/
├── conversion-manifest.json
├── binding-map.json
├── traceability.json
└── conversion-report.md

## 1.1 Standalone build contract
The generated React app must build outside the designer repository.

```text
generated-react-app/
├── package.json
├── package-lock.json or pnpm-lock.yaml
├── .env.example
├── vite.config.js
└── src/
```

The generated package must pin the React, Vite, MUI, TanStack Router, and TanStack Query versions used by the generated source.

The generated app must provide:

```text
npm run dev
npm run build
npm run preview
npm test
npx playwright test
```

Use `.env.example` for:

```text
VITE_API_BASE_URL
VITE_RUNTIME_MODE=local|http
VITE_ENABLE_LOCAL_MODE
```

Use a Vite development proxy for `/api` when the Spring Boot server uses a separate local port. Do not embed production secrets in the generated app.
```

## 2. Existing designer additions



```text
react-app/src/
├── conversion/
│   ├── visualModel.js
│   ├── semanticIR.js
│   ├── gridMapper.js
│   ├── bindingMap.js
│   └── conversionReport.js
├── converted/
│   ├── ConvertedPane.jsx
│   ├── ConvertedField.jsx
│   ├── ConvertedStatus.jsx
│   ├── convertedTheme.js
│   └── convertedResize.js
└── source/
    └── ReactCodeView.jsx
```

## 3. File ownership



| File group | Owner |
|---|---|
| `conversion/` | Pure conversion logic |
| `converted/` | Designer visual output |
| `router/` | Generated app navigation |
| `api/` | Generated app backend interface |
| `theme/` | Generated app design tokens |
| `backend-contract/` | Spring Boot integration contract |
| `conversion-report.md` | Conversion evidence and review state |

## 4. Generated app rules



- Generated app code must build without the original designer.
- Generated app must not import the designer's mutable `DspfDocument`.
- Generated app must use the generated binding map.
- Generated app must use the generated API contract.
- Generated app must show unsupported and manual-review states.
- Generated app must keep local demo mode separate from production mode.
- Generated app must not include secrets from the conversion source.

---
