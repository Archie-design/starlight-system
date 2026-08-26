## Why

FilterBar 目前顯示的「更新：」時間點是 `students.updated_at` 的最大值——只要任何一個學員欄位被手動編輯（例如表格內直接改儲存格），這個時間就會被推新，因此它反映的其實是「最後一次資料變動」，而非使用者真正關心的「這份資料距離上次從 xlsx 匯入，已經過了多久」。使用者無法從畫面上直觀判斷手上看到的資料是否已經過時、該不該重新匯入，需要額外去 `/history` 頁面才能查到最後一次匯入時間。在「更新：」時間旁邊補上一段「距上次匯入已過 X 天 Y 小時」的相對時間，能讓使用者一眼確認資料新穎程度，不用額外跳頁查詢。

## What Changes

- 新增一支唯讀查詢，取得目前有效體系下「最後一次已套用（`applied = true`）的匯入紀錄」的 `applied_at` 時間戳（資料源：`import_sessions` 表，需先能反推該筆匯入屬於哪個體系——比照既有 `history` API 的做法，用 `diff_snapshot` 內第一筆資料的 `business_chain` 判定）。
- FilterBar 現有的「更新：{時間}」旁邊，新增顯示「距上次匯入 X 天 Y 小時」（或未滿一小時顯示分鐘、從未匯入過時顯示提示文字）的相對時間文字。
- 相對時間文字每分鐘於前端自動重新計算一次（不需要重新打 API），確保畫面上顯示的經過時間持續走動、不會停留在頁面載入當下的數字。
- 不改變既有「更新：」欄位的資料來源與語意，純粹新增一個並列的顯示欄位。

## Capabilities

### New Capabilities
- `last-import-status`: 依呼叫者有效體系查詢「最後一次已套用匯入」的時間戳，並在 FilterBar 顯示距今經過的相對時間（天/小時/分鐘），提供資料新穎度的即時視覺提示。

### Modified Capabilities
（無——不修改任何既有 capability 的既有需求，`tenant-isolation` 的既有體系隔離規則被沿用而非變更。）

## Impact

- **新增 API**：`app/api/last-import/route.ts`（或等效路由），比照 `app/api/last-updated/route.ts`、`app/api/history/route.ts` 的既有模式（`checkAuth(request)` + `getEffectiveSystem()` + 依體系過濾）。
- **修改元件**：`components/StudentGrid/FilterBar.tsx`——新增一個 SWR 查詢與一段相對時間顯示邏輯，緊鄰現有的「更新：」文字。
- **資料來源**：讀取既有的 `import_sessions` 表（不需新增欄位或 migration），沿用 `history` API 已驗證過的「用 `diff_snapshot` 首筆 `business_chain` 反推體系」模式。
- **不影響**：其他頁面（`/counselors`、`/maintenance`、`/dashboard`）、既有的 `last-updated` API 與其顯示邏輯維持不變。
