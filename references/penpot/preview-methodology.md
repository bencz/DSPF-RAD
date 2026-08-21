# React 即時 Preview 與參數調整方法論

## 1. 定義與工作流角色

即時 preview 是「生成結果的快速觀測與修正迴圈」，不是需求分析、設計來源或正式驗證的替代品。

```text
需求 brief + Penpot layout
        ↓
中轉 design config
        ↓
React/Vite generator
        ↓
即時 preview（快速回饋）
        ↓ 參數調整
config / mapping / source code
        ↓
正式 build + route / interaction / visual validation
```

它的主要價值是縮短以下時間：

- 改一個 layout/token 參數後，看到瀏覽器結果的時間。
- 找出 component mapping 錯誤的時間。
- 在正式驗證前，排除明顯的尺寸、間距、字型和 breakpoint 問題。

Preview 結果只能回答「目前瀏覽器看到什麼」；不能單獨證明資料流、accessibility、production build 或 Penpot source 已正確同步。

## 2. Repository 內已存在的 preview 能力

`mcp/packages/plugin/vite.config.ts` 使用 `vite-live-preview`：

```ts
livePreview({
  reload: true,
  config: {
    build: { sourcemap: true },
  },
})
```

此設定作用於 **Penpot MCP plugin 的 Vite 開發預覽**，不是一個已存在的 Penpot-to-React 網頁生成器。其餘已觀察到的設定：

- `base: "./"`：使用相對 base，適合 plugin 被載入到 Penpot UI 的情境。
- `build.rollupOptions.input` 同時建立 `plugin` 與 `index` entry。
- `entryFileNames: "[name].js"`：輸出固定的 `plugin.js` 等 entry 名稱。
- `preview.host` 由 `PENPOT_MCP_PLUGIN_SERVER_HOST` 決定。
- `preview.port` 預設為 `4400`。
- `preview.cors: true`。
- `define` 將 `WS_URI` 與 MCP version 注入 bundle。
- `vite.release.config.ts` 以 `mergeConfig` 複用 base config，並移除 live-preview plugin，避免 release build 依賴開發 reload。

package script `pnpm run start` 是 `vite build --watch --config vite.config.ts`；`pnpm run build` 則先跑 `tsc`，再使用 release config 進行 build。這代表目前專案的即時更新核心是 Vite watch/live-preview，而非每次變更都重新建置整個 MCP server。

## 3. 目標 React 網頁的 preview 架構

若要把前一份 methodology 中的生成層落實成 React/Vite app，建議目標 app 自己維持一個 Vite dev server：

```text
config editor / generator
          ↓ write or emit
     src/generated/*
          ↓ file change
      Vite dev server
          ↓ HMR / reload
       Browser preview
          ↓ screenshot + diagnostics
     adjustment decision
```

### HMR 與 full reload 的選擇

- **HMR**：適合 CSS、tokens、元件內不影響初始化的 props 變更；速度快，但可能保留舊 state。
- **Full reload**：適合 route、entry、global provider、asset manifest、初始化 config 變更；狀態會重置，但結果更接近乾淨啟動。
- **Vite build/preview**：適合正式產出前的 bundle smoke test，不應用作每次參數調整的主要迴圈。

生成器應把變更分類，而不是無條件 reload：

```ts
type ChangeKind = "style" | "layout" | "content" | "route" | "asset" | "runtime";

const reloadPolicy: Record<ChangeKind, "hmr" | "reload" | "restart"> = {
  style: "hmr",
  layout: "hmr",
  content: "hmr",
  route: "reload",
  asset: "reload",
  runtime: "restart",
};
```

這是建議的 application-generation layer，不是 repository 目前已提供的 API。

## 4. 參數調整模型

參數必須有來源、型別、套用位置與驗證範圍。不要讓模型直接任意改生成後 CSS，否則下一次生成會覆蓋修正。

```json
{
  "parameter": "hero.gap",
  "value": "24px",
  "source": "design-config",
  "scope": "Hero",
  "reason": "desktop screenshot shows excessive vertical spacing",
  "affectedViewports": ["1440x900", "768x1024"],
  "validation": "hero-to-subtitle distance <= 24px"
}
```

### 建議參數層級

1. **需求參數**：route、資料欄位、互動規則。修改後通常需要 reload 或重生成。
2. **設計 token**：color、spacing、typography、radius、shadow。優先以 CSS variables 或 token module 注入，通常可 HMR。
3. **layout 語意**：flex/grid direction、gap、padding、alignment、sizing。保留在 design config；不要退化成絕對 x/y。
4. **component mapping**：shape → component、text semantic、asset reference。修改後重生成 affected component。
5. **runtime config**：API base URL、feature flag、MCP endpoint。不可把 secret 寫入 bundle；通常需要重新啟動 dev server。

### 參數修改順序

```text
需求錯誤？       修 brief
設計來源錯誤？   修 Penpot/template
語意映射錯誤？   修 design-config mapping
token/layout錯誤？修 config/token
生成器錯誤？     修 generator
只有最後的局部業務邏輯錯誤？修手寫 extension
```

## 5. 單次調整迴圈

每次只處理一個可描述的差異，流程如下：

1. 固定 viewport、route、資料 fixture 和 browser state。
2. 啟動 React Vite dev server；記錄 URL、commit/config revision。
3. 打開 preview，先確認 console、network、runtime exception。
4. 截圖或讀取 DOM，指出具體差異：例如 `Hero` 的 gap、文字換行、button 尺寸。
5. 修改最接近來源的參數，保存 change record。
6. 等待 HMR 或 full reload 完成；不以「請求成功」代替頁面已更新。
7. 重新截圖，對比同一 viewport。
8. 若差異改善，保留 config 變更；若沒有改善，檢查 mapping、CSS precedence、font loading 和 layout system。
9. 達到局部 acceptance 後，再進行下一個差異。

不得在同一輪同時改 gap、font、width、DOM 結構，否則無法知道哪個變更造成改善。

## 6. Penpot MCP 在 preview 迴圈中的作用

MCP 是設計資料與操作的 bridge，不是 React dev server 本身：

- `high_level_overview`：先取得 Penpot API 與 layout 規則。
- `execute_code`：在 plugin context 讀取 Penpot shape、抽取結構、生成 markup/style，或把中間結果放進 `storage`。
- `penpotUtils.shapeStructure`：取得可比較的 shape tree 與 flex/grid 摘要。
- `penpot.generateStyle` / `generateMarkup`：產生 CSS、HTML/SVG 參考物。
- `export_shape`：取得指定 shape 的 SVG/PNG，供 React preview 使用。
- Plugin WebSocket：傳送 MCP task，接收 plugin 執行結果。

典型 loop：

```text
MCP 讀 Penpot
   → design-config
   → generator 寫 React app
   → Vite HMR/reload
   → browser screenshot
   → 將差異轉成明確參數
   → MCP 或 config 修正
```

`execute_code` 的暫存結果應放在 `storage`，但跨 session、可 review 的設計輸入仍應寫成 versioned config。Penpot plugin connection 是 MCP server process 內的 live registry；資料庫不是 preview session registry。

## 7. Preview 與正式驗證的分工

| 檢查 | 即時 preview | 正式驗證 |
|---|---:|---:|
| CSS/token 快速回饋 | 主要用途 | 需再確認 |
| layout 與 breakpoint 視覺檢查 | 適合初篩 | 必須固定 viewport 重跑 |
| TypeScript 錯誤 | HMR 可能顯示 | `tsc` / build 必須通過 |
| production bundle | 不保證 | `vite build` |
| route 載入 | 可初步確認 | 每個 acceptance route |
| 真實互動與資料流 | 不足 | Browser/Playwright |
| font/asset 載入 | 可觀察 | clean preview/build 再確認 |
| accessibility | 不足 | keyboard、semantic、檢查工具 |

Vite dev preview 可能掩蓋 production-only 問題，例如 asset base path、tree-shaking、環境變數、dynamic import 或 release config 差異。因此 preview 通過後仍必須跑 `pnpm run build`，再用 production preview 做 smoke test。

## 8. 設定與安全邊界

分開保存：

- `design-config.json`：Penpot IDs、layout、tokens、component mapping、routes、acceptance；可提交、可 review。
- `.env.local`：本地 API endpoint、MCP endpoint、非提交的 credentials；只注入允許的 public runtime values。
- `vite.config.ts`：固定 build、preview、HMR 行為；不把用戶需求或設計資料硬編碼在 config。
- `receipt.json`：每輪 input hash、參數 diff、preview URL/viewport、結果與 unresolved warnings。

MCP runtime 的 host/port 由環境變數控制。已知預設值包括 plugin preview `4400`、HTTP MCP `4401`、WebSocket `4402`、REPL `4403`。跨 origin 的 localhost 連線可能受 Chromium PNA 限制；preview 失敗時先檢查瀏覽器權限、CORS、host/port 和 plugin tab 是否仍活躍，不要直接改 generator。

## 9. 失敗分類與恢復

- **頁面沒有更新**：檢查 Vite watcher、HMR WebSocket、瀏覽器 console；必要時 full reload。
- **更新後出現舊 state**：把該類變更升級成 full reload，或用 deterministic fixture 重置 state。
- **Preview 可見但 build 失敗**：先修 TypeScript、import、asset path 或 release config；不能把 dev server 視為成功證據。
- **Penpot 與 React 不一致**：比對 source revision、shape IDs 和 config hash；不要手調生成 CSS 後遺留漂移。
- **MCP task timeout/斷線**：保持 plugin UI 與 Penpot tab 活躍，檢查 WebSocket connection；不可把斷線當成設計資料為空。
- **視覺差異反覆出現**：檢查 flex/grid 是否仍由 layout system 控制；不要以 child 絕對座標掩蓋 container layout。

## 10. 最小執行清單

1. 準備固定 brief、Penpot source ID、config revision 和 viewport。
2. 啟動 MCP/plugin bridge；確認 plugin WebSocket connected。
3. 產出或載入 design config。
4. 啟動 React Vite dev server。
5. 以 HMR 做 token/layout 小改，以 reload 做 route/asset/初始化改動。
6. 每輪保存 parameter diff 與 screenshot/diagnostic。
7. 通過局部視覺檢查後，跑 TypeScript 與 `vite build`。
8. 用 production preview 驗證 route、互動、assets、font 和 accessibility。
9. 將最終 config、generator revision 與 validation receipt 一起保存。

核心原則：即時 preview 是高頻、低成本的 feedback loop；中轉 config 才是可追溯的調整來源；正式 build 與瀏覽器驗證才是交付證據。
