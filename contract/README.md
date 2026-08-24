# DSPF·RAD Conversion Contracts

本目錄是 DSPF·RAD 轉換系統的契約 SSOT。Markdown 文件是唯一決策來源；JSON schemas 與 `openapi.yaml` 是機器可讀投影。

## 範圍（2026-08 起生效，見 decisions.md D-11）

- **產品 = 前端轉換**：DSPF → Semantic IR → Mapping Contract → 生成 React App。
- **Spring Boot 僅作 seed-data 展示伺服器**：讓生成的 React App「看得到效果」，不承擔任何正式後端職責。
- `TESTS/`、`QDDSSRC/`、`INPUT/` 是參考應用程式,作為測試素材（fixtures、E2E、seed 抽取）。

## 文件索引

| 文件 | 內容 |
|---|---|
| [01-scope-and-sources.md](01-scope-and-sources.md) | 目的、範圍表（in/out of scope）、責任邊界、狀態擁有權、測試素材、發佈 gates L/S/G |
| [02-conversion-core.md](02-conversion-core.md) | 轉換流程、DspfDocument 邊界、顯示設定檔、身份規則、metadata authority、記錄關係、layout 公式、OPTION/FUNCTION、SFL 邊界、轉換狀態與零丟失 gate、覆蓋矩陣、gates C0–C4 |
| [03-generated-react-app.md](03-generated-react-app.md) | Design tokens、介面邊界、MUI 元件清單與邊界、無障礙/響應式政策、Query/error 政策、生成 App 檔案模板、預覽與驗證方法論、測試矩陣 |
| [04-seed-backend.md](04-seed-backend.md) | Seed-data 示範伺服器：硬邊界（demo 不是 production）、端點、畫面狀態形狀、交易腳本行為、seed 來源（手寫 + RPG 抽取）、專案模板 |
| [05-lifecycle.md](05-lifecycle.md) | 六段生命週期（source→edit→convert→generate→verify→deliver）、身份與 hash 鏈、驗證梯、receipt 規格、失敗政策、確定性規則、誠實進度表 |
| [decisions.md](decisions.md) | 決策日誌 D-01…D-14（衝突裁決、範圍變更、整合紀錄） |
| [target_design.md](target_design.md) | Design tokens（唯一 token 來源） |
| [openapi.yaml](openapi.yaml) | Seed API 的 OpenAPI 3.1 投影 |
| [schemas/](schemas/) | Semantic IR、identity、relation、SFL、diagnostic、traceability、field-binding、route-manifest 等 JSON schemas |

## Markdown SSOT 政策

1. Markdown 擁有意義、決策、預設值與邊界。
2. 投影檔（schemas、openapi.yaml）不得引入 Markdown 沒有的新規則。
3. 若投影與 Markdown 衝突：**停止實作**，先改 Markdown，再更新投影，並留下指令與輸出路徑證據。

## 核心規則速記

- 轉換核心唯讀 `DspfDocument`;Semantic IR 是轉換邊界,不取代文件。
- `sourceIdentity`、`runtimeBindingKey`、DOM id、`businessName` 四者分離。
- 未支援語意不產生可執行動作;每個來源物件必有一個轉換狀態;零靜默丟失。
- 每次轉換產出 manifest、traceability、binding map、conversion report。
- 本地 demo 必須標示 `mode: "seed-demo"`,不得冒充 production backend。
- 既有 parser/writer/Canvas/faithful preview/Inspector/source sync 是回歸合約,不得被轉換破壞。

## 變更程序

```text
需要新規則時:
IF 現有四份主題文件有對應章節:
    該章節內更新
ELSE:
    新增編號文件,並更新本索引與 decisions.md
同時:
    更新受影響的 schema / openapi 投影
    在 decisions.md 記錄決策(若有取捨)
```

歷史文件（00–09 號、frontend/、security.schema.json）已於 D-11/D-12 整合刪除,內容可在 git 歷史追查。
