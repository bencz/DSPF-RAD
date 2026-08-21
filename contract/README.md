# DSPF·RAD Conversion Contracts

這組文件定義 DSPF 轉換系統的高階架構、後端接口、抽象 mapping rule、前端 design system 與 generated app 檔案模版。

## 文件索引

| 文件 | 內容 |
|---|---|
| `00-system-design.md` | 系統邊界、資料流、責任、功能與 release gate |
| `01-backend-interfaces.md` | Spring Boot runtime、conversion API、錯誤與 session contract |
| `02-backend-file-template.md` | Node/Spring Boot backend 目錄與 class/template 責任 |
| `03-conversion-rules.md` | Semantic IR、identity、layout、OPTION/FUNCTION、lossiness rule |
| `04-frontend-design-system.md` | MUI tokens、component contract、Router/Query 邊界、accessibility |
| `05-frontend-file-template.md` | standalone generated React app 目錄與檔案責任 |
| `06-completeness-proof.md` | Known coverage、unknown containment、schema/test/release proof |
| `07-conflict-decisions.md` | Contract conflicts、selected options、reasons、verification |
| `08-rpg-to-react-system.md` | External RPG/RPGLE source to React runtime binding boundary |
| `09-preview-generation-methodology.md` | Penpot-inspired brief, mapping, Vite preview, screenshot, build, and receipt workflow |
| `semantic-layout-design.md` | Semantic IR、identity、record relations、layout、regression boundary |
| `openapi.yaml` | Spring Boot runtime 與 conversion API 的 OpenAPI 3.1 contract |
| `target_design.md` | Contract-owned design tokens |
| `target-react-admin-components-used.md` | MUI component inventory and boundary rules for the target React admin reference template |
| `frontend/component-state.schema.json` | Frontend component state schema |
| `frontend/field-binding.schema.json` | Frontend field binding schema |
| `frontend/route-manifest.schema.json` | Generated route manifest schema |
| `frontend/query-and-error-policy.md` | TanStack Query and frontend error policy |
| `frontend/responsive-accessibility.md` | Responsive and accessibility policy |
| `frontend/generated-app-test-matrix.md` | Generated app test matrix |
| `schemas/` | Semantic, identity, relation, SFL, runtime binding, RPG, security, and diagnostic schemas |

## Contract 原則

- `DspfDocument` 是既有設計資料來源。
- Conversion core 只讀取 `DspfDocument`。
- Semantic IR 是 conversion boundary，不取代 `DspfDocument`。
- DOM id、runtime binding key、source identity、business identity 必須分開。
- Unsupported semantics 不產生 executable action。
- Local demo 不得冒充 production backend。
- 每次轉換必須產生 manifest、traceability、binding map 與 conversion report。
- 既有 parser、writer、Canvas、React faithful preview、Inspector、source sync 必須通過 regression gate。

## Markdown SSOT policy

Markdown contract documents are the single source of truth. JSON schemas and OpenAPI files are machine-readable projections of the Markdown decisions.

| Domain | Markdown SSOT | Derived projection |
|---|---|---|
| System boundary | `00-system-design.md` | Architecture diagrams and generated package boundaries |
| Backend/API | `01-backend-interfaces.md` | `openapi.yaml` and backend schemas |
| Backend files | `02-backend-file-template.md` | Generated project template |
| Conversion rules | `03-conversion-rules.md` | Semantic and diagnostic JSON schemas |
| Frontend usage | `04-frontend-design-system.md` | Frontend component schemas and policies |
| Frontend files | `05-frontend-file-template.md` | Generated app file tree |
| Completeness | `06-completeness-proof.md` | Coverage and release evidence |
| Decisions | `07-conflict-decisions.md` | Version and migration records |
| External runtime | `08-rpg-to-react-system.md` | Runtime binding and workflow schemas |
| Semantic layout rationale | `semantic-layout-design.md` | Layout policy and traceability schemas |
| Design tokens | `target_design.md` | MUI theme and generated CSS/theme output |

The Markdown document owns the meaning, decision, default, and boundary. A JSON or OpenAPI file must not introduce a new rule that is absent from its Markdown source.

If a derived file conflicts with its Markdown source, stop implementation. Update the Markdown SSOT first. Regenerate or update the derived file after the Markdown change. Record the command and output path as evidence.