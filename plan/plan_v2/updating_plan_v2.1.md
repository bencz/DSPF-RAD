# DSPF·RAD Modern React 轉換器計劃 V2.1

## 0. 文件定位

本文件承接：

- `updating_plan.md`：已交付的 React preview、Inspector、測試與對位功能。
- `updating_plan_v2.md`：DSPF → modern React 的初版規格。
- `report.md`：已交付功能與測試記錄。
- 三方 review：IBM i 工程師、Java/Spring Boot 架構檢查、銀行 BA 檢查。

V2.1 的目的不是增加更多 UI，而是先修正轉換層的語意、身份、runtime contract 與商用治理邊界。

## 1. 總架構師結論

| 項目 | 結論 |
|---|---|
| React converted pane | GO，可保留 |
| Material UI design system | GO，可保留 |
| 80 → 12 modern layout | GO，但必須保留原始 row/col 並記錄 lossiness |
| Shared conversion core | GO，首版不拆 Node service |
| 直接由 DspfDocument 產 React | NO-GO，先建立 semantic IR |
| 只用 field name 建 DOM id | NO-GO，改用 qualified source identity |
| 把 DSPF record 當 business route | NO-GO，必須分離 display、navigation、business workflow |
| Production HTTP failure 自動切 local | NO-GO，只允許明確的 development/demo mode |
| 銀行正式 UAT | NO-GO，先完成 approval、audit、權限與交易 contract |

## 2. 必須先解決的 Blocker

1. 沒有 DSPF semantic IR，無法安全處理 record format、AID、indicator、cursor、message、subfile lifecycle。
2. 80 → 12 的規則忽略 27x132、absolute row/col、WINDOW offset、overlap 與 reflow。
3. `fieldName → domId` 會在跨 record、SFL、WINDOW、duplicate field name 時碰撞。
4. OPTION/FUNCTION 沒有 CHCCTL、CA/CF、ENTER、MNUBARCHC、PULLDOWN、PSHBTNCHC reference graph。
5. SFL/SFLCTL 沒有 RRN、page、scroll、indicator、message subfile contract。
6. generated app 的 runtime API 沒有 AID、cursor、message、session、idempotency、concurrency contract。
7. conversion report 沒有 Draft、Review、Approve、Reject、Override、Superseded 狀態。
8. 銀行資料沒有 masking、maker-checker、SoD、audit、non-repudiation 與 deployment gate。

## 3. 決策一：Conversion core 是否拆 Node.js service

### 選項 A：先做 shared JS conversion core（建議）

```text
DspfDocument → Semantic IR → Conversion profile → React code/report
```

**優點**

- 設計器、CLI、exporter 共用同一份 logic。
- 不需要先處理 HTTP、部署、權限與 job queue。
- deterministic output 容易測試。
- 符合目前 browser-first 架構。

**缺點**

- 首版只適合單機或單使用者。
- 大量批次轉換需要後續 wrapper。

### 選項 B：立即建立 Node.js conversion service

**優點**

- 支援批次、多人、排程、集中結果。
- 未來可提供 conversion API。

**缺點**

- browser 與 Node 容易出現兩套 logic。
- 需要 job lifecycle、權限、artifact storage、版本與部署。
- 尚未解決 semantic IR 時，service 只會把錯誤架構包成 HTTP。

### 採用決定

採用 A。Node service 延後到 V2.8，且只能包裝 shared conversion core，不可重寫 converter。

## 4. 決策二：是否使用 SQLite

### 選項 A：首版不用 SQLite（建議）

**優點**：最少基礎設施，conversion core 可完全 deterministic。  
**缺點**：無法保存多人 revision、審核與工作記錄。

### 選項 B：SQLite 只保存 metadata

可保存：

- conversion job。
- source revision。
- converter version。
- binding/layout override。
- warning、error、manual review。
- traceability 與 artifact hash。

不可保存為唯一來源：

- DSPF 語意。
- 商用交易資料。
- 銀行 audit 的唯一證據。

### 選項 C：直接 PostgreSQL + object storage

**優點**：適合多人、審核與長期保存。  
**缺點**：首版營運成本與部署複雜度較高。

### 採用決定

V2.1 採 A。需要 local revision 時採 B。商用多人環境直接評估 C，不把 SQLite 當銀行 production database。

## 5. 決策三：DSPF semantic IR

### 選項 A：直接從 DspfDocument 產 component

**優點**：開發快。  
**缺點**：會把 parser 尚未知道的 runtime 語意變成假設，IBM i edge case 無法追蹤。拒絕此方案。

### 選項 B：先建立 Semantic IR（建議）

```text
DspfDocument
  ↓
DspfSemanticIR
  ├── displayProfiles
  ├── recordFormats
  ├── recordRelations
  ├── fields
  ├── references
  ├── indicators
  ├── aids
  ├── cursor
  ├── messages
  ├── windows
  ├── subfiles
  ├── menuGraph
  └── capabilities
```

**優點**

- conversion 可以區分已知、未知與不支援。
- 可保存 IBM i source 語意與 modern React 結果的 traceability。
- 便於未來接 Spring Boot runtime。

**缺點**

- P0 工作量增加。
- 需要定義 IR schema version。

### 採用決定

採用 B。沒有 Semantic IR，不進入 generated app production template。

## 6. 決策四：Field identity 與 DOM id

### 選項 A：只用 field name

**優點**：簡單、可讀。  
**缺點**：不同 record、SFL template、WINDOW 可重名；不可接受。

### 選項 B：qualified source identity + opaque DOM id（建議）

```json
{
  "sourceIdentity": "project:R1:record:CUST:field:DSCUSNO:occurrence:12",
  "runtimeBindingKey": "CUST.DSCUSNO",
  "domId": "Z-XMG3tX",
  "businessName": "customerNumber"
}
```

**優點**

- source identity、runtime binding、DOM identity 分開。
- 支援 duplicate name、revision、SFL occurrence。
- 可維持 traceability。

**缺點**

- binding map 較複雜。
- Inspector 必須顯示 qualified path，不能只顯示 field name。

### 選項 C：使用 `{RECORD}_{FIELD}` 作為全部 identity

**優點**：容易除錯。  
**缺點**：名稱可能過長，仍無法表示 occurrence、template 與 revision。

### 採用決定

採用 B。DOM id 不得作 business key；field name 不得作全域唯一 key。

## 7. 決策五：80 → 12 grid

### 選項 A：只用 `round(length / 80 * 12)`

**優點**：簡單。  
**缺點**：忽略 DSPSIZ、col、空白、overlap、WINDOW、同列 packing；不能單獨使用。

### 選項 B：profile-based mapping + deterministic packing（建議）

```text
sourceCols = 80 或 132
widthPercent = effectiveLength / sourceCols
span = clamp(round(widthPercent * 12), 1, 12)
```

同時保存：

```text
sourceRow
sourceCol
sourceLength
sourceRecord
windowOffset
targetRow
plannedSpan
actualSpan
lossiness
```

**優點**

- 支援 24x80 與 27x132。
- 仍保留原始座標。
- 同 row overflow、overlap、reflow 可產生 warning/manual-review。

**缺點**

- 需要 deterministic packing 規則。
- modern layout 不可能完全保持 5250 像素位置。

### 選項 C：精確 fractional CSS width

**優點**：最接近原始比例。  
**缺點**：與 MUI 12-grid 不一致，responsive 行為較難預測。

### 採用決定

採用 B。`length / 80` 只能作 24x80 的輸入規則；實作必須使用 `doc.cols` 或 DSPSIZ profile。任何 overlap、crop、reflow 都寫入 report。

## 8. 決策六：OPTION 與 FUNCTION

### 選項 A：依 component kind 直接分類

```text
choice = OPTION
button = FUNCTION
```

**優點**：快速。  
**缺點**：會遺失 CHCCTL、CA/CF、MNUBARCHC、PULLDOWN、PSHBTNCHC；拒絕此方案。

### 選項 B：建立 action capability matrix（建議）

每個 action 必須有：

```text
source object
command identity
AID kind/number
target record
target resource
permission
row/page scope
destructive flag
confirmation rule
idempotency rule
```

無法解析時輸出：

```text
manual-review
unsupported
```

**優點**：不會把視覺 icon 誤當交易 action。  
**缺點**：需要人工確認未解析 action。

### 採用決定

採用 B。OPTION/FUNCTION 是 semantic mapping，不是單純 UI mapping。

## 9. 決策七：Generated app runtime API

### 選項 A：維持簡單 request

```json
{
  "screen": "SIGNON",
  "aid": "ENTER",
  "fields": {}
}
```

**優點**：容易 demo。  
**缺點**：沒有 session、重送保護、cursor、message、subfile、權限；不可作商用 contract。

### 選項 B：分離 Display Session contract（建議）

Request 至少包含：

```json
{
  "sessionId": "...",
  "screen": "SIGNON",
  "screenRevision": "R1",
  "aid": { "kind": "ENTER", "number": null },
  "fields": {},
  "cursor": { "field": null, "row": null, "col": null },
  "subfiles": {},
  "idempotencyKey": "...",
  "correlationId": "..."
}
```

Response 至少包含：

```json
{
  "screen": "MENU",
  "screenRevision": "R1",
  "messages": [],
  "fieldValues": {},
  "indicators": {},
  "cursor": {},
  "subfiles": {},
  "nextActions": [],
  "warnings": []
}
```

錯誤 contract 必須包含：

```text
401、403、409、422、429、440
```

### 採用決定

採用 B。簡單 API 只能放 local demo，不可作 Spring Boot production contract。

## 10. 決策八：Node service 與 Spring Boot 的分工

| 責任 | Conversion core | Node conversion service | Spring Boot runtime |
|---|---|---|---|
| DSPF parse | 可使用 | 可包裝 | 不負責 |
| React code generation | 負責 | 可包裝 | 不負責 |
| conversion report | 負責 | 可保存 | 可查詢 |
| 交易與帳務 | 不負責 | 不負責 | 負責 |
| session/auth | 不負責 | conversion auth only | 負責 |
| AID/field runtime | 描述 contract | 不執行商用流程 | 執行 |
| audit/sign-off | 產生 metadata | 可保存 metadata | production authority |

### 採用決定

Conversion service 與 runtime backend 不合併。兩套 API 必須分開：

```text
/api/conversions/*
/api/screens/*
/api/transaction
```

## 11. 決策九：銀行治理與商用完備性

### 選項 A：只產生 code 與轉換報告

**優點**：首版快。  
**缺點**：無法支援 banking UAT 或部署審核。

### 選項 B：加入 review/approval state machine（建議）

```text
Draft
  ↓
Generated
  ↓
Manual Review
  ↓
Approved / Rejected
  ↓
Overridden / Superseded
```

每個 approval 必須保存：

```text
sourceRevision
converterVersion
artifactHash
actor
role
serverTimestamp
reviewDecision
reviewReason
```

必須支援：

- maker-checker。
- dual control。
- segregation of duties。
- rejection reason。
- revision invalidation。
- artifact hash。
- append-only audit。
- permission-controlled download/deploy。

### 採用決定

採用 B。未完成 approval gate 的 output 只能標示為 preview 或 demo，不得標示 production-ready。

## 12. 決策十：Modern React navigation

### 選項 A：全部用 sidebar/dropdown

**優點**：使用簡單。  
**缺點**：深層流程、權限、browser back、deep link 不清楚。

### 選項 B：Sidebar + route hierarchy（建議）

- 第一層：MUI Drawer/Sidebar。
- 少量第二層：dropdown。
- 有獨立權限、深度或工作流程的項目：route。
- 頁面級功能使用 route，不用 modal 代替頁面導航。
- TanStack Router 管理 route、deep link、back/forward、dirty navigation guard。
- TanStack Query 只管理 Spring Boot server state。
- DspfDocument、Inspector draft、selection 不放進 Query cache。

### 採用決定

採用 B。generated app 使用 route manifest；每個 route 必須有 permission、loader、error、not-found 與 dirty-state 行為。

## 13. Object、Variable 與 owner relationship

### 選項 A：忽略從屬關係並直接移動

**優點**：產生結果簡單。  
**缺點**：references、scope、權限與 business identity 可能斷裂；拒絕此方案。

### 選項 B：保留 owner，明確產生 symbol map（建議）

每個 source object 使用完整 path：

```text
project:revision:record:field:occurrence:role
```

移動時：

1. 建立 source path → target path map。
2. 改寫所有已知 references。
3. 偵測名稱衝突。
4. target component 不支援時輸出 manual-review。
5. 只有明確指定 `promote` 才提升 owner。
6. 把原 owner、target owner、原因與 references 寫入 traceability。

### 採用決定

採用 B。預設不扁平化，不靜默改變 owner。

## 14. Conversion output 契約

每次轉換必須產生：

| 檔案 | 內容 |
|---|---|
| generated source | React、MUI theme、routes、components、API client |
| `conversion-manifest.json` | source hash、revision、converter version、profile、output hash |
| `conversion-report.md` | summary、warning、error、manual-review、unsupported |
| `traceability.json` | source record/item → target file/component/DOM id |
| `binding-map.json` | qualified source identity、runtime key、DOM id、type、usage、validation |
| `conversion-log.jsonl` | 每個 object 的轉換結果與時間 |
| `openapi.yaml` | Spring Boot runtime contract |

每個 source object 必須落入下列一種狀態：

```text
converted
converted-with-warning
manual-review
unsupported
error
```

## 15. Revised Semantic IR

```text
DspfSemanticIR
├── sourceRevision
├── displayProfiles
├── recordFormats
├── recordRelations
├── fields
├── qualifiedSymbols
├── references
├── indicators
├── aids
├── cursor
├── messages
├── windows
├── subfiles
├── menuGraph
├── runtimeCapabilities
└── unsupportedSemantics
```

IR 不直接決定 business transaction。它只描述 DSPF 語意與可轉換能力。

V2.1-1 的 Semantic Layout tickets include `V2.1-1G`：external runtime binding adapter。此 adapter 只提供 display field、runtime value、indicator 與 display-workflow hint 的 traceability，不執行外部 runtime source，也不決定 business transaction。

## 16. Revised implementation waves

| Wave | Scope | Gate |
|---|---|---|
| V2.1-0 | Regression firewall、read-only conversion boundary、baseline snapshots | 106 Vitest、20 Playwright、build、fixture manifest 全綠 |
| V2.1-1 | DspfSemanticIR、DSPSIZ profile、source revision | IR schema、immutability、24x80/27x132 fixtures |
| V2.1-2 | qualified identity、occurrence identity、reference graph | duplicate、SFL、WINDOW、REFFLD collision tests |
| V2.1-3 | capability matrix、AID、indicator、CHOICE、CHCCTL、menu graph | unsupported/manual-review tests |
| V2.1-4 | profile-based 80/132 → 12 layout、packing、overlap | deterministic layout、source traceability、lossiness tests |
| V2.1-5 | SFL runtime model、cursor、message、screen session schema | contract tests、SFL fixtures、non-mutation tests |
| V2.1-6 | binding map、Inspector converted settings、DOM id | id stability、collision、override、doc immutability |
| V2.1-7 | converted MUI pane、OPTION/FUNCTION components | Playwright WYSIWYG、action capability matrix |
| V2.1-8 | Source React code view、export、manifest、report | generated app build、hash、traceability checks |
| V2.1-9 | Sidebar、route manifest、Query/runtime client | deep-link、403、dirty navigation、session tests |
| V2.1-10 | review/approval/audit model、maker-checker、SoD | revision invalidation、approval authority、audit tests |
| V2.1-11 | optional Node service / SQLite metadata | API、revision isolation、artifact retention |
| V2.1-12 | Spring Boot handoff | OpenAPI、auth、idempotency、session integration |

## 17. Release gates

### Gate A：Screen conversion

允許：

- converted pane。
- code preview。
- local demo。
- conversion report。

不允許：

- 宣稱 business workflow 已完成。
- 宣稱 banking runtime ready。
- 將 unsupported semantics 轉成 executable action。

### Gate B：Generated app integration

必須完成：

- runtime API contract。
- session、auth、idempotency。
- field validation。
- error contract。
- route permission。
- report approval。

### Gate C：Banking UAT

必須完成：

- maker-checker。
- SoD。
- audit/non-repudiation。
- masking/data classification。
- transaction reconciliation。
- duplicate submission protection。
- amount/date/currency/locale tests。
- manual conversion sign-off。

## 18. 最終架構建議

1. 先做 semantic IR，不先做更多轉換 UI。
2. 先把 24x80/27x132、record relation、identity、reference graph 定義清楚。
3. 把 80→12 視為有 lossiness 的 modernization policy，不宣稱 pixel parity。
4. 把 converted pane 定位成可審查的候選結果。
5. 把 generated app 與 Spring Boot runtime contract 分開。
6. 把 Node service 延後，讓它只包裝 conversion core。
7. SQLite 只保存 revision/metadata，不保存商用 transaction truth。
8. 把 OPTION/FUNCTION 轉成 action capability matrix，不只轉成 icon。
9. 把 conversion report 變成可審核、可拒絕、可覆核的治理流程。
10. 未支援語意必須停止 executable conversion，不能靜默遺失。

## 19. Open decisions

以下仍需業主在實作前確認：

- DOM id 使用 `Z-XMG3tX` 格式。它由 qualified source identity 產生，並與 runtime binding key、business name 分開。
- FUNCTION 例外清單與每項 action 的 permission/destructive policy。
- icon pack：Material Symbols 或其他 pack。
- 12-grid overflow 的 deterministic packing 細節。
- SFL runtime 是否由 generated app 直接支援，或先只輸出 contract。
- Banking UAT 的 approval authority、retention 與簽核工具。

## 20. Regression-first conversion boundary

本專案最重要的限制：新增轉換功能不得破壞原有 parser、model、writer、Canvas、React faithful preview、Inspector、source sync 與 codegen。

### 20.1 不可變更的 legacy contract

第一階段不可直接改寫：

```text
src/parser/
src/model/
src/writer/
src/canvas/
src/codegen/
react-app/src/preview/
src/app/sourceSync.js
```

Semantic IR 只能使用 read-only adapter：

```js
const ir = buildDspfSemanticIR(doc);
```

此函數不得呼叫：

```text
doc.updateItem
doc.addItem
doc.adopt
doc.emit
```

也不得改寫：

```text
item.id
record.type
record.keywords
activeRecordIndex
```

### 20.2 Document immutability test

每個 fixture 必須確認 IR build 前後 document 完全相同：

```js
const before = structuredClone(doc.toJSON());
const ir = buildDspfSemanticIR(doc);
const after = doc.toJSON();

expect(ir).toBeDefined();
expect(after).toEqual(before);
```

### 20.3 Legacy round-trip test

```text
DSPF source
  → parseDspf
  → snapshot document
  → buildSemanticIR
  → writeDspf
  → parseDspf
  → tuple comparison
```

IR build 不得改變 writer output。比較項目至少包括：

- record name/type。
- record keyword tuple。
- item row/col/length/type/usage。
- item keyword tuple。
- item indicators。
- WINDOW geometry。
- SFL/SFLCTL relation。

### 20.4 三種顯示的測試邊界

Canvas 與 React faithful preview 必須保持既有 parity：

```text
row
col
span
WINDOW offset
SFL relation
selection
condition hiding
```

Converted pane 不要求 pixel parity，但必須保留：

```text
sourceIdentity
source row/col
source length
record relation
binding id
warning
manual-review status
```

### 20.5 Source sync protection

React code view 只能讀取 document：

```text
DSPF source → document → React code view
```

不可形成：

```text
DSPF source → React code → DSPF source → React code loop
```

React code editor首版使用 read-only view。Code view 的修改不可反向寫入 DSPF source。

## 21. Revised execution order review

原 V2.1 的風險是先做 Semantic IR、grid、pane，但 integration firewall 尚未先建立。V2.1 改採以下順序：

### Phase A：Baseline 與邊界

```text
V2.1-0
```

工作：

- 記錄 106 Vitest、20 Playwright、build baseline。
- 固定 TESTS/QDDSSRC fixture manifest。
- 加 document immutability harness。
- 建立 read-only conversion boundary。

禁止：

- 新增 MUI pane。
- 修改 parser/model/writer。
- 修改 faithful preview。

### Phase B：Semantic foundation

```text
V2.1-1
V2.1-2
V2.1-3
```

工作順序：

1. DSPSIZ/model profile。
2. Semantic IR schema。
3. source revision。
4. qualified identity。
5. occurrence identity。
6. reference graph。
7. capability matrix。
8. AID、indicator、CHOICE、CHCCTL、menu graph。

只有此階段完成，才可以產生 converted component model。

### Phase C：Lossy layout 與 runtime description

```text
V2.1-4
V2.1-5
V2.1-6
```

工作順序：

1. 24x80/27x132 profile layout。
2. deterministic packing。
3. overlap/reflow/lossiness report。
4. SFL runtime model。
5. cursor/message/session description。
6. binding map 與 Inspector override。

此階段仍不連接商用 Spring Boot transaction。

### Phase D：Modern React presentation

```text
V2.1-7
V2.1-8
V2.1-9
```

工作順序：

1. Converted MUI pane。
2. OPTION/FUNCTION capability-based component。
3. React code view。
4. export manifest/report。
5. Sidebar、route manifest、Query runtime client。

Converted UI 只能顯示 Semantic IR 的結果，不可自行推測 IBM i runtime semantics。

### Phase E：治理與 backend handoff

```text
V2.1-10
V2.1-11
V2.1-12
```

工作順序：

1. Draft/Review/Approve/Reject/Override/Superseded。
2. maker-checker、SoD、audit。
3. optional Node/SQLite conversion metadata。
4. OpenAPI、Spring Boot session/auth/idempotency handoff。

不得先建立 production Node service 再補治理規則。

## 22. Integration release gates

### Gate 0：Legacy safety

必須通過：

```text
106/106 Vitest
20/20 Playwright
build
round-trip fixtures
document immutability
```

### Gate 1：Semantic safety

必須通過：

- 24x80 與 27x132。
- duplicate field identity。
- SFL/SFLCTL。
- WINDOW。
- REFFLD。
- CHCCTL。
- CA/CF/ENTER。
- indicator polarity。
- unsupported/manual-review classification。

### Gate 2：Generated app safety

必須通過：

- generated app build。
- generated code traceability。
- binding collision test。
- manifest hash test。
- route permission test。
- API error contract test。

### Gate 3：Banking readiness

必須通過：

- maker-checker。
- SoD。
- audit/non-repudiation。
- data classification/masking。
- idempotency。
- reconciliation。
- session expiry。
- manual conversion sign-off。

## 23. V2.1.1 之前不可做的事項

在 V2.1-0 至 V2.1-3 完成前，不做：

- 大量 MUI component mapping。
- production Node conversion service。
- SQLite schema migration。
- Spring Boot transaction implementation。
- banking runtime approval。
- 讓 generated app 自動執行 unsupported action。

原因：這些功能都依賴 Semantic IR、identity、reference graph 與 capability matrix。

## 24. First visible Modern React slice

### 24.1 目的

先讓使用者看到 Modern React converted pane。此 slice 不宣稱完成完整 DSPF converter，也不執行商用 transaction。

### 24.2 執行次序

```text
V2.1-0A Legacy baseline
    ↓
V2.1-0B Read-only visual conversion adapter
    ↓
V2.1-0C Modern MUI converted pane
    ↓
V2.1-0D Playwright integration check
    ↓
V2.1-1 Semantic IR
    ↓
V2.1-2 Identity and reference graph
    ↓
V2.1-3 Capability matrix
```

### 24.3 V2.1-0A：Legacy baseline

固定目前行為基準：

```text
106 Vitest
20 Playwright
vite build
DSPF round-trip
Canvas / React faithful preview parity
```

原因：Modern React 會新增 MUI component、theme、CSS 與 layout。先固定基準，才可知道新功能是否破壞原有 logic。

### 24.4 V2.1-0B：Read-only visual conversion adapter

建立下列 read-only flow：

```text
DspfDocument
    ↓
visual conversion model
    ↓
Converted preview
```

第一版只支援可安全顯示的內容：

```text
constant
field
sysvalue
record name
row
col
length
usage
basic COLOR
basic DSPATR
```

此 adapter 不得呼叫：

```text
doc.updateItem()
doc.addItem()
doc.adopt()
doc.emit()
```

此 adapter 不得修改：

```text
item.id
record.type
record.keywords
activeRecordIndex
```

原因：Converted preview 必須先證明它不會修改原本的 `DspfDocument`。

### 24.5 V2.1-0C：Modern MUI converted pane

建立可見的 Modern React 效果：

- MUI theme。
- `#0F3460` primary accent。
- 黑、白、灰階。
- Inter font。
- 16px base font。
- 12-column grid。
- field 依 length 計算 target span。
- constant、field、sysvalue Modern React components。
- Converted pane 與 Canvas、React faithful preview 並存。
- Feature flag 控制 Converted pane。

本 slice 不包含：

- business transaction。
- Spring Boot runtime。
- production export。
- automatic OPTION/FUNCTION action。
- production Node conversion service。

### 24.6 V2.1-0D：Playwright integration check

Playwright 必須測試：

- Canvas 仍然顯示。
- React faithful preview 仍然顯示。
- Converted pane 可以顯示。
- Converted pane 使用 12-column layout。
- Converted pane 不修改 `DspfDocument`。
- 切換 Converted pane 不改變 `activeRecordIndex`。
- 原有 selection 不被破壞。
- 原有 source sync 不被破壞。

測試流程：

```text
load the SIGNON fixture
read the original document snapshot
open the Converted pane
assert that the modern field exists
assert that the modern constant exists
assert that the grid span exists
read the document snapshot again
assert that the two snapshots are equal
run the existing faithful preview parity checks
```

### 24.7 First-slice acceptance gate

此 slice 只有在下列條件全部成立時完成：

```text
Modern Converted pane shows the SIGNON fixture
Converted fields use the modern token system
Converted layout uses the 12-column grid
The document snapshot remains unchanged
106 Vitest tests pass
20 Playwright tests pass
vite build succeeds
DSPF round-trip remains unchanged
Canvas / React faithful parity remains unchanged
```

### 24.8 Architecture boundary

此 slice 的結果是：

```text
Modern React visual preview
```

此 slice 的結果不是：

```text
完整 DSPF runtime converter
完整 business workflow
銀行 production app
```

完成 V2.1-0A 至 V2.1-0D 後，才開始 V2.1-1 Semantic IR。

## 25. Semantic conversion contract references

The Semantic Layout implementation must use the contract files in `contract/`:

| Contract | Purpose |
|---|---|
| `contract/semantic-layout-design.md` | Semantic IR boundary, identity, record relations, layout, regression, and external runtime rationale |
| `contract/schemas/semantic-ir.schema.json` | Versioned JSON Schema for `DspfSemanticIR` |
| `contract/schemas/semantic-diagnostics.json` | Conversion statuses, severity, reason and action contract |
| `contract/schemas/layout-policy.json` | 24x80/27x132 profile mapping and 12-column lossiness rules |
| `contract/schemas/traceability.schema.json` | Source object to generated target traceability contract |
| `contract/schemas/identity.schema.json` | Source identity, runtime key, DOM id, and business name |
| `contract/schemas/record-relation.schema.json` | WINDOW, SFL, menu, REFFLD, and CHCCTL relations |
| `contract/schemas/sfl-runtime.schema.json` | First-release SFL runtime contract and manual-review boundary |
| `contract/schemas/runtime-binding.schema.json` | Generic external runtime display binding |
| `contract/schemas/security.schema.json` | Runtime actor, session, role, permission, and CSRF context |
| `contract/schemas/diagnostic.schema.json` | Conversion diagnostic shape |
Implementation order:

```text
read contract/semantic-layout-design.md
validate DspfSemanticIR with contract/schemas/semantic-ir.schema.json
resolve display profile with contract/schemas/layout-policy.json
classify conversion status with contract/schemas/semantic-diagnostics.json
write source-to-target links that satisfy contract/schemas/traceability.schema.json
run legacy regression gates
```

The contract files are normative for V2.1-1A through V2.1-1G. A code change that conflicts with a contract file must update the contract, the affected ticket, and the verification evidence before implementation continues.

The contract files do not replace `DspfDocument`. They define the read-only conversion boundary because the existing parser, model, writer, Canvas, React faithful preview, Inspector, and source synchronization must remain unchanged.

## 26. Preview and generation workflow

Use `contract/09-preview-generation-methodology.md` as the repeatable preview and generation workflow.

```text
requirements brief
    ↓
DspfDocument and external source selection
    ↓
DspfSemanticIR
    ↓
versioned Mapping Contract
    ↓
deterministic React output
    ↓
Vite HMR or full reload
    ↓
fixed-viewport browser preview
    ↓
production build and Playwright audit
    ↓
conversion receipt and report
```

Classify every change before selecting the preview action:

```text
token/layout/content → HMR
route/asset/provider → full reload
runtime configuration → server restart
Semantic IR change → regenerate output
```

Store layout semantics, tokens, component mapping, bindings, routes, and acceptance conditions in the Mapping Contract. Do not repair generated CSS directly when the problem belongs to the mapping or token source.

The converted pane is a fast observation loop. The generated React app, production preview, and Playwright audit are the delivery evidence.

The workflow must preserve the existing parser, model, writer, Canvas, React faithful preview, Inspector, source sync, and selection behavior.

## TypeScript adoption boundary

Keep the existing DSPF-RAD editor in vanilla JavaScript: its parser, writer, Canvas, Designer, Inspector, boot sequence, and source synchronization depend on static browser ES modules and have no build step.

Use TypeScript for new conversion and generated-application boundaries once the build pipeline is introduced:

```text
Semantic IR → Mapping Contract → generated React → Spring Boot API client
```

The first typed models should cover Semantic IR, display profiles, identities, references, capabilities, diagnostics, layout mappings, runtime bindings, route manifests, and API errors. Until then, pure JavaScript plus JSON Schema and Vitest contract tests is the compatibility path. Any migration must preserve static deployment and the single `DspfDocument` source of truth.
