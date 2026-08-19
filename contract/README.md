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
| `05-frontend-file-template.md` | generated React app 目錄與檔案責任 |

## Contract 原則

- `DspfDocument` 是既有設計資料來源。
- Conversion core 只讀取 `DspfDocument`。
- Semantic IR 是 conversion boundary，不取代 `DspfDocument`。
- DOM id、runtime binding key、source identity、business identity 必須分開。
- Unsupported semantics 不產生 executable action。
- Local demo 不得冒充 production backend。
- 每次轉換必須產生 manifest、traceability、binding map 與 conversion report。
- 既有 parser、writer、Canvas、React faithful preview、Inspector、source sync 必須通過 regression gate。
