## 1. 資料庫與型別

- [x] 1.1 新增 migration `supabase/migrations/022_spirit_ambassador_groups.sql`：建立 `spirit_ambassador_groups` 表（`id` PK、`name` unique text、`guidance_chain` text、`created_at`），套用比照 `009_rls_allow_anon.sql` 的 RLS 政策（允許 anon/authenticated），並在同一 migration 內用 `INSERT ... SELECT DISTINCT` 依 `students.spirit_ambassador_group`/`guidance_chain` 回填既有組別；於 Supabase SQL Editor 執行後，查詢確認既有所有組名（例如「星光1」～「星光30」）皆已存在於新表
- [x] 1.2 `lib/supabase/types.ts` 新增 `SpiritAmbassadorGroup` 介面（`id`, `name`, `guidance_chain`, `created_at`），執行 `npx tsc --noEmit` 確認無型別錯誤

## 2. 新增 API 端點

- [x] 2.1 新增 `app/api/students/[id]/spirit-group/route.ts`（PATCH）：`requireManager` 權限 + `studentIdsAllInSystem` 越權檢查 + 校驗 `body.group` 對應的組別存在於 `spirit_ambassador_groups` 且 `guidance_chain` 屬於操作者有效體系，通過後 `update({ spirit_ambassador_group: body.group })`；手動以 curl/Postman 測試合法與跨體系兩種情境，確認回應狀態碼與資料庫結果符合預期（待 migration 套用後於 7.1 一併驗證）
- [x] 2.2 新增 `app/api/spirit-groups/route.ts`（POST）：`requireManager` 權限，依操作者有效體系查詢 `spirit_ambassador_groups` 現有組名、用 `^(?:星光|太陽)(\d+)$` 正則取最大編號 +1 產生新組名，寫入新表，若 `name` unique 衝突則重試一次取新的 max+1；手動測試連續呼叫兩次確認編號遞增且不衝突（待 migration 套用後於 7.1 一併驗證）
- [x] 2.3 新增 `app/api/spirit-groups/[name]/route.ts`（DELETE）：`requireManager` 權限，先查詢是否有學員的 `spirit_ambassador_group` 等於該組名，若有則回傳 400 拒絕，否則刪除該筆 `spirit_ambassador_groups` 記錄；手動測試對有成員的組別與空組別各呼叫一次，確認前者被拒絕、後者成功刪除（待 migration 套用後於 7.1 一併驗證）

## 3. 頁面資料查詢改造

- [x] 3.1 `app/spirit/page.tsx`：改為先查詢 `spirit_ambassador_groups`（依 `guidance_chain = system` 過濾）取得完整組名清單，將既有的 `rosterGroupMap` 改為以這份組名清單為準（含目前無任何組員的組別，產生空 `members` 陣列），`sortGroups()` 排序邏輯與既有寫法保持不變；本地確認一個手動建立的空組別會出現在 `rosterGroups` 輸出中
- [x] 3.2 確認既有 KPI（`kpi.groupCount` 等）與圖表資料（`groupCounts`、`groupAvgSeniority`）不受空組別影響——這些統計沿用原本以 `spirits`/`groupMap` 為母體的既有邏輯，不改動，執行 `npm run build` 確認無編譯錯誤

## 4. 拖曳搬移組員（前端）

- [x] 4.1 `package.json` 新增 `@dnd-kit/core` 依賴，執行 `npm install` 確認安裝成功
- [x] 4.2 `app/spirit/SpiritClient.tsx`：分組總表區塊包上 `DndContext`，每位組員包上 `useDraggable`，每個分組欄位容器包上 `useDroppable`；`canEditMakeup`（superadmin/system_admin）為 true 時才啟用拖曳互動，其餘角色維持純顯示
- [x] 4.3 實作 `onDragEnd`：取得被拖曳學員 id 與目標分組 name，呼叫 `PATCH /api/students/[id]/spirit-group`，成功後 `toast.success` + `router.refresh()`，失敗則 `toast.error`（待 migration 套用後於 7.1 於瀏覽器實測）
- [ ] 4.4 手動測試拖曳到原分組（無變化）與拖曳到非法目標（例如另一體系，若 UI 有機會觸發）的邊界情況，確認皆有合理處理

## 5. 新增/刪除組別（前端）

- [x] 5.1 `app/spirit/SpiritClient.tsx`：新增「新增組別」按鈕（`canEditMakeup` 時顯示），點擊後呼叫 `POST /api/spirit-groups`，成功後 `toast.success` + `router.refresh()`（待 migration 套用後於 7.1 於瀏覽器實測）
- [x] 5.2 每個分組欄位新增「刪除組別」按鈕（`canEditMakeup` 時顯示），該組 `members.length > 0` 時停用並提示「請先移出組員」；點擊有效的刪除按鈕時 `confirm()` 二次確認後呼叫 `DELETE /api/spirit-groups/[name]`，成功後 `toast.success` + `router.refresh()`（待 migration 套用後於 7.1 於瀏覽器實測）

## 6. 匯出分組總表（前端）

- [x] 6.1 `app/spirit/SpiritClient.tsx`：新增「匯出總表」按鈕，比照 `app/courses/CourseClient.tsx` 的 `downloadRosterCsv()` 模式實作 CSV 組裝（UTF-8 BOM + `Blob` + `URL.createObjectURL` + 合成 `<a download>`），欄位含組別、組內順序、姓名、是否小隊長、補課狀態（待於 7.1 用 Excel 開啟實測中文編碼）

## 7. 整體驗證

- [ ] 7.1（待使用者於 Supabase 執行 migration 022 後續行）對照 `openspec/changes/spirit-roster-drag-edit/specs/spirit-ambassador-hub/spec.md` 逐條 Scenario 手動走查一次（拖曳、新增、刪除、匯出、越權情境），確認實際行為與規格一致
- [ ] 7.2 執行 `npx tsc --noEmit` 與 `npm run build`，確認全站型別檢查與正式建置皆無錯誤
- [ ] 7.3 更新 `openspec/changes/spirit-roster-drag-edit` 內文件狀態，向使用者回報完成，待確認後執行封存（`openspec archive`）
