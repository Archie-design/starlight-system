## 0. 前置條件

- [x] 0.1 確認 `spirit-roster-drag-edit` 已完成剩餘任務並執行 `openspec archive`封存——本 change 依賴其 `spirit_ambassador_groups` 表與分組總表 UI 結構，兩者同時進行中會互相衝突修改同一批檔案（已封存於 `openspec/changes/archive/2026-09-05-spirit-roster-drag-edit/`）

## 1. 資料庫與型別

- [x] 1.1 新增 migration：建立 `spirit_group_conflicts` 表（`id`, `student_id`, `student_name`, `system_value`, `import_value`, `status`, `resolution`, `resolved_by`, `resolved_at`, `created_at`, `updated_at`）+ RLS 政策（比照既有 anon 唯讀/service_role 全權模式）+ 部分唯一索引 `UNIQUE (student_id) WHERE status = 'pending'`；於 Supabase SQL Editor 執行後查詢確認表結構與索引皆正確建立
- [x] 1.2 `lib/supabase/types.ts` 新增 `SpiritGroupConflict` 介面，執行 `npx tsc --noEmit` 確認無型別錯誤

## 2. 修正匯入管線缺陷 + 衝突偵測

- [x] 2.1 `app/api/import/apply/route.ts`：在既有 `dbMap`/`existingStudents` 查詢之後，新增一次性查詢這批 `importIds` 中所有既有 `status='pending'` 的衝突記錄，組成 `Map<student_id, conflict_row>`，避免 N+1
- [x] 2.2 同檔案：upsert batch 組裝比照 `group_leader` 既有保留模式，新增 `spirit_ambassador_group: dbMap.get(row.id)?.spirit_ambassador_group ?? null`（不再讓 xlsx 值直接覆蓋）——已對真實資料庫模擬驗證：匯入不同分組值後 `students` 表現有值維持不變，測試資料已還原
- [x] 2.3 同檔案：實作衝突偵測邏輯（見 design.md Decision 2 虛擬碼）——比對 xlsx 分組值與資料庫現有值，不一致時寫入新衝突記錄或更新既有 pending 記錄的 `import_value`；一致或 xlsx 未提供分組值則不處理——已對真實資料庫模擬驗證三種情境（全新衝突、更新既有候選值、值相同不觸發），皆符合預期
- [x] 2.4 手動測試 xlsx 分組值為系統未知組名（`spirit_ambassador_groups` 中不存在）的情境，確認仍記錄為衝突且未自動新增該組別——已驗證通過

## 3. 分組衝突處理 API

- [x] 3.1 新增 `app/api/spirit-group-conflicts/[id]/route.ts`（PATCH）：`requireManager` 權限 + 依衝突記錄關聯的學員 `guidance_chain` 做越權檢查（`system_admin` 限其有效體系）；body 為 `{ resolution: 'kept_system' | 'kept_import' }`；`kept_system` 僅標記衝突為已解決，`kept_import` 額外將 `students.spirit_ambassador_group` 更新為衝突記錄的 `import_value`（不做組別存在性校驗）——已對真實資料庫模擬驗證兩種 resolution 的核心邏輯，皆符合預期，測試資料已還原；權限/越權檢查沿用既有 `requireManager`/`studentIdsAllInSystem`，與其他既有端點共用同一套已驗證過的機制

## 4. 前端：待處理衝突清單與總表警示

- [x] 4.1 `app/spirit/page.tsx`：新增查詢目前有效體系內所有 `status='pending'` 的 `spirit_group_conflicts`，組裝成清單資料傳給 Client Component；分組總表的 `rosterGroups` 組裝邏輯新增標記「該學員是否有待處理衝突」的欄位——實作時發現既有的分組總表容錯邏輯會把系統未知組名自動當成新欄位顯示，與 design.md 假設不符，已與使用者確認後移除該容錯，孤兒學員改為完全不出現在總表、只在資料品質提醒顯示
- [x] 4.2 `app/spirit/SpiritClient.tsx`：新增「待處理分組衝突」卡片區塊（置於分組總表下方），每列顯示學員姓名、資料庫現有值、xlsx 候選值、時間、兩顆操作按鈕；`canEditMakeup` 為 true 時才顯示操作按鈕，唯讀角色僅能檢視清單
- [x] 4.3 實作兩顆操作按鈕的點擊處理：`confirm()` 二次確認後呼叫 `PATCH /api/spirit-group-conflicts/[id]`，成功後 `toast.success` + `router.refresh()`，失敗則 `toast.error`
- [x] 4.4 分組總表格子新增衝突警示標示（有待處理衝突的學員旁顯示 ⚠ 圖示，`title` 說明），確認樣式優先權與既有小隊長★／補課綠底標示不衝突（可疊加顯示）
- [x] 4.5 手動測試完整流程：拖曳搬移一位學員 → 匯入含該學員舊分組值的 xlsx → 確認衝突清單出現該筆、分組總表對應學員顯示警示 → 分別測試「保留現有值」與「改採 xlsx 值」兩種處理，確認處理後清單與總表狀態皆正確更新——使用者已於瀏覽器驗收通過

## 5. 資料品質提醒延伸（design.md Risk 一節）

- [x] 5.1 `app/spirit/page.tsx`：新增查詢「`spirit_ambassador_group` 有值但該值不存在於 `spirit_ambassador_groups`」的學員名單（孤兒分組），納入既有「資料品質提醒」卡片區塊的新分類
- [x] 5.2 `app/spirit/SpiritClient.tsx`：資料品質提醒卡片新增對應的 `AlertBlock`——使用者已於瀏覽器驗收通過

## 6. 整體驗證

- [x] 6.1 對照 `openspec/changes/spirit-group-import-conflict/specs/spirit-ambassador-hub/spec.md` 逐條 Scenario 手動走查一次，確認實際行為與規格一致——使用者已於瀏覽器完整驗收通過（涵蓋衝突偵測、⚠ 警示、清單位置調整至分組總表下方、兩種解決方式、孤兒分組提醒）
- [x] 6.2 執行 `npx tsc --noEmit` 與 `npm run build`，確認全站型別檢查與正式建置皆無錯誤
- [x] 6.3 向使用者回報完成，待確認後執行封存（`openspec archive`）——使用者已確認驗收正常，執行封存
