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
- [x] 4.4 手動測試拖曳到原分組（無變化）與拖曳到非法目標（例如另一體系，若 UI 有機會觸發）的邊界情況，確認皆有合理處理——使用者已於瀏覽器驗收通過

## 5. 新增/刪除組別（前端）

- [x] 5.1 `app/spirit/SpiritClient.tsx`：新增「新增組別」按鈕（`canEditMakeup` 時顯示），點擊後呼叫 `POST /api/spirit-groups`，成功後 `toast.success` + `router.refresh()`（待 migration 套用後於 7.1 於瀏覽器實測）
- [x] 5.2 每個分組欄位新增「刪除組別」按鈕（`canEditMakeup` 時顯示），該組 `members.length > 0` 時停用並提示「請先移出組員」；點擊有效的刪除按鈕時 `confirm()` 二次確認後呼叫 `DELETE /api/spirit-groups/[name]`，成功後 `toast.success` + `router.refresh()`（待 migration 套用後於 7.1 於瀏覽器實測）

## 6. 匯出分組異動對照表（前端）

- [x] ~~6.1 舊版：匯出完整分組總表~~ — 已依 UI/UX 評估改為異動對照表，見下方 6.2-6.4（design.md Decision 6）
- [x] 6.2 `app/spirit/SpiritClient.tsx`：新增 `originalGroupRef`（`useRef<Map<number, { name: string; originalGroup: string }>>`）與 `latestGroupMap`（`useState<Map<number, string>>`）追蹤本次工作階段的拖曳異動；`handleDragEnd` 成功後：若學員 id 尚未在 `originalGroupRef` 中則記錄其拖曳前分組為原始值，更新 `latestGroupMap` 為目標分組，若目標分組等於原始分組則從 `latestGroupMap` 移除該學員；執行 `npx tsc --noEmit` 確認型別正確
- [x] 6.3 移除舊的完整總表匯出按鈕與 CSV 組裝邏輯，改為「匯出異動對照表」按鈕：`latestGroupMap` 為空時停用並可提示「尚無異動」，按鈕文案顯示目前異動筆數；點擊時比對 `latestGroupMap` 與 `originalGroupRef` 組出僅含姓名/原分組/目前分組三欄的 CSV（UTF-8 BOM + `Blob` + `URL.createObjectURL` + 合成 `<a download>`，比照 `downloadRosterCsv()` 模式）
- [x] 6.4 手動測試：拖曳兩位不同學員到不同分組後匯出，確認 CSV 僅含這兩筆且欄位正確；同一位學員連續拖兩次，確認匯出僅一筆且「原分組」為最初值、「目前分組」為最終值；把某學員拖回原分組，確認該學員不出現在匯出結果中；未進行任何拖曳時確認匯出入口停用——使用者已於瀏覽器驗收通過

## 7. 整體驗證

- [x] 7.1 對照 `openspec/changes/spirit-roster-drag-edit/specs/spirit-ambassador-hub/spec.md` 逐條 Scenario 手動走查一次（拖曳、新增、刪除、匯出、越權情境），確認實際行為與規格一致——使用者已於瀏覽器完整驗收通過（涵蓋拖曳手感、刪除提示、搬移延遲提示等先前修正項目）
- [x] 7.2 執行 `npx tsc --noEmit` 與 `npm run build`，確認全站型別檢查與正式建置皆無錯誤
- [x] 7.3 更新 `openspec/changes/spirit-roster-drag-edit` 內文件狀態，向使用者回報完成，待確認後執行封存（`openspec archive`）——使用者已確認驗收正常，執行封存
