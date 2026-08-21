# 從用戶需求到 React/Vite App 的產出方法論

## 1. 範圍與結論

本文件把 Penpot 專案中的設計分析能力，整理成一條可重複的「需求 → Penpot 模版 layout → React/Vite app」流程。

**重要邊界：**目前 repository 內沒有一個已完成、可直接把 Penpot 設計自動寫成 React/Vite 專案的 generator。現有能力是：Penpot MCP 讓模型讀取與操作設計，Plugin API 可輸出 HTML/SVG/CSS；React/Vite 專案的 scaffold、component mapping、config 寫入與驗證，仍須由外部腳本、MCP `execute_code`，或人工/代理程式完成。以下因此分為「repository 已提供」和「建議的 application-generation layer」。

## 2. 端到端流程

```text
用戶需求
  ↓ 結構化需求與驗收條件
模版選擇／確認（Penpot page、board、component）
  ↓
讀取 layout、文字、色彩、字型、資產、互動語意
  ↓
中轉 config（版本化 JSON）
  ↓
將 config 映射成 React component tree + CSS/tokens/assets
  ↓
寫入 Vite app（package.json、src、public、vite.config）
  ↓
安裝依賴、build、啟動 preview
  ↓
瀏覽器比對 layout 與需求，記錄差異
  ↓
修正 config／mapping，而不是直接散改產出碼
```

### 2.1 需求階段

先把自然語言需求轉成可檢查的 brief：

- 頁面、route、主要區塊與 responsive breakpoint。
- 每個區塊的資料欄位、互動、空狀態、錯誤狀態。
- 哪些內容來自 Penpot 模版，哪些內容是業務資料。
- 驗收條件：例如 route 可開啟、按鈕行為、指定 viewport 的視覺比對。
- 不確定項目以 `openQuestions` 留存，不要默認成 CSS 細節。

需求 brief 是產品意圖；它不是 Penpot shape dump，也不是最後的 React source。

### 2.2 模版分析階段

1. 用 Penpot MCP 的 `high_level_overview` 先讀取 API 能力與操作規則。
2. 由用戶指定 page/board，或請用戶在 Penpot 選取目標 shape。
3. **立即把 selection 複製到 plugin `storage`**；工具說明明確指出不能假定 selection 後續不變。
4. 用 `penpotUtils.getPages`、`getPageByName`、`findShape`/`findShapes`、`shapeStructure` 取得穩定的頁面與樹狀結構。
5. 分析 board 的 flex/grid layout、children 順序、layout cell、padding/gap、尺寸模式；有 layout system 時，不要用手工 x/y 覆蓋它。
6. 讀取文字、色彩、字型、圖片與元件語意，並把「可重用 component」與「只出現一次的內容」分開。

`shapeStructure` 適合先取得低成本結構摘要；需要像素/樣式時再針對目標 shape 取 CSS、markup 或 export，避免一次回傳整個檔案造成上下文噪音。

### 2.3 輸出資料階段

Penpot Plugin API 直接提供：

- `penpot.generateMarkup(shapes, { type: "html" | "svg" })`：產出 markup。
- `penpot.generateStyle(shapes, { type: "css", withPrelude?, includeChildren? })`：產出 CSS。
- `penpot.generateFontFaces(shapes)`：產出必要的 font-face。
- `export_shape` MCP tool：把指定 shape 輸出成 SVG/PNG；可選 `shape` 或 `fill` mode。

這些輸出應視為**參考渲染物**，不是直接貼進 React 的最終架構。HTML 需要轉成語意化 JSX；CSS selector 需要轉成 component scope 或 token；SVG/PNG 則應放在 `public/assets` 或透過 import 管理。

## 3. 中轉 config 設計

中轉 config 是唯一的生成輸入與差異追蹤來源。建議每次生成保留一份，例如 `generation/design-config.json`；不要只保存模型 prompt 或最後的 source diff。

```json
{
  "schemaVersion": 1,
  "source": {
    "fileId": "<penpot-file-id>",
    "pageId": "<page-id>",
    "rootShapeId": "<board-id>",
    "sourceRevision": "<optional-revision-or-timestamp>"
  },
  "app": {
    "name": "example-app",
    "framework": "react",
    "bundler": "vite",
    "language": "typescript",
    "entry": "src/main.tsx"
  },
  "routes": [{ "path": "/", "component": "HomePage" }],
  "tokens": {
    "color": {},
    "spacing": {},
    "typography": {}
  },
  "components": [{
    "id": "hero-board",
    "name": "Hero",
    "sourceShapeId": "<shape-id>",
    "kind": "board",
    "layout": { "type": "flex", "direction": "column" },
    "children": [],
    "props": {},
    "assetRefs": [],
    "contentBindings": {}
  }],
  "requirements": {
    "interactions": [],
    "responsive": [],
    "acceptance": []
  },
  "openQuestions": []
}
```

### Config 原則

- `schemaVersion` 必須；schema 改變時做 migration，不要靜默改語意。
- 每個可產出 component 保存 `sourceShapeId`，才能回溯 Penpot 並進行增量更新。
- `layout` 保存設計語意（flex/grid、gap、alignment、sizing），不要只保存計算後的絕對座標。
- `tokens` 與 component 引用分離；同一色彩/間距不能在每個 component 內複製成 magic number。
- `contentBindings` 保存需求資料欄位與預設值，避免把一次性文案硬編碼成 layout 規則。
- 記錄 `generatedAt`、generator version、source identifiers、輸入摘要與 validation 結果；不要把 access token、MCP URL secret 或用戶資料寫入 config。
- `position-data` 等 derived geometry 不應當作 source of truth；需要時重新從 Penpot context 產生。

## 4. React/Vite 生成層

建議生成器採取 deterministic pipeline：

1. **Scaffold**：建立標準 Vite React TypeScript 結構，確認 `package.json` scripts（`dev`、`build`、`preview`）。
2. **Normalize**：把 Penpot shape tree 正規化成 config；補齊 component name、穩定 ID、token reference。
3. **Map**：將 board/frame → layout component，text → `Text`/語意標籤，image → asset reference，button-like shape → 可互動 component。
4. **Emit**：輸出 `src/components`、page/route、`src/styles`、`public/assets` 與 `vite.config.ts`；固定檔案排序與格式，讓相同輸入產出相同結果。
5. **Integrate behavior**：需求 brief 的互動與資料流由 generator 明確插入；不可從視覺 shape 猜出不存在的後端 API。
6. **Validate**：TypeScript/build、route smoke test、指定 viewport screenshot/視覺比對、鍵盤與基本 accessibility 檢查。
7. **Repair loop**：差異回寫 config 的 mapping 或 token，重新生成；只有真正的業務邏輯才在手寫區域修改。

把生成檔與手寫檔分隔，例如 `src/generated/` 和 `src/features/`。生成器重跑時可安全覆蓋前者；手寫 extension 透過 props、adapter 或明確的 composition boundary 接入。

## 5. MCP 與相關工具

| 工具／模組 | 作用 | 在流程中的位置 |
|---|---|---|
| MCP `high_level_overview` | 提供 Penpot API、layout 與操作提示 | 每次設計分析前 |
| MCP `execute_code` | 在 plugin context 執行 JavaScript；可使用 `penpot`、`penpotUtils`、持久 `storage` | 讀取、分析、建立中間結果 |
| `penpotUtils.shapeStructure` | 取得 shape tree 摘要，含 flex/grid layout 摘要 | Normalize 前 |
| `getPages` / `findShape(s)` | 以 page、ID、predicate 定位設計元素 | 來源定位 |
| `generateMarkup` | HTML/SVG 參考輸出 | Emit 的 markup input |
| `generateStyle` | CSS 參考輸出 | token/style extraction |
| `generateFontFaces` | 字型 CSS | asset/style extraction |
| MCP `export_shape` | SVG/PNG shape 或 fill 輸出 | 資產匯出 |
| MCP `penpot_api_info` | 查詢 Plugin API 型別與方法 | 不確定 API 時 |
| Plugin WebSocket bridge | MCP server 與 Penpot plugin 的 request/response/task correlation | 傳輸層 |
| Vite | dev server、bundle、production build、preview | React app 產出與驗證 |
| TypeScript / ESLint | 型別與靜態檢查 | 生成後驗證 |
| Browser/Playwright | 啟動 app、操作 route、截圖與視覺核對 | end-to-end validation |

`execute_code` 的中間資料應放在 `storage`，而不是每次呼叫只回傳後丟失的 local variable。大型結果分段保存：先存 structure，再存 tokens，再存 markup/style，最後由外部 generator 組合成 versioned config。

## 6. 連線與設定的中轉層

MCP 本身也使用分層設定：`.devenv/shared` 放 workspace-independent server；`.devenv/templates` 放含 `${PENPOT_MCP_PORT}`、`${SERENA_MCP_PORT}` 的 workspace-specific template；`manage.sh` 每次 reconcile 後寫入 gitignored 的合併設定。`merge-mcp-config.py` 的 precedence 是 existing（若啟用）→ shared → template，template 同名項目覆蓋 shared。

這個模式可套用到 generator：

```text
checked-in defaults → project template → user/local overrides → resolved runtime config
```

但要分清兩種 config：

1. **工具 runtime config**：MCP host/port、WebSocket URL、timeout、log level；可由環境變數注入，secret 不入庫。
2. **design generation config**：Penpot source IDs、tokens、component mapping、routes、驗收條件；應版本化並可 review。

MCP server 預設 HTTP `4401`、WebSocket `4402`、REPL `4403`；plugin 需在 Penpot 載入 development manifest（預設 `http://localhost:4400/manifest.json`）並保持 UI 與 Penpot tab 活躍。client 可連 `http://localhost:4401/mcp`；只支援 stdio 的 client 使用 `mcp-remote`。多 instance 時，plugin 與 client 必須透過同一 MCP instance routing；不要把資料庫誤當成 live plugin connection registry。

## 7. 驗證、版本與可追溯性

每次生成保存以下 receipt（可放 `generation/receipt.json`）：

- input：需求 brief hash、Penpot file/page/root IDs、source revision。
- transform：config schema version、generator version、mapping warnings。
- output：產出 commit/hash、依賴 lockfile、資產清單。
- checks：`vite build`、route smoke result、viewport、visual diff、accessibility result。
- unresolved：未決需求與人工覆核項目。

驗證失敗時保留失敗結果與錯誤，不要以 fallback markup 偽裝成功。設計 layout 的 flex/grid 變更要優先修正 config；不要只調整產出 CSS，否則下一次重生成會遺失修正。

## 8. 最小可行操作清單

1. 收集 brief 與驗收條件。
2. 啟動 MCP server，載入 Penpot MCP plugin，確認 WebSocket connected。
3. 讀 high-level overview；保存 selection 到 `storage`。
4. 讀 page/shape structure，抽取 layout、tokens、assets、markup/style。
5. 寫入並 review `design-config.json`。
6. 用 deterministic generator 建立 React/Vite app。
7. 執行 `pnpm install`、`pnpm run build`、`pnpm run dev`/`preview`。
8. 用 browser/Playwright 按 route 與 viewport 驗證，回填 receipt。
9. 將差異分類為需求、設計、mapping、生成器或 runtime config 問題，再針對正確來源修正。

本流程的核心不是「把 Penpot HTML 貼到 JSX」，而是保留需求、設計來源、語意 layout、中轉 config、產出程式與驗證證據之間的可追溯鏈。
