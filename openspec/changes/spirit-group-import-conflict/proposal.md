## Why

心之使者分組總表（`spirit-roster-drag-edit` 已提供拖曳搬移即時寫入 `students.spirit_ambassador_group`）與「原官網資料庫」是兩個彼此獨立、各自可被編輯的資料來源，管理者拖曳調整分組後，正常流程是立刻回官網手動同步；但實務上經常來不及同步，就又匯入了一批新的 xlsx（`POST /api/import/apply`）。目前匯入管線的 `spirit_ambassador_group` 完全沒有比照 `spirit_ambassador_makeup_completed`/`spirit_ambassador_is_leader` 的既有保留邏輯——`upsert` 對這個欄位是整列覆蓋語意，會無聲把拖曳異動洗掉，且系統完全不知道發生了覆蓋，管理者事後也無從察覺、無從回溯。這是一個現有的資料遺失風險，需要優先修正；修正後，需要進一步提供衝突處理機制，讓「本系統拖曳結果」與「xlsx 匯入值」不一致時，兩者都被保留，交由管理者事後在心之使者專區擇一保留。

## What Changes

- 修正匯入管線的根本缺陷：`app/api/import/apply/route.ts` 的 upsert batch 組裝比照 `group_leader`/`spirit_ambassador_makeup_completed` 既有保留模式，**不再讓 xlsx 的 `spirit_ambassador_group` 值直接覆蓋 `students` 表現有值**——改為觸發衝突偵測（見下），資料庫欄位本身維持本系統現有值不變，直到衝突被解決為止。
- 新增獨立的「分組衝突」資料表，記錄「本系統現有值」與「xlsx 候選值」兩者，不寫回 `students.spirit_ambassador_group`。匯入套用時，若偵測到某學員的 xlsx 分組值與 `students` 表現有值不一致，寫入（或更新既有的）一筆衝突記錄；若學員已有一筆待處理的衝突，本次匯入的新值取代舊的候選值，同一位學員最多同時存在一筆待處理衝突（不堆疊多筆歷史候選值）。
- xlsx 分組值若是 `spirit_ambassador_groups` 表中尚不存在的全新組名，同樣視為衝突（本系統值 vs xlsx 新組名），不自動建立新組別——新組別的建立仍只透過既有的「新增組別」自動編號機制。
- 心之使者專區新增「待處理分組衝突」清單區塊：列出所有待處理衝突（學員姓名、本系統現有值、xlsx 候選值、衝突發生時間），讓 `superadmin`/`system_admin` 可逐筆擇一保留（保留本系統值或改採 xlsx 候選值）；解決後的衝突標記為已解決並保留歷史紀錄，不再出現在待處理清單。權限與跨體系防護比照既有 `spirit-makeup`/`spirit-leader` 模式。
- 分組總表中，有待處理衝突的學員格子維持顯示本系統現有值（拖曳結果），並附加警示圖示標示「此人有待處理的分組衝突」，點擊可導向衝突清單對應項目。

## Capabilities

### Modified Capabilities
- `spirit-ambassador-hub`：新增「分組衝突偵測與處理」需求（衝突資料表、待處理清單 UI、擇一保留操作、分組總表警示標示）；修正既有匯入管線對 `spirit_ambassador_group` 缺乏保留邏輯的缺陷。既有 KPI/圖表/補課狀態/小隊長標記/拖曳搬移/新增刪除組別/匯出異動對照表需求不變。

## Impact

- **資料庫**：新 migration 新增「分組衝突」資料表（暫定 `spirit_group_conflicts`：學員 id/姓名、本系統值、xlsx 候選值、狀態〔待處理/已解決〕、解決方式、解決者、時間戳），不修改 `students` 表結構。
- **匯入管線**：`app/api/import/apply/route.ts` 的 upsert batch 組裝新增 `spirit_ambassador_group` 保留邏輯（比照 `group_leader` 既有模式）；新增衝突偵測步驟（比對 xlsx 值與 `dbMap` 現有值、`spirit_ambassador_groups` 是否存在該組名），寫入/更新衝突記錄。
- **前端**：`app/spirit/page.tsx` 新增待處理衝突查詢；`app/spirit/SpiritClient.tsx` 新增衝突清單區塊、擇一保留操作、分組總表警示圖示。
- **新 API 端點**：衝突解決操作（暫定 `PATCH /api/spirit-group-conflicts/[id]`），權限比照既有 `spirit-makeup`/`spirit-leader`。
- **不影響**：`spirit_ambassador_makeup_completed`、`spirit_ambassador_is_leader` 既有保留邏輯不變；拖曳搬移、新增/刪除組別、匯出異動對照表（`spirit-roster-drag-edit`）行為不變，兩者是互補關係——拖曳異動寫入 `students` 表現有值，本次變更確保這個現有值不會被匯入無聲洗掉。
- **前置依賴**：本 change 待 `spirit-roster-drag-edit` 完成並封存後才進行實作與詳細設計，因兩者共用同一批分組總表 UI 元件與 `spirit_ambassador_groups` 資料表，避免兩個進行中的 change 互相衝突修改同一批檔案。
