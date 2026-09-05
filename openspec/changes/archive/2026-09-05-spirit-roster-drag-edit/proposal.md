## Why

心之使者專區的「分組總表」目前純唯讀（僅補課狀態、小隊長標記可點擊切換），關懷長若要調整某人的分組、新增一組、或裁併掉快空的組別，仍得離開系統回到手動維護的 Excel/Google 表單操作，再靠管理者事後把整批異動同步回系統。使用者希望直接在總表上用拖曳「直覺更換組別」，並能新增/刪除組別，讓總表本身成為調整分組的主要工具，而不只是唯讀展示。

同時，系統目前不是分組資料的唯一權威來源——關懷長維運的「原官網資料庫」是另一個獨立系統，且無法批次匯入、只能手動逐筆編輯。管理者調整完分組後，需要一份「哪些人的分組動過」的對照表，才能回到原官網手動同步——若匯出的是完整分組現況表，管理者還得自己比對出哪些人異動過，這正是最容易漏改、看錯的環節（見 design.md 的 UI/UX 評估）。

## What Changes

- 分組總表新增拖曳能力：`superadmin`/`system_admin` 可將任一組員從所屬分組拖曳到另一個分組，放開後立即呼叫既有模式的 PATCH 端點寫入 `spirit_ambassador_group`，資料庫即時生效（不做前端暫存草稿）。拖曳採用 `@dnd-kit`（本專案首次引入拖放函式庫，見 design.md）。
- 新增「新增組別」功能：於總表新增一個空白分組，組名依既有「星光N」/「太陽N」命名規則自動取下一個可用編號（沿用 `sortGroups()` 的解析規則），不開放自由命名輸入，避免命名不一致或撞名。
- 新增「刪除組別」功能：僅允許刪除目前沒有任何組員的空組別；若該組還有成員，刪除入口停用並提示需先將組員移出。
- 新增「匯出分組異動對照表」功能：系統在前端追蹤本次工作階段中實際被拖曳過的學員（記錄其原始分組與目前最新分組），管理者可將這份異動清單（僅含姓名、原分組、目前分組三欄，不含未異動的學員）匯出成 CSV 檔案，格式比照 `app/courses/CourseClient.tsx` 既有的 `downloadRosterCsv()` 前端匯出模式（UTF-8 BOM、`Blob`+`<a download>`）。管理者依這份精簡對照表逐筆到「原官網資料庫」手動同步，不需要自己比對完整名單找出變更之處，尚無任何異動時匯出入口停用。
- 新增 API 端點：`PATCH /api/students/[id]/spirit-group`（更新單一學員的 `spirit_ambassador_group`，用於拖曳落點）；`POST /api/spirit-groups`（新增空組別——因目前組別本身沒有獨立資料表，新增組別以「記錄一個目前無成員的組名」方式實作，見 design.md）；`DELETE /api/spirit-groups/[name]`（刪除空組別）。權限與越權防護比照既有 `spirit-makeup`/`spirit-leader` 端點：僅 `superadmin`/`system_admin`，`system_admin` 限其有效體系。

## Capabilities

### Modified Capabilities
- `spirit-ambassador-hub`：分組總表新增拖曳搬移組員、新增/刪除組別、匯出總表三項編輯能力；既有 KPI/圖表/補課狀態/小隊長標記需求不變。

## Impact

- **新 API 端點**：`app/api/students/[id]/spirit-group/route.ts`（PATCH，拖曳落點寫入）、`app/api/spirit-groups/route.ts`（POST，新增空組別）、`app/api/spirit-groups/[name]/route.ts`（DELETE，刪除空組別）。
- **前端**：`app/spirit/SpiritClient.tsx` 新增拖放互動（`@dnd-kit` 的 `DndContext`/`useDraggable`/`useDroppable`）、新增/刪除組別按鈕與確認流程、匯出 CSV 按鈕與組裝邏輯；`app/spirit/page.tsx` 可能需要調整資料查詢以支援「目前無成員的空組別」也能顯示在總表（見 design.md，因目前 `rosterGroups` 僅由有成員的學員列反推組別，空組別無從產生）。
- **依賴**：新增 `@dnd-kit/core`（`package.json`）。
- **不影響**：既有 KPI 統計、長條圖、資料品質提醒、匯入管線（`spirit_ambassador_group` 已受既有匯入保留邏輯管理，不因本次改動而變）、`spirit-makeup`/`spirit-leader` 既有端點與其權限模式。
- **待決策**（design.md 展開）：空組別（無任何成員）如何持久化——目前 `spirit_ambassador_group` 只是 `students` 表上的自由文字欄位，沒有獨立的「組別」資料表，新增一個「目前無人」的組別需要額外機制才能讓它在重新整理後仍然存在於總表。
