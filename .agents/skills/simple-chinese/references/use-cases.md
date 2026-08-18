# 文件之外的使用案例

STE 是為了飛機維修手冊而生的。它的特性——一詞一義、短句、條件在前的指令——可以遷移到任何「誤讀有代價」的文字上。到 Issue 8 為止，64% 的註冊 STE 使用者已經不在航太國防領域。

下列每個案例都標明模式與改寫重點。

## 錯誤訊息與 CLI 輸出

模式：程序文。這是價值最高的對象：一行錯誤訊息就是給壓力中的讀者的一條凌晨兩點指示。

模式：先陳述發生什麼事（簡單過去式）、若已知則說明原因、再給修復的指令或條件。

> **改寫前：** Oops! Something went wrong while attempting to establish a connection. Please ensure your credentials are properly configured and try again.
> **改寫後：** Connection to the database failed. The password for user `app` was not correct. Set `DB_PASSWORD` and connect again.

## Runbook 與標準作業程序

模式：偏向嚴格的程序文。這是 STE 的主場——on-call runbook 就是一本維修手冊。

- 每一步用祈使句、每步一條指示、條件在前。
- 警告放在步驟之前，指令在前，風險在後。
- 20 字上限嚴格執行：被 pager 壓力逼著的運維人員每個句子只會被讀一次。

## 事故報告與事後檢討

模式：描述文。只用簡單過去式——用現在完成式（"we have identified..."）寫的時間軸，會把事件發生的時間藏起來。

> **改寫前：** We have identified an issue that may have impacted some users' ability to access the service.
> **改寫後：** Between 14:02 and 14:31 UTC, 12% of requests failed. A deploy at 14:00 removed the cache warmup step.

STE 禁止閃爍語（"may have impacted"）——報告只陳述已知的事實，其餘寫「unknown」。這讀起來更誠實，因為它確實更誠實。

## Commit 訊息與 PR 描述

模式：描述文主體、祈使句主旨。現行慣例本來就合 STE：主旨用祈使句，主體用平實的過去式事實。對主體套用替換表與 25 字上限。刪掉 "this PR aims to"。

## API 變更日誌與發行說明

模式：描述文。一條目一變更，能一句話就一句話。"Breaking:" 條目遵循警告模式——指令在前："Update your calls to `v2/users`. The `name` field split into `first_name` and `last_name`."

## 給 AI agent 的指示（prompt、AGENTS.md、skill）

模式：程序文。系統提示詞就是一個由無法發問的讀者執行的程序書——正是 STE 設計來服務的那種讀者。

- 每句一條指示，讓規則可以獨立引用、不容易被半吊子執行。
- 一詞一義，防止模型把「check」「verify」「validate」當成三種不同作業。
- 條件在前（"If the build fails, stop"）勝過條件後置——模型常把後置條件漏掉。
- 不用「should」——模型會把「should」讀成可有可無。寫「must」或刪掉該規則。

## 客服範本與狀態頁更新

模式：描述文、25 字上限。非母語讀者是很多產品的多數使用者。不要 "we sincerely apologize for any inconvenience this may have caused"——要 "The API was down for 18 minutes. Uploads made during this time were saved and will process today."

## 翻譯與在地化前置處理

模式：嚴格。STE 的原初目的是讓非母語維修人員讀得懂英文，它同時也是機器翻譯的前置編輯。一詞一義加上完整文法（冠詞、「that」）除去大部分翻譯歧義。如果你的文件會被在地化，STE 能同時降低出錯率與成本。

## UI 文案與空狀態

模式：程序文、嚴格的字數限制。按鈕與標籤是技術名稱（豁免）。主體文案遵守規則："No projects yet. Create a project to start." 在這個長度下，其他東西也活不下來。

## STE 不適用的地方

行銷頁面、發布文章、部落格口吻、品牌寫作。STE 刻意刪除說服力。用你自己的聲音寫那些——然後把話術連結到的文件用 STE 寫。

---

## 簡明中文（中文輸出模式）

模式：中文程序文／描述文。規則見 SKILL.md「中文輸出模式」一節（中文字數 30/40、中文同義詞一詞一義、中文 AI 味替換表、分號允許並列）。

> **改寫前：** 為進一步提升用戶體驗，我們深度賦能了底層架構，並實現了完整閉環。
> **改寫後：** 我們升級了架構。升級後，載入時間從 3 秒降為 1 秒。

適用：中文產品文件、錯誤訊息、線上狀態頁、on-call 手冊——同一套「每個句子經得起一次閱讀」的邏輯。程式碼與欄位名保持原樣（不可改動項在兩種模式都成立）。