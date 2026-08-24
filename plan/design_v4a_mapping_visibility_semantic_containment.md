# V4a 設計方案：Mapping 可視化、Semantic 設定、規則圍堵檢查

**日期**：2026-08-24 · **狀態**：部分已實作（§2 標記證據）· **票**：`plan_v4_lifecycle_tickets.md` L4-0C/D/E

---

## 1. 目的與範圍

回應兩個營運問題：

1. **「我怎麼看 MAPPING 過程？」** —— 讓每次轉換的 mapping 依據可查、可比對、可帶走。
2. **「怎麼確認 RULE 情況外的東西有被 CATCH 到？」** —— 把「未知語意絕不靜默消失」從口號變成可執行的閘門。

範圍涵蓋：管線衛生修補（已完成）、Semantic 設定可視化（L4-0C，設計完成待做）、規則圍堵檢查 C5 gate（L4-0D，設計完成待做）。

## 2. 已實作：管線衛生包（L4-0E ✅）

| 項目 | 實作 | 證據 |
|---|---|---|
| `generated/` 進 `.gitignore` | 根 .gitignore 新增區塊 | git status 不再受產出物污染 |
| Console mapping 視窗 | `window.dspfRad.semantic()` 回傳 `{ ir, contract, overridesByItemId, overrideDiagnostics }`；`designOverrides` getter 取當前載入值 | `react-app/src/App.jsx`（overridesRef 即時鏡射） |
| 四件套產物補齊 | `reactApp.js` + `springBoot.js` 都輸出 `conversion-manifest.json` / `binding-map.json` / `traceability.json` / `conversion-report.json`；共用 `conversionManifest.js`（路徑排序、TextEncoder 真位元組數、無時間戳） | `src/codegen/artifacts.test.js` 5 tests |

驗證證據：root vitest **73 passed**（含 5 條新產物測試）、react-app **112 passed**、`npm run build` 成功、Playwright smoke+converted-pane **21 passed**。

### 使用方式（看 MAPPING 的三個窗口）

```js
// 瀏覽器 console（react-app）
window.dspfRad.semantic().contract.mappings
// → [{ sourceIdentity, targetComponent, source:{row,col}, target:{col,span}, status, lossiness, traceability }, …]
window.dspfRad.semantic().overrideDiagnostics   // override 命中/未命中明細
```

```text
# 生成物（可帶走的證據）
generated/react-app/conversion-manifest.json   # 本次產出哪些檔案、大小、mapping/diagnostic 數
generated/react-app/binding-map.json           # sourceIdentity → runtimeBindingKey + domId + status
generated/react-app/traceability.json          # source 幾何 → target 幾何 + component + lossiness
```

---

## 3. SEMANTIC 設定（L4-0C 設計）

### 3.1 問題

語意轉換的「設定」目前散落四處且**不可見**：

| 語意決策 | 目前所在 |
|---|---|
| 12 欄映射與 packing 政策 | `contract/schemas/layout-policy.json`（公式）＋ `layoutMapper.js`（實作預設 manual-review） |
| 五值狀態字典 | `semantic-diagnostics.json` |
| 元件選擇規則 | `mappingContract.js` 的 `componentFor()` |
| 欄位角色正規化 | `fieldRoles.js` |
| REFFLD metadata authority 順序 | `metadataAuthority.js` |

使用者看不到「這次轉換到底用了哪些語意規則」。

### 3.2 設計原則：先可見，後可調

**Step 1（本票）— 規則即證據**：新增純函數 `src/codegen/conversionProfile.js`：

```js
describeConversionProfile() → {
    layoutPolicy:     { targetColumns: 12, packingDefault: 'manual-review' },
    statusVocabulary: ['converted', 'converted-with-warning', 'manual-review', 'unsupported', 'error'],
    componentRules:   [{ match: 'field+usage=H', component: 'HiddenControl' },
                       { match: 'field',        component: 'ConvertedField' },
                       { match: 'constant',     component: 'ConvertedLabel' },
                       { match: 'sysvalue',     component: 'ConvertedSystemValue' }],
    authorityOrder:   ['compiled-dds', 'pf-lf-source', 'approved-alias', 'missing-source→manual-review'],
    sources: { layoutPolicy: 'contract/schemas/layout-policy.json',
               diagnostics:  'contract/schemas/semantic-diagnostics.json',
               rules:        'contract/02-conversion-core.md §3-§11' }
}
```

`buildConversionManifest()` 增加 `effectiveProfile` 欄位承接——**每一次轉換的產物都自我聲明用了哪些語意規則**。測試釘住欄位形狀與確定性。

**Step 2（未來票）— 可調**：CLI `--profile <json>` 允許覆寫少數安全參數（如 packing default）。任何新值**必須先寫進契約 Markdown 再實作**（D-10），且 profile 差異要進 receipt。

### 3.3 驗收條件

- [ ] `describeConversionProfile()` 存在且輸出確定性（兩次呼叫字串相等）
- [ ] 兩個生成器的 manifest 都帶 `effectiveProfile`
- [ ] profile 中每條 rule 都能對照到 contract 文件章節（sources 欄位）

---

## 4. 規則圍堵檢查——C5 Gate（L4-0D 設計）

### 4.1 「逃逸（escape）」的形式定義

一個來源物件滿足任一條件即為逃逸：

```text
E1  inventory 有此物件，但 mappings 與 diagnostics 都找不到對應 identity
E2  status ∉ { converted, converted-with-warning, manual-review, unsupported, error }
E3  status = converted，但其所屬類別不在覆蓋矩陣（02 §12）內
E4  同輸入重跑一次，任何 artifact hash 不一致
E5  pipeline 對任一 fixture 拋出例外（parser 容錯除外——parser 本身不得 throw）
```

### 4.2 三層檢查架構

| 層 | 機制 | 抓什麼 |
|---|---|---|
| **L-a 屬性測試**（root vitest） | 餵病態輸入：未知 DSPSIZ、未知 keyword、同名重複欄位、REFFLD 缺源、未知 item kind、空記錄、壞指標 | 斷言結果必落 `manual-review|unsupported|error` 且帶 code/reason/sourceIdentity；斷言 `droppedObjectCount=0`；斷言不 throw |
| **L-b 語料清掃 runner** | `scripts/verify-sources.mjs`：掃 `TESTS/*.DSPF`（20）＋ `QDDSSRC/*.DSPF`（50）逐檔跑完整 pipeline（IR→contract→四件套），彙總輸出 `coverage-matrix.json`（02 §12 矩陣 × 實際命中數）＋ escapes 清單；**任何 escape ⇒ exit 1** | E1–E5 全部；這是主要閘門 |
| **L-c 瀏覽器抽查**（既有 Playwright） | WCUSTSD2 斷言 review 區顯示 REFFLD/inferred 項目 | 圍堵結果在使用者面前真的可見 |

### 4.3 runner 輸出格式（確定性）

```json
{
  "schemaVersion": "containment-sweep/1",
  "fixtures": { "total": 70, "passed": 70, "failed": 0 },
  "coverageMatrix": {
    "recordFormats": { "objects": 331, "converted": 320, "warning": 8, "review": 3, "unsupported": 0 },
    "reffld":        { "objects": 41,  "resolved": 12, "manual-review": 29 }
  },
  "escapes": [],
  "determinism": { "checked": true, "identicalHashes": true }
}
```

### 4.4 接線

- 契約：02 §13 新增 **Gate C5: Containment sweep gate**（已加入）。
- CI：L4-1B 的 workflow 在 L1 之後加一行 `pnpm verify:sources`。
- Receipt：`checks.containment` 欄位引用 coverage-matrix hash。

### 4.5 驗收條件

- [ ] runner 對 70 個 fixtures 全跑通、零 escape、exit 0
- [ ] 人為注入一個會「靜默丟失」的假物件時，runner 必須轉紅（負向測試）
- [ ] `coverage-matrix.json` 兩次產出 byte-identical
- [ ] CI 紅綠與 runner exit code 連動

---

## 5. 執行序

```text
✅ L4-0E 衛生包（本方案 §2，已驗證）
→  L4-0C semantic profile 可視化（§3，約半天）
→  L4-0D containment sweep + CI 接線（§4，約一天，連動 L4-1B）
→  L4-0A overrides 接生成器（治上一輪識別的斷鏈 #1）
→  L4-2A 真 .fig adapter
```
