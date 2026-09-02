## Why

目前「小天使」相關資料只能在主表格（`/students`、`/counselors`）以單一欄位形式零散呈現：`role` 標記某學員的身份是小天使、`little_angel` 記錄某學員被指派的小天使是誰。這兩個維度都無法一眼看出「哪些人是小天使、各自帶了誰、帶了多少人」這種從屬全貌，需要逐筆查閱表格才能拼湊。實際盤點資料庫後確認：`little_angel` 有 481 筆填寫，形成 251 位不重複小天使的從屬網絡（平均帶 1.9 人、最多帶 27 人），且並非單層扁平結構——有 12 位小天使自己也被別的小天使帶，構成多層鏈；同時也發現 2 筆真實的循環引用髒資料（自我指向、雙向互指）。這些關係目前完全沒有一個集中的地方可以檢視，也沒有工具能發現這類資料品質問題。

## What Changes

- 新增「小天使專區」頁面（`/little-angel`），與現有的儀表板／資料維護／關懷長專區／心之使者專區並列於頂部導覽。
- 從屬關係主軸依 `little_angel` 欄位（誰的小天使是誰），呈現方式包含：
  - KPI 摘要：小天使總人數、被帶學員總人數、平均每位小天使帶人數、無小天使人數。
  - 排行榜長條圖：各小天使帶的人數排行。
  - 從屬樹狀圖：可選擇一位小天使，展開其樹狀從屬結構（含多層）。
  - 體系／地區分布圖：小天使關係在星光／太陽兩體系、或地理位置（縣市，沿用近期新增的 `county`/`district`/`address` 欄位）的分布概況。
  - 資料品質提醒：列出循環引用（自我指向、雙向互指）、`little_angel` 指向不存在學員 ID 等異常案例，供人工核對修正。
- 沿用既有的體系隔離規則（`getEffectiveSystem`），所有統計與圖表僅限使用者有效體系內的資料。

## Capabilities

### New Capabilities
- `little-angel-hub`：小天使從屬關係的檢視、統計、樹狀展開與資料品質提醒。

### Modified Capabilities
（無——不修改任何既有 capability 的既有需求；`little_angel`/`role` 欄位本身的匯入、儲存、既有表格顯示邏輯維持不變，本次純粹新增一個唯讀的檢視/統計頁面。）

## Impact

- **新頁面**：`app/little-angel/page.tsx`（Server Component，比照 `app/spirit/page.tsx` 的資料撈取+體系過濾模式）、`app/little-angel/LittleAngelClient.tsx`（Client Component，比照 `app/spirit/SpiritClient.tsx` 的 recharts 圖表呈現模式）。
- **共用工具**：評估重用/擴充 `lib/utils/buildTree.ts`（目前寫死用 `introducer` 欄位建樹，樹狀圖需要支援以 `little_angel` 為關聯欄位）；新增循環偵測邏輯（現有 `buildTree`/`relations` 皆未處理循環，需要新的防護機制，具體方案見 design.md）。
- **導覽**：所有既有的頂部導覽（`FilterBar.tsx`、`columns.tsx`、`CounselorsLayout/index.tsx`、`MaintenanceLayout/index.tsx`、`RelationshipNetwork/index.tsx`、`ImportWizard/DiffTable.tsx`、`SpiritClient.tsx` 等）新增一個前往「小天使」專區的連結。
- **不影響**：`students` 表結構、匯入/匯出邏輯、既有表格的 `little_angel`/`role` 欄位顯示與篩選行為。
